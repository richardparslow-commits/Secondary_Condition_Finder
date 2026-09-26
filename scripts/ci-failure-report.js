#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * CI failure escalation reporter — npm run ci:failure-report.
 *
 * Invoked by .github/workflows/ci-to-clickup.yml after the CI workflow
 * completes, to turn a genuine CI failure into a tracked ClickUp task.
 *
 * Why this logic lives in a script instead of inline workflow bash:
 *
 * The previous implementation was inline shell that could only ever execute
 * inside a workflow_run trigger fired by an actual CI failure. It was
 * therefore untestable in practice and rotted invisibly: across its whole
 * history it never once succeeded. Two of its defects are the reason this
 * file exists.
 *
 *  1. `cancelled` was treated as a reportable failure. ci.yml sets
 *     `cancel-in-progress: true` per pull request / ref, so a superseding
 *     push routinely cancels the run already in flight. That is normal
 *     branch hygiene, not a broken build, and the superseding run escalates
 *     itself if it genuinely fails. Escalating the cancellation files
 *     "investigate CI cancelled" tasks against perfectly good code — which
 *     is exactly how an alert queue gets trained to be ignored.
 *  2. Absent secrets were a hard error (exit 1). That conflates "the
 *     notifier is not configured" (a setup gap only a human can close) with
 *     "an alert was lost" (an operational failure). Both looked like the
 *     same red run, so neither was actionable and the escalation path was
 *     dead while appearing merely noisy.
 *
 * Severity model implemented here:
 *
 *  - Fail OPEN toward alerting. An unrecognized conclusion, an unparseable
 *    jobs payload, or an erroring dedupe lookup must never suppress a real
 *    failure: a lost alert is worse than a duplicate task.
 *  - Fail CLOSED toward noise. Routine cancellations and other non-failure
 *    conclusions are skipped explicitly, with the reason logged so a skip is
 *    auditable rather than silent.
 *  - A configured notifier that cannot deliver exits non-zero, because that
 *    is a genuine lost alert. An unconfigured notifier warns, records the
 *    gap in the step summary, and exits zero so it stops masquerading as a
 *    CI failure.
 *
 * SECURITY: this workflow runs on `workflow_run`, so it can read repository
 * secrets. It must only ever execute reporter code from the default branch,
 * never from the triggering run's head — otherwise an untrusted pull request
 * could run arbitrary code with CLICKUP_API_TOKEN in its environment. The
 * untrusted head SHA is consumed here as DATA only.
 *
 * No writes are made to this repository.
 */

const fs = require("fs");

/** Run conclusions that represent a genuine, actionable CI failure. */
const ESCALATABLE_CONCLUSIONS = ["failure", "timed_out", "startup_failure"];

/**
 * Conclusions that must never create a task, each with the reason surfaced in
 * the log. Kept as an explicit list of exemptions so that a new GitHub
 * conclusion fails open (escalate) instead of being silently ignored.
 */
const IGNORED_CONCLUSION_REASONS = {
  cancelled:
    "run was cancelled — ci.yml sets cancel-in-progress: true, so a newer run for the same ref almost certainly superseded it; the superseding run escalates itself if it fails",
  skipped: "run was skipped by its own workflow/job conditions",
  success: "run succeeded",
  neutral: "run completed with a neutral conclusion",
  stale: "run was closed as stale without completing",
  action_required: "run is awaiting first-time-contributor approval, which is not a failure",
};

/** Job names kept in the task title before it is truncated with "+N more". */
const MAX_JOBS_IN_TITLE = 4;
const REQUEST_TIMEOUT_MS = 20000;
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 1500;
const SEARCH_PAGE_LIMIT = 100;
const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";

/**
 * Classify a workflow_run conclusion into escalate / skip with a reason.
 *
 * Fails open on both edges: a missing conclusion and an unrecognized one are
 * escalated, because in neither case can we prove the run was healthy.
 */
function classifyConclusion(conclusion) {
  const value = typeof conclusion === "string" ? conclusion.trim() : "";
  if (!value) {
    return {
      escalate: true,
      reason: "run reported no conclusion; escalating rather than silently dropping it",
    };
  }
  if (ESCALATABLE_CONCLUSIONS.includes(value)) {
    return { escalate: true, reason: `run concluded '${value}'` };
  }
  if (Object.prototype.hasOwnProperty.call(IGNORED_CONCLUSION_REASONS, value)) {
    return { escalate: false, reason: IGNORED_CONCLUSION_REASONS[value] };
  }
  return {
    escalate: true,
    reason: `unrecognized conclusion '${value}'; escalating rather than assuming it is benign`,
  };
}

/**
 * Flatten whatever shape the jobs payload arrives in into a list of job
 * objects.
 *
 * `gh api` output varies with pagination flags: a bare `{ jobs: [...] }`, a
 * `--slurp`ed `[{ jobs: [...] }, ...]`, a concatenated page stream, or an
 * already-flattened `[job, ...]`. Parsing defensively means a shape change
 * degrades to "no job names known" rather than suppressing the alert.
 */
function normalizeJobsPayload(payload) {
  let root = payload;
  if (typeof root === "string") {
    try {
      root = JSON.parse(root);
    } catch {
      return [];
    }
  }
  const jobs = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (Array.isArray(node.jobs)) {
      node.jobs.forEach(visit);
      return;
    }
    if (typeof node.name === "string" || "conclusion" in node) jobs.push(node);
  };
  visit(root);
  return jobs;
}

/**
 * Select the job names that actually failed.
 *
 * Cancelled and skipped jobs inside an otherwise failed run are excluded: a
 * run that failed because one job failed while its siblings were torn down by
 * the shutdown must not name those siblings as failures.
 *
 * `names` is the FULL sorted set and is the escalation identity; `shown` is the
 * display truncation for the task title. Keeping them separate matters: if the
 * identity were derived from the truncated list, two reruns of one commit whose
 * first few failures and total count matched but whose remaining failures
 * differed would collide, and the second — genuinely different — alert would be
 * suppressed as a duplicate.
 */
function selectFailedJobs(jobs) {
  const names = [];
  for (const job of Array.isArray(jobs) ? jobs : []) {
    if (!job || typeof job !== "object") continue;
    const conclusion = typeof job.conclusion === "string" ? job.conclusion.trim() : "";
    if (!ESCALATABLE_CONCLUSIONS.includes(conclusion)) continue;
    const name = typeof job.name === "string" && job.name.trim() ? job.name.trim() : "(unnamed job)";
    if (!names.includes(name)) names.push(name);
  }
  names.sort((a, b) => a.localeCompare(b));
  return {
    names,
    shown: names.slice(0, MAX_JOBS_IN_TITLE),
    omitted: Math.max(0, names.length - MAX_JOBS_IN_TITLE),
    total: names.length,
  };
}

/** Report whether the notifier's secrets are present. */
function inspectSecrets({ apiToken, listId } = {}) {
  const missing = [];
  if (!apiToken || !String(apiToken).trim()) missing.push("CLICKUP_API_TOKEN");
  if (!listId || !String(listId).trim()) missing.push("CLICKUP_LIST_ID");
  return { configured: missing.length === 0, missing };
}

/**
 * Small dependency-free stable hash (FNV-1a). It only needs to be
 * collision-resistant within one repository's escalation queue, not
 * cryptographically strong.
 */
function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Stable identity for one escalation, embedded in the task description so a
 * human can see which run/conclusion/job-set produced it. Job names are sorted
 * here rather than trusted from the caller, so the key is genuinely
 * order-independent.
 */
function dedupeKey({ sha, conclusion, jobNames } = {}) {
  const parts = [
    typeof sha === "string" && sha ? sha : "unknown-sha",
    typeof conclusion === "string" && conclusion ? conclusion : "unknown-conclusion",
    Array.isArray(jobNames) && jobNames.length
      ? [...jobNames].sort((a, b) => String(a).localeCompare(String(b))).join("|")
      : "unknown-jobs",
  ];
  return `ci-${parts[0].slice(0, 12)}-${hashText(parts.join("\n"))}`;
}

/** The short identity token carried in a task title (the tail of a dedupe key). */
function keyToken(key) {
  if (typeof key !== "string" || !key) return "";
  const tail = key.slice(key.lastIndexOf("-") + 1);
  return tail && tail !== key ? tail : "";
}

/**
 * Build the task title. Deterministic, so it also serves as the dedupe
 * identity.
 *
 * The trailing identity token is what makes exact-title matching safe. A title
 * built from the seven-character SHA alone would be identical for two distinct
 * commits sharing that prefix, so a later, genuinely different alert would be
 * suppressed as a duplicate of the earlier one and the task would point at the
 * wrong run.
 */
function buildTaskTitle(options) {
  const { conclusion, jobNames, omitted = 0, sha, key } = options || {};
  const shortSha = (typeof sha === "string" && sha ? sha : "unknown").slice(0, 7);
  const jobs = Array.isArray(jobNames) && jobNames.length ? jobNames.join(", ") : "unknown";
  const suffix = Number.isFinite(omitted) && omitted > 0 ? ` +${omitted} more` : "";
  const verdict = typeof conclusion === "string" && conclusion ? conclusion : "failure";
  const token = keyToken(key);
  return `Investigate CI ${verdict}: ${jobs}${suffix} [${shortSha}]${token ? ` #${token}` : ""}`;
}

/**
 * Build the task body.
 *
 * Deliberately metadata-only: diagnostic logs and error excerpts stay in
 * GitHub Actions rather than being copied into a third-party tracker.
 */
function buildTaskDescription(options) {
  const { conclusion, jobNames, omitted = 0, sha, branch, runUrl, key } = options || {};
  const shortSha = (typeof sha === "string" && sha ? sha : "unknown").slice(0, 7);
  const jobs = Array.isArray(jobNames) && jobNames.length ? jobNames.join(", ") : "unknown";
  const suffix = Number.isFinite(omitted) && omitted > 0 ? ` (and ${omitted} more)` : "";
  const repoBase = typeof runUrl === "string" ? runUrl.replace(/\/actions\/runs\/.*$/, "") : "";
  const commitUrl = repoBase && sha ? `${repoBase}/commit/${sha}` : "";
  return [
    "<!-- ci-escalation: metadata only; diagnostic logs stay in GitHub Actions -->",
    `<!-- ci-escalation-key: ${key || "unknown"} -->`,
    "",
    "## CI failure",
    "",
    "**Workflow:** CI",
    `**Conclusion:** ${conclusion || "unknown"}`,
    `**Failed jobs:** ${jobs}${suffix}`,
    `**Branch:** ${branch || "unknown"}`,
    `**Commit:** ${commitUrl ? `[${shortSha}](${commitUrl})` : shortSha}`,
    `**Actions run:** ${typeof runUrl === "string" && runUrl ? `[Open failed run](${runUrl})` : "unavailable"}`,
    "",
    "Diagnostic logs and error excerpts remain in GitHub Actions and are not copied into ClickUp. Open the Actions run to inspect failure details.",
    "",
    "## Fix protocol",
    "",
    "Diagnose the first meaningful error before touching code. Classify it as code, test, data, dependency/tooling, runner/infrastructure, or flaky. Reproduce locally, fix one failure at a time, then run lint, typecheck, focused tests, full test suite, and build before pushing.",
    "",
  ].join("\n");
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One ClickUp API call with a hard timeout.
 *
 * `fetchImpl` is injectable so the retry, dedupe and delivery paths are
 * testable without a network — which is the entire point of moving this out of
 * inline workflow bash.
 */
async function clickupRequest(options) {
  // Options are destructured in the body rather than in the parameter list on
  // purpose: TypeScript infers a destructured JS parameter with a default as an
  // object type containing ONLY the defaulted property, so callers in tests/*.ts
  // then fail excess-property checks. Keep this shape.
  const { url, method, apiToken, body, fetchImpl, timeoutMs = REQUEST_TIMEOUT_MS } = options || {};
  const impl = fetchImpl || globalThis.fetch;
  if (typeof impl !== "function") {
    throw new Error("no fetch implementation available (Node 18+ provides a global fetch)");
  }
  const headers = { Authorization: String(apiToken) };
  const init = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  if (globalThis.AbortSignal && typeof globalThis.AbortSignal.timeout === "function") {
    init.signal = globalThis.AbortSignal.timeout(timeoutMs);
  }
  const response = await impl(url, init);
  const status = Number.isFinite(response?.status) ? response.status : 0;
  const text = typeof response?.text === "function" ? await response.text() : "";
  return { status, ok: status >= 200 && status < 300, text };
}

/**
 * Retry only transient outcomes (network errors, 429, 5xx).
 *
 * A 4xx other than 429 is a permanent rejection — retrying it just burns the
 * job's minutes — so it is returned immediately for the caller to report.
 */
async function withRetries(operation, options) {
  const { attempts = MAX_ATTEMPTS, backoffMs = RETRY_BACKOFF_MS, log, sleep } = options || {};
  const emit = typeof log === "function" ? log : () => {};
  const wait = sleep || defaultSleep;
  let lastError = null;
  let lastResult = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await operation(attempt);
      // Transient: no usable HTTP status (aborted/malformed), 429, or 5xx.
      // Anything else — including a 4xx rejection — is final.
      const transient = result.status === 0 || result.status === 429 || result.status >= 500;
      if (!transient) return result;
      lastResult = result;
      emit(`attempt ${attempt}/${attempts} got HTTP ${result.status}; transient, will retry`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      emit(`attempt ${attempt}/${attempts} failed: ${lastError.message}`);
    }
    if (attempt < attempts) await wait(backoffMs * attempt);
  }
  if (lastResult) return lastResult;
  return {
    status: 0,
    ok: false,
    text: "",
    error: lastError ? lastError.message : "unknown transport error",
  };
}

/**
 * Best-effort duplicate detection, searched by the short SHA and confirmed by
 * exact title match (the title is deterministic for a given
 * sha/conclusion/job-set).
 *
 * FAILS OPEN by design: any error, unexpected response shape, or partial match
 * returns null so the task is still created. A dedupe bug may produce a
 * duplicate task; it must never swallow an alert.
 */
async function findDuplicateTask({ apiToken, listId, title, searchTerm, fetchImpl, log, sleep }) {
  const emit = typeof log === "function" ? log : () => {};
  try {
    const url =
      `${CLICKUP_API_BASE}/list/${encodeURIComponent(String(listId))}/task` +
      `?search_task=${encodeURIComponent(String(searchTerm))}&page_limit=${SEARCH_PAGE_LIMIT}`;
    const response = await withRetries(
      () => clickupRequest({ url, method: "GET", apiToken, fetchImpl }),
      { log: emit, sleep },
    );
    if (!response.ok) {
      emit(`dedupe search returned HTTP ${response.status}; creating the task anyway`);
      return null;
    }
    const parsed = JSON.parse(response.text || "{}");
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    const match = tasks.find((task) => task && typeof task.name === "string" && task.name === title);
    return match ? String(match.id) : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emit(`dedupe search failed (${message}); creating the task anyway`);
    return null;
  }
}

/** Create the escalation task. */
async function createTask({ apiToken, listId, payload, fetchImpl, log, sleep }) {
  const url = `${CLICKUP_API_BASE}/list/${encodeURIComponent(String(listId))}/task`;
  return withRetries(() => clickupRequest({ url, method: "POST", apiToken, body: payload, fetchImpl }), {
    log,
    sleep,
  });
}

/**
 * Decide what to do about one completed CI run, and do it.
 *
 * Every outcome is explicit and auditable, including the skips — a notifier
 * that silently does nothing is indistinguishable from one that is broken.
 */
async function reportFailure(options) {
  const { run, jobs, apiToken, listId, fetchImpl, log, sleep, dryRun = false } = options || {};
  const emit = typeof log === "function" ? log : () => {};
  let meta = run;
  if (typeof meta === "string") {
    try {
      meta = JSON.parse(meta);
    } catch {
      // Fail open: unusable run metadata must not suppress the alert. The
      // workflow trigger has already established that the run was not benign,
      // so escalating with unknown metadata is the correct default.
      emit("run metadata is not valid JSON; escalating with unknown metadata");
      meta = {};
    }
  }
  if (!meta || typeof meta !== "object") meta = {};
  const conclusion = typeof meta.conclusion === "string" ? meta.conclusion : "";
  const decision = classifyConclusion(conclusion);
  const sha = typeof meta.head_sha === "string" ? meta.head_sha : "";
  const branch = typeof meta.head_branch === "string" ? meta.head_branch : "";
  const runUrl = typeof meta.html_url === "string" ? meta.html_url : "";

  if (!decision.escalate) {
    emit(`skip: ${decision.reason}`);
    return { action: "skipped-non-failure", exitCode: 0, conclusion, reason: decision.reason };
  }

  const selected = selectFailedJobs(normalizeJobsPayload(jobs));
  if (selected.total === 0) {
    // Fail open: unknown job names are still a real failure worth escalating.
    emit("no individually-failed job names could be determined; escalating with 'unknown'");
  }
  // Identity uses the FULL failed-job set; only the display strings truncate.
  const key = dedupeKey({ sha, conclusion, jobNames: selected.names });
  const title = buildTaskTitle({
    conclusion,
    jobNames: selected.shown,
    omitted: selected.omitted,
    sha,
    key,
  });
  const description = buildTaskDescription({
    conclusion,
    jobNames: selected.shown,
    omitted: selected.omitted,
    sha,
    branch,
    runUrl,
    key,
  });
  const payload = { name: title, description, priority: 2, notify_all: false };
  const base = {
    conclusion,
    reason: decision.reason,
    title,
    key,
    jobNames: selected.names,
    shownJobNames: selected.shown,
    omitted: selected.omitted,
  };

  if (dryRun) {
    emit(`dry-run: would escalate '${title}' (key ${key})`);
    return { ...base, action: "dry-run", exitCode: 0, payload };
  }

  const secrets = inspectSecrets({ apiToken, listId });
  if (!secrets.configured) {
    emit(
      `notifier disabled: missing repository secret(s) ${secrets.missing.join(", ")} — this CI failure was NOT escalated to ClickUp`,
    );
    return { ...base, action: "skipped-unconfigured", exitCode: 0, missingSecrets: secrets.missing };
  }

  const duplicateTaskId = await findDuplicateTask({
    apiToken,
    listId,
    title,
    searchTerm: sha ? sha.slice(0, 7) : title,
    fetchImpl,
    log: emit,
    sleep,
  });
  if (duplicateTaskId) {
    emit(`duplicate suppressed: task ${duplicateTaskId} already tracks ${key}`);
    return { ...base, action: "duplicate-suppressed", exitCode: 0, duplicateTaskId };
  }

  const delivery = await createTask({ apiToken, listId, payload, fetchImpl, log: emit, sleep });
  if (!delivery.ok) {
    const detail = delivery.error || `HTTP ${delivery.status} ${String(delivery.text).slice(0, 400)}`;
    emit(`ALERT LOST: could not create the ClickUp task (${detail})`);
    return { ...base, action: "delivery-failed", exitCode: 1, detail, payload };
  }
  let taskId = "";
  try {
    taskId = String(JSON.parse(delivery.text || "{}").id ?? "");
  } catch {
    taskId = "";
  }
  emit(`escalated: created ClickUp task ${taskId || "(id unavailable)"} for ${key}`);
  return { ...base, action: "escalated", exitCode: 0, taskId, payload };
}

/** GitHub Actions log annotation; embedded newlines must be percent-encoded. */
function annotate(level, message) {
  const encoded = String(message).replace(/\r?\n/g, "%0A").replace(/\r/g, "%0D");
  console.log(`::${level} title=CI failure escalation::${encoded}`);
}

function readOptionalFile(filePath) {
  if (!filePath) return undefined;
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    // Fail open: unreadable metadata must not suppress an escalation.
    console.log(`could not read ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--run-file") args.runFile = argv[(index += 1)];
    else if (arg === "--jobs-file") args.jobsFile = argv[(index += 1)];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runSupplied = Boolean(args.runFile) || Boolean(process.env.CI_RUN_JSON);
  if (!runSupplied) {
    // No metadata source at all is a caller/wiring bug, not a benign no-op:
    // exiting successfully here would hide the fact that nothing was classified.
    annotate(
      "error",
      "no CI run metadata supplied (--run-file or CI_RUN_JSON); the escalation decision could not be made",
    );
    process.exitCode = 1;
    return;
  }

  const runText = args.runFile ? readOptionalFile(args.runFile) : process.env.CI_RUN_JSON;
  const jobs = args.jobsFile ? readOptionalFile(args.jobsFile) : process.env.CI_JOBS_JSON;
  if (args.runFile && runText === undefined) {
    // Fail open: an explicitly supplied but unreadable run file must still
    // escalate with unknown metadata rather than silently drop the alert. The
    // workflow trigger already established that the run was not benign.
    console.log("run metadata unreadable; escalating with unknown metadata (fail-open)");
  }

  const result = await reportFailure({
    run: runText === undefined ? {} : runText,
    jobs,
    apiToken: process.env.CLICKUP_API_TOKEN,
    listId: process.env.CLICKUP_LIST_ID,
    dryRun: args.dryRun,
    log: (message) => console.log(message),
  });

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const lines = [
      "## CI failure escalation",
      "",
      `- **Outcome:** \`${result.action}\``,
      `- **Reason:** ${result.reason ?? "n/a"}`,
    ];
    if (result.title) lines.push(`- **Task title:** ${result.title}`);
    if (result.action === "skipped-unconfigured") {
      lines.push(
        "",
        "> [!WARNING]",
        `> Escalation is **disabled**: ${result.missingSecrets.join(", ")} not configured, so CI failures are **not** reaching ClickUp. Set the secret(s) in repository settings to restore the escalation path.`,
      );
    }
    if (result.action === "delivery-failed") {
      lines.push("", "> [!CAUTION]", `> An alert was **lost**: ${result.detail}`);
    }
    try {
      fs.appendFileSync(summaryPath, `${lines.join("\n")}\n`);
    } catch {
      /* the step summary is best-effort; never fail the job over it */
    }
  }

  if (result.action === "skipped-unconfigured") {
    annotate(
      "warning",
      `CI failure escalation is DISABLED — missing ${result.missingSecrets.join(", ")}. This failure was not posted to ClickUp.`,
    );
  } else if (result.action === "delivery-failed") {
    // Fail closed: the notifier was configured and still lost a real alert.
    annotate("error", `CI failure alert was LOST: ${result.detail}`);
  }

  process.exitCode = result.exitCode;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ action: "reporter-error", error: String(error) }, null, 2));
    process.exitCode = 1;
  });
}

module.exports = {
  CLICKUP_API_BASE,
  ESCALATABLE_CONCLUSIONS,
  IGNORED_CONCLUSION_REASONS,
  MAX_ATTEMPTS,
  MAX_JOBS_IN_TITLE,
  buildTaskDescription,
  buildTaskTitle,
  classifyConclusion,
  createTask,
  dedupeKey,
  findDuplicateTask,
  hashText,
  inspectSecrets,
  keyToken,
  normalizeJobsPayload,
  reportFailure,
  selectFailedJobs,
  withRetries,
};





