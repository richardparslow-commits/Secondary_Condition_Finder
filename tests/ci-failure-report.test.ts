import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ESCALATABLE_CONCLUSIONS,
  IGNORED_CONCLUSION_REASONS,
  MAX_ATTEMPTS,
  MAX_JOBS_IN_TITLE,
  buildTaskDescription,
  buildTaskTitle,
  classifyConclusion,
  dedupeKey,
  inspectSecrets,
  normalizeJobsPayload,
  reportFailure as reportFailureRaw,
  selectFailedJobs,
  withRetries,
} from "../scripts/ci-failure-report";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

type TaskPayload = {
  name: string;
  description: string;
  priority: number;
  notify_all: boolean;
};

type ReportResult = {
  action: string;
  exitCode: number;
  conclusion?: string;
  reason?: string;
  title?: string;
  key?: string;
  jobNames?: string[];
  omitted?: number;
  missingSecrets?: string[];
  duplicateTaskId?: string;
  detail?: string;
  taskId?: string;
  payload?: TaskPayload;
};

type ReportOptions = {
  run?: unknown;
  jobs?: unknown;
  apiToken?: string;
  listId?: string;
  fetchImpl?: unknown;
  log?: (message: string) => void;
  sleep?: (ms: number) => Promise<void>;
  dryRun?: boolean;
};

const reportFailure = reportFailureRaw as unknown as (options: ReportOptions) => Promise<ReportResult>;

const RUN_URL = "https://github.com/example-org/example-repo/actions/runs/35739003368";
const SHA = "340d2a31871d4a8f4c1f6e4c4a9a0f7f2a9c3b21";

function runFixture(conclusion: string, overrides: Record<string, unknown> = {}) {
  return {
    conclusion,
    head_sha: SHA,
    head_branch: "main",
    html_url: RUN_URL,
    id: 35739003368,
    ...overrides,
  };
}

function jobFixture(name: string, conclusion: string) {
  return { name, conclusion, status: "completed" };
}

type FakeResponse = { status: number; body?: unknown };
type FetchCall = { url: string; method: string; body?: string };

/**
 * Scripted fetch replacement. The reporter takes an injected `fetchImpl`, so
 * the retry, dedupe and delivery paths are exercised without a network — the
 * capability the previous inline-bash implementation fundamentally lacked.
 */
function fakeFetch(responses: Array<FakeResponse | Error>) {
  const calls: FetchCall[] = [];
  let index = 0;
  const impl = async (url: string, init: { method: string; body?: string }) => {
    calls.push({ url, method: init.method, body: init.body });
    const next = responses[Math.min(index, responses.length - 1)];
    index += 1;
    if (next instanceof Error) throw next;
    return { status: next.status, text: async () => JSON.stringify(next.body ?? {}) };
  };
  return { impl, calls };
}

const noSleep = async () => {};

function collectLogs() {
  const logs: string[] = [];
  return { logs, log: (message: string) => logs.push(message) };
}

/**
 * The escalation policy is the whole point of this reporter: ci.yml sets
 * `cancel-in-progress: true`, so cancellations are routine branch hygiene.
 * Treating one as a failure files "investigate" tasks against good code, which
 * is how an alert queue gets trained to be ignored.
 */
describe("CI failure escalation policy", () => {
  it("escalates every genuine failure conclusion", () => {
    for (const conclusion of ESCALATABLE_CONCLUSIONS) {
      expect(classifyConclusion(conclusion).escalate, conclusion).toBe(true);
    }
    expect(ESCALATABLE_CONCLUSIONS).toContain("failure");
    expect(ESCALATABLE_CONCLUSIONS).toContain("timed_out");
    expect(ESCALATABLE_CONCLUSIONS).toContain("startup_failure");
  });

  it("does not escalate a run cancelled by concurrency supersession", () => {
    const decision = classifyConclusion("cancelled");
    expect(decision.escalate).toBe(false);
    // The reason must name the actual mechanism, so the skip stays auditable.
    expect(decision.reason).toMatch(/cancel-in-progress/i);
    expect(decision.reason).toMatch(/superseded/i);
  });

  it("does not escalate other benign conclusions", () => {
    for (const conclusion of ["success", "skipped", "neutral", "stale", "action_required"]) {
      expect(classifyConclusion(conclusion).escalate, conclusion).toBe(false);
    }
  });

  it("fails open on a missing or unrecognized conclusion", () => {
    // A new GitHub conclusion, or no conclusion at all, must never be assumed
    // benign: losing an alert is worse than an occasional duplicate.
    for (const conclusion of ["", "  ", "some_future_conclusion", undefined, null, 42]) {
      expect(classifyConclusion(conclusion as string).escalate, String(conclusion)).toBe(true);
    }
  });

  it("gives every exempted conclusion a non-empty reason", () => {
    const blank = Object.entries(IGNORED_CONCLUSION_REASONS)
      .filter(([, reason]) => !String(reason).trim())
      .map(([name]) => name);
    expect(blank).toEqual([]);
    expect(Object.keys(IGNORED_CONCLUSION_REASONS).length).toBeGreaterThan(0);
    // The exemptions must not overlap the escalatable set.
    for (const name of Object.keys(IGNORED_CONCLUSION_REASONS)) {
      expect(ESCALATABLE_CONCLUSIONS).not.toContain(name);
    }
  });

  it("skips a cancelled run end-to-end without touching the network", async () => {
    const { impl, calls } = fakeFetch([{ status: 200, body: { id: "should-not-be-called" } }]);
    const { logs, log } = collectLogs();
    const result = await reportFailure({
      run: runFixture("cancelled"),
      jobs: { jobs: [jobFixture("verify", "cancelled")] },
      apiToken: "token",
      listId: "list",
      fetchImpl: impl,
      log,
      sleep: noSleep,
    });
    expect(result.action).toBe("skipped-non-failure");
    expect(result.exitCode).toBe(0);
    expect(calls).toEqual([]);
    expect(logs.join("\n")).toMatch(/superseded/i);
  });
});

/**
 * Job names drive the task title, so they must describe what actually failed.
 * A run that fails while its sibling jobs are torn down must not name the
 * siblings as failures.
 */
describe("failed-job selection", () => {
  it("names only the jobs that genuinely failed", () => {
    const selected = selectFailedJobs([
      jobFixture("verify", "failure"),
      jobFixture("cancelled-sibling", "cancelled"),
      jobFixture("skipped-sibling", "skipped"),
      jobFixture("green-sibling", "success"),
      jobFixture("timed-out-sibling", "timed_out"),
    ]);
    expect(selected.names).toEqual(["timed-out-sibling", "verify"]);
    expect(selected.total).toBe(2);
  });

  it("sorts, dedupes and caps the job list for the title", () => {
    const jobs = [
      jobFixture("zeta", "failure"),
      jobFixture("alpha", "failure"),
      jobFixture("alpha", "failure"),
      jobFixture("mid", "failure"),
      jobFixture("beta", "failure"),
      jobFixture("omega", "failure"),
    ];
    const selected = selectFailedJobs(jobs);
    expect(selected.names).toHaveLength(MAX_JOBS_IN_TITLE);
    expect(selected.names).toEqual(["alpha", "beta", "mid", "omega"]);
    expect(selected.omitted).toBe(1);
    expect(selected.total).toBe(5);
  });

  it("tolerates every shape `gh api` can return", () => {
    const jobs = [jobFixture("verify", "failure")];
    const shapes: unknown[] = [
      { jobs },
      [{ jobs }],
      [[{ jobs }]],
      jobs,
      JSON.stringify({ jobs }),
      JSON.stringify([{ jobs }]),
    ];
    for (const shape of shapes) {
      expect(selectFailedJobs(normalizeJobsPayload(shape)).names, JSON.stringify(shape)).toEqual(["verify"]);
    }
  });

  it("degrades to no job names instead of throwing on unusable input", () => {
    for (const garbage of ["not json at all", "", null, undefined, 42, { unexpected: true }]) {
      expect(normalizeJobsPayload(garbage as unknown)).toEqual([]);
    }
    expect(selectFailedJobs(normalizeJobsPayload("not json")).names).toEqual([]);
  });

  it("still escalates when no failed job name can be determined", async () => {
    // Fail open: an unusable jobs payload must not suppress a real failure.
    const { logs, log } = collectLogs();
    const result = await reportFailure({
      run: runFixture("failure"),
      jobs: "unparseable",
      dryRun: true,
      log,
    });
    expect(result.action).toBe("dry-run");
    expect(result.title).toContain("unknown");
    expect(logs.join("\n")).toMatch(/no individually-failed job names/i);
  });
});

/**
 * The title is the human-facing summary and doubles as the dedupe identity, so
 * it must be deterministic for a given sha/conclusion/job-set.
 */
describe("escalation task identity", () => {
  it("builds a title naming the conclusion, failed jobs and short sha", () => {
    const title = buildTaskTitle({
      conclusion: "failure",
      jobNames: ["verify"],
      omitted: 0,
      sha: SHA,
    });
    expect(title).toBe("Investigate CI failure: verify [340d2a3]");
  });

  it("records how many job names were truncated", () => {
    const title = buildTaskTitle({
      conclusion: "timed_out",
      jobNames: ["a", "b", "c", "d"],
      omitted: 3,
      sha: SHA,
    });
    expect(title).toContain("+3 more");
    expect(title).toContain("[340d2a3]");
  });

  it("keeps the key stable across job ordering and sensitive to real changes", () => {
    const base = { sha: SHA, conclusion: "failure" };
    expect(dedupeKey({ ...base, jobNames: ["verify", "build"] })).toBe(
      dedupeKey({ ...base, jobNames: ["build", "verify"] }),
    );
    expect(dedupeKey({ ...base, jobNames: ["verify"] })).not.toBe(
      dedupeKey({ ...base, jobNames: ["build"] }),
    );
    expect(dedupeKey({ ...base, jobNames: ["verify"] })).not.toBe(
      dedupeKey({ sha: "ffffffffffffffff", conclusion: "failure", jobNames: ["verify"] }),
    );
    expect(dedupeKey({ ...base, jobNames: ["verify"] })).not.toBe(
      dedupeKey({ sha: SHA, conclusion: "timed_out", jobNames: ["verify"] }),
    );
    // Must be safe to embed in a title/description and to search for.
    expect(dedupeKey(base)).toMatch(/^[a-z0-9-]+$/);
  });

  it("writes metadata-only task bodies with a traceable escalation key", () => {
    const key = dedupeKey({ sha: SHA, conclusion: "failure", jobNames: ["verify"] });
    const description = buildTaskDescription({
      conclusion: "failure",
      jobNames: ["verify"],
      omitted: 0,
      sha: SHA,
      branch: "main",
      runUrl: RUN_URL,
      key,
    });
    expect(description).toContain(`ci-escalation-key: ${key}`);
    expect(description).toContain(RUN_URL);
    expect(description).toContain("**Branch:** main");
    expect(description).toContain("/commit/340d2a31871d4a8f4c1f6e4c4a9a0f7f2a9c3b21");
    expect(description).toContain("## Fix protocol");
    // Diagnostics stay in Actions; the body must not claim to carry logs.
    expect(description).toContain("not copied into ClickUp");
  });
});

/**
 * The severity model the old inline-bash version got wrong.
 *
 * "Not configured" is a setup gap a human must close; "configured but could not
 * deliver" is a genuinely lost alert. They must not collapse into the same
 * outcome, and neither may silently swallow a real CI failure.
 */
describe("escalation delivery semantics", () => {
  const configured = { apiToken: "pk_test_token", listId: "9013267890" };

  it("warns and exits zero when the notifier is unconfigured", async () => {
    const { impl, calls } = fakeFetch([{ status: 200, body: {} }]);
    const { logs, log } = collectLogs();
    const result = await reportFailure({
      run: runFixture("failure"),
      jobs: { jobs: [jobFixture("verify", "failure")] },
      fetchImpl: impl,
      log,
      sleep: noSleep,
    });
    // Exit 0: a configuration gap must not masquerade as a CI failure.
    expect(result.action).toBe("skipped-unconfigured");
    expect(result.exitCode).toBe(0);
    expect(result.missingSecrets).toEqual(["CLICKUP_API_TOKEN", "CLICKUP_LIST_ID"]);
    expect(calls).toEqual([]);
    expect(logs.join("\n")).toMatch(/NOT escalated/i);
  });

  it("names only the secret that is actually missing", () => {
    expect(inspectSecrets({ apiToken: "t", listId: "l" })).toEqual({ configured: true, missing: [] });
    expect(inspectSecrets({ apiToken: "  ", listId: "l" }).missing).toEqual(["CLICKUP_API_TOKEN"]);
    expect(inspectSecrets({ apiToken: "t" }).missing).toEqual(["CLICKUP_LIST_ID"]);
    expect(inspectSecrets({}).missing).toEqual(["CLICKUP_API_TOKEN", "CLICKUP_LIST_ID"]);
  });

  it("creates the task and exits zero on a clean escalation", async () => {
    const { impl, calls } = fakeFetch([
      { status: 200, body: { tasks: [] } },
      { status: 200, body: { id: "86xyz123", name: "created" } },
    ]);
    const result = await reportFailure({
      run: runFixture("failure"),
      jobs: { jobs: [jobFixture("verify", "failure")] },
      ...configured,
      fetchImpl: impl,
      sleep: noSleep,
    });
    expect(result.action).toBe("escalated");
    expect(result.exitCode).toBe(0);
    expect(result.taskId).toBe("86xyz123");
    expect(calls).toHaveLength(2);
    expect(calls[0].method).toBe("GET");
    expect(calls[0].url).toContain(`/list/${configured.listId}/task`);
    expect(calls[0].url).toContain("search_task=340d2a3");
    expect(calls[1].method).toBe("POST");
    expect(calls[1].url).toContain(`/list/${configured.listId}/task`);
    expect(calls[1].url).not.toContain("search_task=");
    const body = JSON.parse(calls[1].body ?? "{}") as TaskPayload;
    expect(body.name).toBe("Investigate CI failure: verify [340d2a3]");
    expect(body.priority).toBe(2);
    expect(body.notify_all).toBe(false);
  });
});

/**
 * Robustness rules that decide whether a real alert survives. Duplicate tasks
 * are an annoyance; a lost alert is a defect. Every ambiguity therefore
 * resolves toward escalating.
 */
describe("escalation robustness", () => {
  const configured = { apiToken: "pk_test_token", listId: "9013267890" };
  const failedRun = { jobs: [jobFixture("verify", "failure")] };

  it("suppresses a duplicate escalation for the same run, conclusion and jobs", async () => {
    const title = buildTaskTitle({ conclusion: "failure", jobNames: ["verify"], omitted: 0, sha: SHA });
    const { impl, calls } = fakeFetch([{ status: 200, body: { tasks: [{ id: "86dup", name: title }] } }]);
    const result = await reportFailure({
      run: runFixture("failure"),
      jobs: failedRun,
      ...configured,
      fetchImpl: impl,
      sleep: noSleep,
    });
    expect(result.action).toBe("duplicate-suppressed");
    expect(result.exitCode).toBe(0);
    expect(result.duplicateTaskId).toBe("86dup");
    // Search only — no second task was created.
    expect(calls.map((call) => call.method)).toEqual(["GET"]);
  });

  it("fails open when the dedupe lookup breaks, still creating the task", async () => {
    const { impl, calls } = fakeFetch([
      // The search must fail on every retry attempt before the reporter gives
      // up on dedupe and creates the task anyway.
      ...Array.from({ length: MAX_ATTEMPTS }, () => new Error("network unreachable")),
      { status: 200, body: { id: "86created" } },
    ]);
    const { logs, log } = collectLogs();
    const result = await reportFailure({
      run: runFixture("failure"),
      jobs: failedRun,
      ...configured,
      fetchImpl: impl,
      log,
      sleep: noSleep,
    });
    expect(result.action).toBe("escalated");
    expect(result.exitCode).toBe(0);
    expect(calls.map((call) => call.method)).toContain("POST");
    expect(logs.join("\n")).toMatch(/creating the task anyway/i);
  });

  it("retries a transient server error and still delivers", async () => {
    const { impl, calls } = fakeFetch([
      { status: 200, body: { tasks: [] } },
      { status: 503, body: { err: "unavailable" } },
      { status: 200, body: { id: "86retry" } },
    ]);
    const result = await reportFailure({
      run: runFixture("failure"),
      jobs: failedRun,
      ...configured,
      fetchImpl: impl,
      sleep: noSleep,
    });
    expect(result.action).toBe("escalated");
    expect(result.taskId).toBe("86retry");
    expect(calls.map((call) => call.method)).toEqual(["GET", "POST", "POST"]);
  });

  it("fails closed with exit 1 when a configured notifier loses the alert", async () => {
    const { impl, calls } = fakeFetch([
      { status: 200, body: { tasks: [] } },
      { status: 401, body: { err: "Unauthorized" } },
    ]);
    const { logs, log } = collectLogs();
    const result = await reportFailure({
      run: runFixture("failure"),
      jobs: failedRun,
      ...configured,
      fetchImpl: impl,
      log,
      sleep: noSleep,
    });
    expect(result.action).toBe("delivery-failed");
    expect(result.exitCode).toBe(1);
    expect(result.detail).toContain("401");
    expect(logs.join("\n")).toMatch(/ALERT LOST/);
    // A 4xx rejection is permanent; it must not be retried into oblivion.
    expect(calls.map((call) => call.method)).toEqual(["GET", "POST"]);
  });

  it("performs no network I/O in dry-run mode", async () => {
    const { impl, calls } = fakeFetch([{ status: 200, body: {} }]);
    const result = await reportFailure({
      run: runFixture("failure"),
      jobs: failedRun,
      ...configured,
      fetchImpl: impl,
      dryRun: true,
    });
    expect(result.action).toBe("dry-run");
    expect(result.exitCode).toBe(0);
    expect(result.payload?.name).toBe("Investigate CI failure: verify [340d2a3]");
    expect(calls).toEqual([]);
  });
});

/** The retry predicate itself: what counts as transient is a policy decision. */
describe("transient-error retry policy", () => {
  type OpResult = { status: number; ok: boolean; text: string; error?: string };

  async function run(operation: () => Promise<OpResult>) {
    let attempts = 0;
    const result = await withRetries(
      async () => {
        attempts += 1;
        return operation();
      },
      { attempts: 3, backoffMs: 0, sleep: noSleep },
    );
    return { result, attempts };
  }

  it("retries 5xx, 429 and a missing status, and gives up after the attempt cap", async () => {
    for (const status of [500, 502, 503, 429, 0]) {
      const { attempts, result } = await run(async () => ({ status, ok: false, text: "" }));
      expect(attempts, `status ${status}`).toBe(3);
      expect(result.status).toBe(status);
    }
  });

  it("treats a 4xx rejection and a success as final", async () => {
    for (const status of [200, 201, 400, 401, 403, 404]) {
      const { attempts } = await run(async () => ({ status, ok: status < 300, text: "" }));
      expect(attempts, `status ${status}`).toBe(1);
    }
  });

  it("surfaces the transport error when every attempt throws", async () => {
    const { attempts, result } = await run(async () => {
      throw new Error("socket hang up");
    });
    expect(attempts).toBe(3);
    expect(result.status).toBe(0);
    expect(result.error).toContain("socket hang up");
  });
});

/**
 * Wiring and security invariants for the workflow that hosts the reporter.
 *
 * The reporter is only correct while (a) the workflow actually calls it rather
 * than reimplementing policy inline, and (b) it never executes untrusted code,
 * since a workflow_run job can read repository secrets.
 */
describe("ci-to-clickup workflow wiring", () => {
  const workflow = read(".github/workflows/ci-to-clickup.yml");
  const steps = workflow.split(/\n(?= {6}- )/);
  const checkout = steps.find((block) => block.includes("actions/checkout"));
  const escalate = steps.find((block) => block.includes("Escalate the failure to ClickUp"));
  const collect = steps.find((block) => block.includes("job conclusions"));

  it("delegates escalation policy to the tested script", () => {
    expect(workflow).toContain("npm run ci:failure-report");
    // The old inline policy must not creep back in: it hard-failed on missing
    // secrets and filtered cancelled runs in bash, untested.
    expect(workflow).not.toContain("Missing repository secret");
    expect(workflow).not.toContain("api.clickup.com");
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["ci:failure-report"]).toBe("node scripts/ci-failure-report.js");
  });

  it("never checks out the untrusted triggering head", () => {
    expect(checkout, "the reporter must check out code to run").toBeDefined();
    // A workflow_run job can read secrets; executing the PR head would let an
    // untrusted branch run arbitrary code with CLICKUP_API_TOKEN present.
    expect(checkout).not.toMatch(/\bref:/);
    expect(workflow).not.toMatch(/ref:\s*\$\{\{\s*github\.event\.workflow_run\.head/);
    expect(workflow).not.toContain("workflow_run.head_sha }}\n        with:");
    expect(checkout).toContain("default branch");
  });

  it("passes the untrusted head only as data", () => {
    expect(escalate).toBeDefined();
    expect(escalate).toContain("toJSON(github.event.workflow_run)");
    expect(escalate).toContain("--run-file");
    expect(escalate).toContain("--jobs-file");
  });

  it("keeps cancelled runs reaching the job so the skip is logged, not silent", () => {
    // The filter is in the script (tested above); the trigger must still hand
    // cancelled runs over so the reporter can record why it skipped them.
    const jobIf = workflow.match(/if:\s*>-([\s\S]*?)\n\s{4}runs-on:/)?.[1] ?? "";
    for (const conclusion of ["failure", "timed_out", "startup_failure", "cancelled"]) {
      expect(jobIf, `job if must accept ${conclusion}`).toContain(`'${conclusion}'`);
    }
    expect(jobIf).not.toContain("'success'");
    expect(jobIf).not.toContain("'skipped'");
  });

  it("fails open when job metadata cannot be collected", () => {
    expect(collect).toBeDefined();
    expect(collect).toContain("|| {");
    expect(collect).toContain('{"jobs":[]}');
    expect(collect).toContain("--paginate");
  });

  it("holds least privilege and bounds the job", () => {
    expect(workflow).toMatch(/permissions:\n\s+actions: read\n\s+contents: read/);
    expect(workflow).not.toMatch(/contents:\s*write/);
    expect(workflow).not.toMatch(/pull-requests:\s*write/);
    expect(workflow).not.toMatch(/id-token:\s*write/);
    expect(workflow).toMatch(/timeout-minutes:\s*\d+/);
    expect(workflow).toMatch(/concurrency:\n\s+group:\s*ci-to-clickup-\$\{\{ github\.event\.workflow_run\.id \}\}/);
  });

  it("pins the ci.yml behaviour that justifies exempting cancelled runs", () => {
    // The cancelled exemption is only sound because ci.yml cancels superseded
    // runs. If that ever changes, a cancellation becomes meaningful again and
    // this exemption must be re-examined rather than silently kept.
    const ci = read(".github/workflows/ci.yml");
    expect(ci).toMatch(/cancel-in-progress:\s*true/);
    expect(IGNORED_CONCLUSION_REASONS.cancelled).toMatch(/cancel-in-progress/i);
  });
});

/**
 * The escalation contract used to be undocumented — "ClickUp" appeared nowhere
 * in README.md or docs/. A notifier nobody can find is a notifier nobody fixes,
 * which is how it stayed dead for its entire life. These assertions keep the
 * document and the code's policy in sync in both directions.
 */
describe("escalation contract documentation", () => {
  const governance = read("docs/repository-governance.md");

  it("documents the escalation policy and where it is implemented", () => {
    expect(governance).toContain("## CI failure escalation");
    expect(governance).toContain(".github/workflows/ci-to-clickup.yml");
    expect(governance).toContain("scripts/ci-failure-report.js");
    expect(governance).toContain("tests/ci-failure-report.test.ts");
    expect(governance).toContain("npm run ci:failure-report");
  });

  it("records why cancelled runs are not escalated", () => {
    expect(governance).toContain("**Not escalated:** `cancelled`");
    expect(governance).toMatch(/cancel-in-progress/);
  });

  it("records the required secrets and that escalation is disabled without them", () => {
    expect(governance).toContain("CLICKUP_API_TOKEN");
    expect(governance).toContain("CLICKUP_LIST_ID");
    expect(governance).toContain("Escalation is **disabled**");
  });

  it("records the workflow_run checkout security constraint", () => {
    expect(governance).toContain("### Security constraint");
    expect(governance).toContain("github.event.workflow_run.head_sha");
    expect(governance).toMatch(/untrusted pull request/);
  });

  it("documents every conclusion the code classifies", () => {
    // Adding an exemption in code without documenting it fails here, and so
    // does documenting a conclusion the code no longer honours.
    for (const conclusion of ESCALATABLE_CONCLUSIONS) {
      expect(governance, `${conclusion} must be documented`).toContain(`\`${conclusion}\``);
    }
    for (const conclusion of Object.keys(IGNORED_CONCLUSION_REASONS)) {
      expect(governance, `${conclusion} must be documented`).toContain(`\`${conclusion}\``);
    }
  });
});





