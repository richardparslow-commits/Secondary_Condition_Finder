/**
 * Scheduled watch for the published privacy-request channel (gate C / issue #539).
 *
 *   node scripts/watch-privacy-channel.mjs                     # observe and compare against the accepted state
 *   node scripts/watch-privacy-channel.mjs --json
 *   node scripts/watch-privacy-channel.mjs --github-output="$GITHUB_OUTPUT"
 *   node scripts/watch-privacy-channel.mjs --record --accept-dead="why" --review-by=YYYY-MM-DD
 *
 * Why this exists. The 2026-10-15 finding recorded that `privacy@secondaryconditionfinder.org` is
 * at a domain that does not resolve, so the published promise reaches nobody. That finding is a
 * dated reading, and a reading goes stale: once the operator registers the name, operates the
 * mailbox and publishes MX, the channel can break again — a lapsed registration, a deleted MX
 * record, a mailbox that stops accepting mail — and nothing in this repository would notice. A
 * dead channel that nobody is told about is the exact failure this gate exists to prevent, so the
 * gate gets a watch rather than only a document.
 *
 * What it owns, and what it deliberately does not. The *readings* belong to
 * [`verify-privacy-channel.mjs`](verify-privacy-channel.mjs), which is run here as a child process
 * and never reimplemented — one owner of the external facts. This script owns only the transition
 * semantics: what a reading means relative to the last **accepted** state, and whether a human must
 * be told. It reads no mailbox and sends no mail, so it can never substitute for the procedure's §8
 * step 4 (a real message from outside the domain, in the operator's own hands).
 *
 * The accepted state is a committed file, not something a scheduled run writes for itself. That is
 * the load-bearing property: a monitor whose own run can silently re-baseline is a monitor that can
 * hide a regression, so `--record` is the only path that changes acceptance and a **dead
 * observation cannot be recorded without a reason and a review date** (`--accept-dead` +
 * `--review-by`) — the operator has to say why the channel is allowed to stay dead, and until when.
 * Past that date a still-dead channel stops being a pending action and becomes an unaddressed one,
 * which is why `pending-expired` raises on its own.
 *
 * Verdicts (and what the scheduled run does with each):
 *
 *   green            deliverable, and acceptance says live            exit 0, no alert
 *   known-open       dead, acceptance says dead and the review date has not passed
 *                                                                      exit 0, no alert (recorded, tracked by #539)
 *   recovered        deliverable, acceptance still says dead           exit 0, ALERT — the channel is live;
 *                                                                      steps 1–3 are done, record the state, and
 *                                                                      the gate's step 4 is now runnable
 *   regression       dead, acceptance says live                        exit 1, ALERT — it worked and stopped
 *   pending-expired  dead, acceptance said dead, review date passed    exit 1, ALERT — the decision outlived its date
 *   could-not-run    the verifier could not read the facts             exit 2, ALERT — never a channel verdict
 *
 * A failed reading is reported as a watch fault rather than as a channel verdict, the same
 * distinction the live regression monitor draws between a regression and a monitor that cannot run.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const VERIFIER = resolve(HERE, "verify-privacy-channel.mjs");
export const DEFAULT_STATE_PATH = resolve(HERE, "..", "docs", "privacy-channel-watch-state.json");
const VERIFIER_TIMEOUT_MS = 60_000;

/**
 * Decide what one observation means against the accepted state. Pure, so the jurisdiction of every
 * verdict is testable without a resolver, and so the scheduled run cannot quietly change them.
 *
 * @param {{ observation?: any, accepted?: any, now?: Date }} input
 *   A partial reading, deliberately: an absent observation or accepted state is one of the verdicts
 *   (§could-not-run), so requiring them in the type would make the fail-closed paths uncallable.
 */
export function classify({ observation, accepted, now = new Date() }) {
  if (!observation || observation.couldNotRun) {
    return {
      status: "could-not-run",
      exitCode: 2,
      alert: true,
      headline: "Privacy channel watch could not read the facts",
      detail: observation?.reasons?.join("; ") || "the verifier produced no usable reading",
    };
  }
  if (!accepted || !accepted.expected) {
    // Fail closed: without an accepted state there is no baseline to compare against, and inventing
    // one would mean a scheduled run deciding what counts as healthy.
    return {
      status: "could-not-run",
      exitCode: 2,
      alert: true,
      headline: "Privacy channel watch has no accepted state",
      detail: `no readable accepted state at ${accepted?.path || DEFAULT_STATE_PATH}; record one with --record`,
    };
  }

  const expectedLive = accepted.expected === "live";
  if (observation.deliverable) {
    return expectedLive
      ? {
          status: "green",
          exitCode: 0,
          alert: false,
          headline: "Privacy channel is deliverable (as accepted)",
          detail: "a mail route exists; the gate's step 4 send/receive test remains a human act",
        }
      : {
          status: "recovered",
          exitCode: 0,
          alert: true,
          headline: "Privacy channel is now deliverable",
          detail:
            "acceptance still records the channel as dead, but a mail route now exists: steps 1–3 of the fulfilment procedure §8 appear to be done. Record the new state with `--record`, then run step 4 (a real message from outside the domain) and record the sanitized outcome in the gate C record.",
        };
  }

  if (expectedLive) {
    return {
      status: "regression",
      exitCode: 1,
      alert: true,
      headline: "Privacy channel stopped being deliverable",
      detail: `it was accepted as live and is now unreachable: ${observation.reasons.join("; ")}`,
    };
  }

  const reviewBy = accepted.reviewBy ? new Date(`${accepted.reviewBy}T23:59:59Z`) : null;
  if (reviewBy && now.getTime() > reviewBy.getTime()) {
    return {
      status: "pending-expired",
      exitCode: 1,
      alert: true,
      headline: `Privacy channel is still dead past its review date (${accepted.reviewBy})`,
      detail: `acceptance recorded a pending operator action with the reason "${accepted.reason || "unspecified"}". That date has passed: this is no longer a pending action, it is an unaddressed one — ${observation.reasons.join("; ")}`,
    };
  }

  return {
    status: "known-open",
    exitCode: 0,
    alert: false,
    headline: `Privacy channel is dead, as recorded (review by ${accepted.reviewBy || "unset"})`,
    detail: `tracked by ${accepted.gate || "the gate C record"}: ${observation.reasons.join("; ")}`,
  };
}

/**
 * The accepted state after a `--record`. A dead observation may only be accepted with a reason and a
 * review date: that is the guard against the shortcut this whole script exists to make impossible —
 * re-baselining a dead channel so a run looks settled.
 *
 * @param {{ observation?: any, acceptDead?: any, reviewBy?: any, reason?: any, gate?: any, recordedBy?: any, now?: Date }} input
 *   Every guard field is optional in the type because the function's job is to refuse their absence:
 *   `acceptDead`, `reason` and `reviewBy` missing is the shortcut this must throw on, not a caller bug
 *   the compiler should have caught first.
 */
export function nextAcceptedState({ observation, acceptDead, reviewBy, reason, gate, recordedBy, now = new Date() }) {
  if (!observation || observation.couldNotRun) {
    throw new Error("refusing to record: the observation itself could not be read");
  }
  if (observation.deliverable) {
    return {
      expected: "live",
      acceptedAt: now.toISOString().slice(0, 10),
      acceptedBy: recordedBy || "unattributed",
      gate: gate || "#539 (gate C)",
      reason: "a mail route exists for the published address",
    };
  }
  if (!acceptDead) {
    throw new Error("refusing to record a dead channel without --accept-dead (the channel would look settled while the promise is undeliverable)");
  }
  if (!reason) throw new Error("refusing to record a dead channel without --accept-dead=\"<reason>\"");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(reviewBy || ""))) {
    throw new Error("refusing to record a dead channel without --review-by=YYYY-MM-DD");
  }
  return {
    expected: "dead",
    acceptedAt: now.toISOString().slice(0, 10),
    acceptedBy: recordedBy || "unattributed",
    gate: gate || "#539 (gate C)",
    reason,
    reviewBy,
  };
}

/** Run the verifier and reduce its JSON to the observation this script reasons about. */
export function observe({ timeoutMs = VERIFIER_TIMEOUT_MS } = {}) {
  const run = spawnSync(process.execPath, [VERIFIER, "--json"], { encoding: "utf8", timeout: timeoutMs });
  const stdout = run.stdout || "";
  let parsed = null;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return {
      couldNotRun: true,
      reasons: [`the verifier produced no readable JSON (exit ${run.status ?? "none"}; ${(run.stderr || run.error || "").toString().slice(0, 120)})`],
    };
  }
  const code = parsed.verdict?.code;
  return {
    couldNotRun: code === 2,
    deliverable: code === 0,
    reasons: parsed.verdict?.reasons || [],
    address: parsed.address,
    registry: parsed.registry,
    mx: parsed.dns?.mx || [],
    nameExists: parsed.dns?.nameExists === true,
    readAt: parsed.at,
  };
}

function readAccepted(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return { ...parsed, path };
  } catch {
    return { path, error: "unreadable" };
  }
}

function report({ verdict, observation, accepted, mode }) {
  const lines = [
    `## Privacy channel watch — ${verdict.headline}`,
    ``,
    `- Verdict: **${verdict.status}** (exit ${verdict.exitCode}${verdict.alert ? ", a human is told" : ", nothing new"})`,
    `- Published address: \`${observation?.address || "unknown"}\``,
    `- Read at: ${observation?.readAt || new Date().toISOString()}`,
    `- Accepted state: ${accepted?.expected ? `expected ${accepted.expected}${accepted.reviewBy ? `, review by ${accepted.reviewBy}` : ""}` : "none recorded"}`,
    `- Registry (.org): subject HTTP ${observation?.registry?.subject ?? "error"} / control HTTP ${observation?.registry?.control ?? "error"}`,
    `- MX: ${observation?.mx?.length ? JSON.stringify(observation.mx) : "none — no mail route"}`,
    mode ? `- Mode: ${mode}` : ``,
    ``,
    verdict.detail,
    ``,
    `This watch reports on a channel, not on the promise: it cannot see a mailbox, so a green or`,
    `\`known-open\` run is never evidence that a request would be read or answered. §8 step 4 — a real`,
    `message sent from outside the domain to the published address — stays a human act, and the`,
    `sanitized outcome of it belongs in the gate C record.`,
  ];
  return lines.filter((line) => line !== "").join("\n");
}

function main() {
  const argv = process.argv.slice(2);
  const has = (flag) => argv.includes(flag);
  const value = (name) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.split("=").slice(1).join("=") : undefined;
  };
  if (has("--help") || has("-h")) {
    console.log(
      "usage: node scripts/watch-privacy-channel.mjs [--json] [--github-output=FILE] [--state=FILE] [--record --accept-dead=\"why\" --review-by=YYYY-MM-DD]"
    );
    return 0;
  }

  const statePath = value("state") || DEFAULT_STATE_PATH;
  const observation = observe({ timeoutMs: Number(value("timeout") || VERIFIER_TIMEOUT_MS) });
  let accepted = readAccepted(statePath);

  // Recording is a human act. The observation is written alongside acceptance either way, so the
  // file always shows what was last seen without ever implying it was accepted.
  if (has("--record")) {
    const next = nextAcceptedState({
      observation,
      acceptDead: value("accept-dead"),
      reviewBy: value("review-by"),
      reason: value("accept-dead"),
      gate: value("gate"),
      recordedBy: value("by") || process.env.GITHUB_ACTOR,
    });
    accepted = { ...next, path: statePath };
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(
      statePath,
      `${JSON.stringify(
        {
          purpose:
            "Accepted state for scripts/watch-privacy-channel.mjs. `expected` is what the published privacy-request channel has been accepted as; `reviewBy` is the date by which a dead channel must stop being a pending operator action. Written only by --record.",
          ...accepted,
          lastObservedAt: observation.readAt || new Date().toISOString(),
          lastObserved: { deliverable: !!observation.deliverable, registrySubject: observation.registry?.subject ?? null, mx: observation.mx || [], reasons: observation.reasons || [] },
        },
        null,
        2
      )}\n`
    );
    console.log(`recorded accepted state (${accepted.expected}) → ${statePath}`);
  }

  const verdict = classify({ observation, accepted });
  const mode = has("--record") ? `recorded ${accepted.expected}` : undefined;

  if (has("--json")) {
    console.log(JSON.stringify({ verdict, observation, accepted: { expected: accepted.expected, reviewBy: accepted.reviewBy, gate: accepted.gate, path: accepted.path } }, null, 2));
  } else {
    console.log(report({ verdict, observation, accepted, mode }));
  }
  const outputFile = value("github-output");
  if (outputFile) {
    const lines = `status=${verdict.status}\nalert=${verdict.alert}\nexit_code=${verdict.exitCode}\nheadline=${verdict.headline}\n`;
    try {
      writeFileSync(outputFile, lines, { flag: "a" });
    } catch {
      // A missing $GITHUB_OUTPUT is not a watch failure; the run's exit code is the signal.
    }
  }
  return verdict.exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exit(main());
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(2);
  }
}
