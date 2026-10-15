/**
 * Required-status-check resolution for the landing script (`scripts/land.mjs`).
 *
 * The landing script merges only once the base branch's *required* checks are
 * green, and it reads those names from the live branch ruleset rather than
 * hard-coding them so a renamed or newly added check cannot silently weaken the
 * wait. That design only holds if an unreadable ruleset is treated as a hard
 * failure. The previous inline implementation fell through to `[]` on a failed
 * `gh api` call, on a non-JSON or non-array body, and on a ruleset that declared
 * no `required_status_checks` rule — and an empty list meant "watch every check
 * the PR happens to report", so a PR showing only an unrelated or already-green
 * subset was declared "All required check(s) passed" and handed to `gh pr merge`.
 * The ruleset would usually refuse that merge server-side, but the script still
 * reported a gate it had never verified, `--no-merge` reported success, and a
 * base branch whose ruleset is not readable (or not protected at all) had no
 * client-side gate whatsoever.
 *
 * This module is that decision table, kept pure so it can be exercised against
 * synthetic API captures: transport and GitHub are the caller's job, policy is
 * here. Three outcomes are distinguished, and only one of them authorises a
 * merge:
 *
 *   - **read, with a non-empty check list** — the names are returned, with the
 *     source named so the operator can see where the gate came from;
 *   - **read, declaring nothing** — classic branch protection is consulted as a
 *     fallback, because this repository's older deployments gate merges there;
 *     if it declares checks those are used, otherwise this throws, because
 *     "nothing is required" is not a gate the script can verify;
 *   - **not readable, or unreadable in shape** — always throws, with the
 *     transport detail attached, so the caller can never mistake "I could not
 *     read the gate" for "there is no gate".
 *
 * No failure mode returns an empty list: a caller that wants a merge gate must
 * receive check names or an error.
 *
 * The API paths live here too, shared with the script and its tests, so the two
 * cannot drift apart.
 */

export const LAND_API_PATHS = Object.freeze({
  rules: (ownerRepo, base) => `repos/${ownerRepo}/rules/branches/${base}`,
  protection: (ownerRepo, base) => `repos/${ownerRepo}/branches/${base}/protection`,
});

/** How the required-check list was established, for the script's own logging. */
export const REQUIRED_CHECKS_SOURCE = Object.freeze({
  RULESET: "branch ruleset",
  PROTECTION: "classic branch protection",
});

/** Raised for every "the gate could not be established" outcome. */
export class LandRequiredChecksError extends Error {
  constructor(message) {
    super(message);
    this.name = "LandRequiredChecksError";
  }
}

const READ_FAILED_HINT =
  "The landing script reads required checks from the live ruleset so a renamed or added check cannot silently weaken the wait; an unreadable answer is never treated as \"no required checks\". Check `gh auth status` and the token's access to this repository, then retry.";

/**
 * Classify one captured `gh api` call. A non-zero exit (including GitHub's 403
 * scope failures and 404s), an empty body, and a body that is not JSON are all
 * "not readable" — never "empty list".
 *
 * @param {{ status?: number | null, stdout?: string, stderr?: string } | null | undefined} capture
 * @returns {{ ok: true, body: unknown } | { ok: false, detail: string }}
 */
export function readJsonCapture(capture) {
  const status = typeof capture?.status === "number" ? capture.status : null;
  const stdout = String(capture?.stdout ?? "");
  const stderr = String(capture?.stderr ?? "").trim();
  const firstStderrLine = stderr.split("\n").map((line) => line.trim()).filter(Boolean)[0];

  if (status === null) {
    return { ok: false, detail: "the read did not report an exit status" };
  }
  if (status !== 0) {
    return {
      ok: false,
      detail: `the read failed (exit ${status})${firstStderrLine ? `: ${firstStderrLine}` : ""}`,
    };
  }
  const text = stdout.trim();
  if (text === "") return { ok: false, detail: "the read returned an empty body" };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, detail: "the read returned a body that is not JSON" };
  }
}

/**
 * Read the contexts out of `GET /repos/{owner}/{repo}/rules/branches/{branch}`,
 * whose payload is an array of the rules active for that branch. A non-array
 * body is unreadable rather than empty: GitHub answers this endpoint with an
 * object (for example `{"message":"Not Found"}`) when the request is refused,
 * and treating that as "no required checks" is exactly the fail-open bug.
 *
 * @param {unknown} body
 * @returns {{ ok: true, declaresRule: boolean, contexts: string[] } | { ok: false, detail: string }}
 */
export function contextsFromRules(body) {
  if (!Array.isArray(body)) {
    return {
      ok: false,
      detail: `the active-rules payload was not an array (received ${describe(body)})`,
    };
  }
  const declaresRule = body.some((rule) => rule?.type === "required_status_checks");
  const contexts = new Set();
  for (const rule of body) {
    if (rule?.type !== "required_status_checks") continue;
    for (const check of rule?.parameters?.required_status_checks ?? []) {
      if (typeof check?.context === "string" && check.context.trim() !== "") {
        contexts.add(check.context.trim());
      }
    }
  }
  return { ok: true, declaresRule, contexts: [...contexts] };
}

/**
 * Read classic branch protection. GitHub returns the full protection object once
 * the branch is protected (with `required_status_checks` possibly `null`), and
 * 404s with "Branch not protected" when protection is off — the one case where
 * "no checks declared" is a definitive answer rather than an unknown.
 *
 * @param {{ status?: number | null, stdout?: string, stderr?: string } | null | undefined} capture
 * @returns {{ state: "read", contexts: string[] } | { state: "disabled" } | { state: "unreadable", detail: string }}
 */
export function protectionRead(capture) {
  const capture_ = readJsonCapture(capture);
  if (!capture_.ok) {
    const stderr = String(capture?.stderr ?? "");
    const notProtected = capture?.status !== 0 && /not protected|HTTP 404/i.test(stderr);
    if (notProtected) return { state: "disabled" };
    return { state: "unreadable", detail: capture_.detail };
  }
  const body = capture_.body;
  if (!isPlainObject(body)) {
    return { state: "unreadable", detail: `the protection payload was not an object (received ${describe(body)})` };
  }
  const required = body.required_status_checks;
  if (required !== null && required !== undefined && !isPlainObject(required)) {
    return {
      state: "unreadable",
      detail: `the protection payload's required_status_checks was not an object (received ${describe(required)})`,
    };
  }
  const contexts = new Set();
  for (const context of isPlainObject(required) ? required.contexts ?? [] : []) {
    if (typeof context === "string" && context.trim() !== "") contexts.add(context.trim());
  }
  // Modern payloads also list app-bound checks alongside the plain contexts.
  for (const check of isPlainObject(required) ? required.checks ?? [] : []) {
    if (typeof check?.context === "string" && check.context.trim() !== "") {
      contexts.add(check.context.trim());
    }
  }
  return { state: "read", contexts: [...contexts] };
}

/**
 * Establish the branch's required status checks, or throw.
 *
 * @param {{ rules: unknown, readProtection: () => unknown, base: string }} params
 *   `rules` and `readProtection()` are captured `gh api` results (or a thunk), and
 *   `readProtection` is only called when the ruleset declares no required checks.
 * @returns {{ names: string[], source: string }}
 */
export function resolveRequiredChecks({ rules, readProtection, base }) {
  const rulesCapture = readJsonCapture(rules);
  if (!rulesCapture.ok) {
    throw new LandRequiredChecksError(
      `could not read the required status checks for '${base}' from the ${REQUIRED_CHECKS_SOURCE.RULESET}: ${rulesCapture.detail}. ${READ_FAILED_HINT}`,
    );
  }
  const fromRules = contextsFromRules(rulesCapture.body);
  if (!fromRules.ok) {
    throw new LandRequiredChecksError(
      `could not read the required status checks for '${base}' from the ${REQUIRED_CHECKS_SOURCE.RULESET}: ${fromRules.detail}. ${READ_FAILED_HINT}`,
    );
  }
  if (fromRules.contexts.length > 0) {
    return { names: fromRules.contexts, source: REQUIRED_CHECKS_SOURCE.RULESET };
  }

  const protection = protectionRead(readProtection());
  if (protection.state === "unreadable") {
    throw new LandRequiredChecksError(
      `the ${REQUIRED_CHECKS_SOURCE.RULESET} declares no required status checks for '${base}', and ${REQUIRED_CHECKS_SOURCE.PROTECTION} could not be read: ${protection.detail}. ${READ_FAILED_HINT}`,
    );
  }
  if (protection.state === "disabled") {
    throw new LandRequiredChecksError(
      `'${base}' declares no required status checks: the ${REQUIRED_CHECKS_SOURCE.RULESET} declares none and ${REQUIRED_CHECKS_SOURCE.PROTECTION} is not enabled. Refusing to continue — with no required checks there is nothing to verify, so "the required checks passed" cannot be established and the script must not merge. Protect '${base}' (a ruleset with a required_status_checks rule, or classic protection) and retry.`,
    );
  }
  if (protection.contexts.length === 0) {
    throw new LandRequiredChecksError(
      `'${base}' declares no required status checks: the ${REQUIRED_CHECKS_SOURCE.RULESET} declares none and ${REQUIRED_CHECKS_SOURCE.PROTECTION} requires no contexts. Refusing to continue — add the check(s) that must gate a merge and retry, or land the PR by hand once you have verified them against the PR's own checks.`,
    );
  }
  return { names: protection.contexts, source: REQUIRED_CHECKS_SOURCE.PROTECTION };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function describe(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "string") return "a string";
  return `a ${typeof value}`;
}
