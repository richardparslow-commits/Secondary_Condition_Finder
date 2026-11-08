#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Citation decay and link-rot audit (npm run citations:decay).
 *
 * Pillar 4 enforcement:
 *  1. Link-rot check — flags references whose sourceUrl fails an HTTP probe
 *     (4xx/5xx, network error, or unresolvable host) by reporting them as
 *     candidates for re-verification. Hard-fails the audit when decayed live
 *     references are found, because a dead URL can never support a nexus.
 *     A verdict of "the host refused to answer" is deliberately NOT decay:
 *     bot-walled hosts (403/405/406) and throttled hosts are reported as
 *     unverifiable-by-probe for that run, with the population and the probe's
 *     resulting coverage disclosed, so the gate never fails on a signal it did
 *     not earn. That distinction is what a full sweep made concrete on
 *     2026-10-14: 201 of ~1,700 single-host (PubMed) requests came back 429 with
 *     `Retry-After: 60`, the probe retried 1.5 s apart regardless, and every one
 *     was reported as a dead link that had not decayed at all. The full record,
 *     including what was and was not reproducible afterwards, is
 *     docs/citation-decay-probe-outcome-policy-2026-10-14.md.
 *  2. Tiered temporal decay — flags references whose sourceCheckedOn is older
 *     than the staleness window for their authorityCategory. Legal authority
 *     is long-lived (statute/regulation/guidance: 1095 days); medical and
 *     scientific evidence decays faster (540 days) because consensus shifts;
 *     procedural guidance sits between (730 days); anything without a
 *     category (mostly legacy rows) keeps the historical 365-day window.
 *     For final Federal Register rules the audit additionally reports
 *     version drift when the recorded ruleVersion/effectiveDate no longer
 *     matches the current CFR identity recorded for that RIN in
 *     data/regulatory-actions (informational — a rule can be superseded
 *     while its URL still resolves).
 *  3. Content drift — when a verified reference records a contentDigest
 *     (self-describing "sha256-<hex>" of the source body captured at human
 *     verification time), the probe hashes the fetched body and flags silent
 *     drift: the URL still returns 200 but the content a human verified has
 *     changed (retraction, correction, revision). This is the failure mode
 *     link-rot probes cannot see. Because a digest may only be recorded by the
 *     qualified human who verified the source, coverage is ratcheted rather
 *     than backfilled: MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS pins the backlog
 *     so it can only shrink, and the report always states how much of the
 *     corpus drift detection can actually see, so a zero drift count is never
 *     mistaken for assurance the probe did not earn.
 *
 *     The ratchet measures the *digest-eligible* backlog only. A digest is
 *     anchored to the reference's `sourceUrl` and checked by re-fetching that
 *     URL, so for some URLs no digest can ever validate: the SOP requires
 *     omitting one there rather than recording a value that false-positives.
 *     Those URLs are declared, per measured class, in
 *     docs/citation-digest-ineligible-classes.json — each class carrying the
 *     two-fetch evidence behind it and a review window — and references inside
 *     a declared class are excluded from the pin while still being counted and
 *     reported. Until 2026-10-14 this item pinned the whole corpus-wide backlog
 *     at 383, which included those classes: that population could not be
 *     reduced by any human action and grew with every legitimate verification
 *     batch, so the weekly gate failed on a signal it could never clear and the
 *     tracking issue asked for re-verification of references that had not
 *     decayed (issue #518, 398 undigested against the 383 pin with zero link
 *     rot, drift or staleness). The exclusion is a measured, expiring class
 *     list, not headroom: the eligible pin is never raised, and a register that
 *     is missing, malformed or past its review window fails the audit instead
 *     of quietly passing it.
 *  4. Ceiling enforcement — the union of link-rot, stale and drifted live
 *     references cannot exceed CITATION_CEILING (10) before new mapping
 *     promotions must halt. Because link rot and staleness already hard-fail
 *     at a single occurrence (items 1-2), the ceiling's operative effect is
 *     the tolerance budget for content drift, which item 3 flags rather than
 *     hard-fails. The host-refused outcomes of item 1 (bot walls, throttling,
 *     an unresponsive host) are outside the ceiling as well: they are counts
 *     with their own disclosure, `throttledUnverifiableCount` and
 *     `botBlockedUnverifiableCount`, plus `probeCoveragePercent`, so the budget
 *     is only ever spent on verdicts the probe actually reached.
 *     Verification debt is deliberately excluded from the ceiling: it is
 *     ratcheted exclusively by audit-citation-verification.js
 *     (CITATION_DEBT_BASELINE.unverified), which hard-fails whenever the count
 *     grows. Counting the same debt here as well saturated the budget - 690
 *     unverified references against a ceiling of 10 - so this gate failed on
 *     every run irrespective of link rot or drift and could signal neither.
 *     The debt stays visible as `unverifiedCount` in the report and in the
 *     weekly workflow summary; it simply no longer drives this gate's status.
 *
 * Notes:
 *  - No writes are performed: this is an audit, not a mutator. A separate
 *    qualified-human follow-up promotes or withdraws flagged references.
 *  - The probe uses HEAD first and falls back to GET on 405/403; it follows no
 *    redirects beyond 5 and times out after 15 seconds per URL.
 *  - Bot-walled hosts that 403/405 even a GET are treated as
 *    unverifiable-by-automated-probe, not decayed, so CI is not held hostage.
 *  - Throttling is treated the same way, and the host is believed rather than
 *    out-waited: a 425/429, or any response carrying Retry-After, marks the URL
 *    unverifiable instead of dead, the host's spacing doubles (halving back on
 *    success), and a host that keeps asking for quiet is dropped from the sweep
 *    with its remaining URLs counted as unprobed. A definitive failure - 404,
 *    410, an unresolvable host, or any status that is not a throttle signal -
 *    still hard-fails. `probeCoveragePercent` states how much of the sweep
 *    actually produced a verdict, so a throttled run is never read as a clean
 *    one.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const https = require("https");

const {
  loadDigestExemptions,
  classifyDigestPosition,
  exemptionAssessmentStale,
  EXEMPTION_REASSESS_AFTER_DAYS,
} = require("./lib/citation-digest-exemptions");

const CITATION_CEILING = 10;
// Proposed approval-gated ratchet; independent of main's measured-class policy.
const MAX_UNDIGESTED_VERIFIED_REFS = 4;
/**
 * Non-regression ratchet for content-drift observability. A `contentDigest`
 * may only be recorded by the qualified human who verified the source
 * (docs/citation-verification-sop.md: "During a qualified-human verification
 * ... compute sha256-<hex> over the retrieved source body"), and it is anchored
 * to that verification's `sourceCheckedOn` date — so no script may backfill it,
 * and bodies that change per fetch must omit it rather than record a value that
 * will false-positive. Every verified reference on a digest-eligible URL
 * therefore arrives without one until a human records it, which means that
 * backlog can only be worked down, never grown. Pinning the measured count
 * makes that monotonic: adding a `verified: true` reference on an eligible URL
 * without a digest fails this audit instead of silently widening the blind
 * spot. Lower the pin as digests are recorded.
 *
 * The pin is 5: the verified references that predate this mechanism and sit on
 * hosts where the probe obtains a stable, comparable body (four
 * www.law.cornell.edu CFR pages and one www.ecfr.gov section). It is checked
 * against the live corpus by tests/citation-digest-ineligibility-register.test.ts,
 * so it can be neither slack nor overflowing. The 383 this constant replaced
 * counted every verified reference, including the classes the SOP forbids
 * digesting (392 of the 398 verified references on 2026-10-14 were PubMed
 * record pages served to the probe as a per-request anti-bot interstitial, and
 * one was a bot-walled publisher page): that backlog had no human path down and
 * grew with each verification batch, so the gate reported a regression on every
 * run. See docs/citation-digest-ineligibility-policy-2026-10-14.md.
 */
const MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS = 5;
/**
 * Reviewed register of the URL classes in which a `contentDigest` cannot be
 * recorded or validated, each with the measurement that justifies it. Keeping
 * this as data (rather than a hostname check in code) is what makes the
 * exclusion auditable: every class states why, what was observed, and when the
 * observation must be repeated, and the register expires so a justification
 * cannot quietly become permanent. A missing, malformed or expired register
 * fails the audit — it never falls back to "nothing is ineligible".
 */
const DIGEST_INELIGIBILITY_REGISTER_FILE = "docs/citation-digest-ineligible-classes.json";
const DIGEST_INELIGIBILITY_REGISTER_PATH = path.join(
  process.cwd(),
  DIGEST_INELIGIBILITY_REGISTER_FILE,
);
/** Failure text every register fault shares, so the remedy is never ambiguous. */
const DIGEST_INELIGIBILITY_REGISTER_REMEDY =
  `Re-measure each declared class (two fetches of its observation URL, comparing HTTP status, byte ` +
  `length and sha256) and re-date ${DIGEST_INELIGIBILITY_REGISTER_FILE}, or record digests at the ` +
  `qualified-human verification step and lower MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS — never widen ` +
  `the ratchet or relax the register to make this gate green (docs/citation-verification-sop.md).`;
const NON_AUTHORITATIVE_STATUSES = new Set([203]);

/**
 * Bot-challenge interstitial markers. Some hosts serve these with a 2xx status,
 * so status alone cannot identify them; matched against the leading slice of a
 * fetched body. Deliberately specific strings rather than a generic "looks like
 * a captcha" heuristic, so a genuine source is never mistaken for a wall.
 */
const CHALLENGE_BODY_MARKERS = Object.freeze([
  "challengeId",
  "cf-browser-verification",
  "cf_chl_opt",
  "Just a moment...",
  "Checking your browser before accessing",
  "Attention Required! | Cloudflare",
  "Please enable JS and disable any ad blocker",
]);

/** True when a fetched body is a bot-challenge interstitial, not the source. */
function bodyIsBotChallenge(body) {
  if (typeof body !== "string" || body.length === 0) return false;
  const head = body.slice(0, 20_000);
  return CHALLENGE_BODY_MARKERS.some((marker) => head.includes(marker));
}

/** Reason a response establishes nothing about the origin, or null. */
function botBlockReason(status, body) {
  if (Number.isInteger(status) && NON_AUTHORITATIVE_STATUSES.has(status)) return "non-authoritative-status";
  if (status === 403 || status === 405 || status === 406) return "bot-wall-status";
  if (bodyIsBotChallenge(body)) return "bot-challenge-interstitial";
  return null;
}

/**
 * True when a probe result establishes nothing about the origin source, either
 * because the host refused the client or because an intermediary answered
 * instead. Such a reference is unverifiable-by-probe, never decayed.
 */
function isBotBlockedProbe(result) {
  if (!result) return false;
  if (result.blocked === true) return true;
  return botBlockReason(result.status, result.body) !== null;
}
const PROBE_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;
const PROBE_USER_AGENT = "citation-decay-audit";
/**
 * Politeness + resilience knobs. The first version of this probe fired every
 * URL concurrently (Promise.all over the whole corpus); hosts like PubMed
 * throttle bursts with 429s, which manufactured hundreds of phantom
 * "decayed" rows — a false alarm that swamps the real dead-link queue. Probes
 * now run through a small worker pool (per-host spacing keeps a single host
 * from being hammered), and transient throttling responses are retried with
 * exponential backoff before being believed.
 */
const PROBE_CONCURRENCY = 4;
const PROBE_INTER_REQUEST_DELAY_MS = 100;
const PER_HOST_MIN_INTERVAL_MS = 600;
const TRANSIENT_RETRY_STATUSES = new Set([425, 429, 500, 502, 503, 504]);
const TRANSIENT_MAX_RETRIES = 3;
const TRANSIENT_RETRY_BASE_DELAY_MS = 1_500;
/**
 * Throttling, as distinct from decay. `THROTTLE_VERDICT_STATUSES` are the
 * statuses that mean "busy, come back later" rather than "this resource is
 * gone"; any response carrying `Retry-After` is a throttle signal whatever its
 * status, because that header is the host telling us to slow down. 500/502/503/
 * 504 stay decay: a server that persistently errors is a broken reference, and
 * 503 is admitted as throttling only through its own Retry-After.
 */
const THROTTLE_VERDICT_STATUSES = new Set([425, 429]);
/** Per-URL wait ceiling, and the ceiling on a host-signalled cooldown. */
const MAX_RETRY_DELAY_MS = 15_000;
const MAX_RETRY_AFTER_WAIT_MS = 15_000;
/** Adaptive per-host pacing: doubles while throttled, capped, halves on success. */
const MAX_HOST_SPACING_MS = 4_800;
const MAX_HOST_COOLDOWN_MS = 60_000;
/** After this many throttle episodes a host is dropped for the remainder. */
const MAX_HOST_THROTTLE_EPISODES = 3;
/**
 * Network failures that say something different about a reference. An
 * unresolvable or refusing host is a dead citation; a timeout or reset on a host
 * that answers other URLs is an unresponsive one. A failure with no code at all
 * stays decay, so an unidentifiable error is never quietly excused.
 */
const DEAD_HOST_ERROR_CODES = new Set(["ENOTFOUND", "ECONNREFUSED", "ERR_INVALID_URL"]);
const TRANSIENT_NETWORK_ERROR_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNABORTED",
  "EPIPE",
  "EPROTO",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "timeout",
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `tasks` (thunks returning promises) with a bounded number executing
 * concurrently, preserving input order in the resolved array.
 */
async function mapWithConcurrency(tasks, concurrency) {
  const results = new Array(tasks.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= tasks.length) return;
      results[index] = await tasks[index]();
    }
  });
  await Promise.all(workers);
  return results;
}

const DEFAULT_STALE_AFTER_DAYS = 365;
const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024;

/** Per-authorityCategory staleness windows, in days. */
const STALE_AFTER_DAYS_BY_CATEGORY = {
  "statutory-authority": 1095,
  "current-regulatory-authority": 1095,
  "federal-register-final-rule": 1095,
  "federal-register-proposed-or-notice": 1095,
  "va-adjudication-guidance": 730,
  "medical-scientific-evidence": 540,
  "individual-evidence": 365,
};

function stalenessWindowDays(reference) {
  const category = reference.authorityCategory;
  if (category && typeof category === "string" && STALE_AFTER_DAYS_BY_CATEGORY[category]) {
    return STALE_AFTER_DAYS_BY_CATEGORY[category];
  }
  return DEFAULT_STALE_AFTER_DAYS;
}

/**
 * Parses a self-describing contentDigest ("sha256-<hex>") and returns the hex
 * portion, or null when the digest is not in the accepted format.
 */
function parseContentDigest(value) {
  if (typeof value !== "string") return null;
  const match = /^sha256-([0-9a-f]{64})$/i.exec(value.trim());
  return match ? match[1].toLowerCase() : null;
}

function hashContent(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Parses a Retry-After header (RFC 9110: delta-seconds or an HTTP-date) into
 * milliseconds from now, or null when the header is absent or unparsable.
 */
function parseRetryAfter(value, nowMs = Date.now()) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1_000;
  const at = Date.parse(trimmed);
  return Number.isNaN(at) ? null : Math.max(0, at - nowMs);
}

/** True when a result is a request to slow down rather than a verdict. */
function isThrottleVerdict(result) {
  if (!result || result.ok === true) return false;
  if (result.blocked === true) return false;
  if (typeof result.retryAfterMs === "number") return true;
  return THROTTLE_VERDICT_STATUSES.has(result.status);
}

/** True when a probe failed at the transport layer in a recoverable way. */
function isTransientNetworkError(result) {
  const code = String(result?.errorCode ?? "");
  return code !== "" && !DEAD_HOST_ERROR_CODES.has(code) && TRANSIENT_NETWORK_ERROR_CODES.has(code);
}

/**
 * The single verdict for one probe result, so the report, the disclosure and the
 * tests cannot disagree about what a result meant.
 */
function classifyProbeOutcome(result) {
  if (!result) return "unprobed";
  if (isBotBlockedProbe(result)) return "blocked";
  if (result.ok === true) return result.drift === true ? "drift" : "ok";
  if (result.throttled === true) return "throttled";
  if (result.status === 0) return isTransientNetworkError(result) ? "unresponsive" : "decay";
  return isThrottleVerdict(result) ? "throttled" : "decay";
}

/**
 * Adaptive per-host spacing: double while the host throttles, halve back toward
 * the floor on success. Out-waiting a host that has asked for quiet is what
 * turned throttling into phantom link rot; pacing is the alternative to both
 * hammering and giving up.
 */
function nextHostSpacing(currentSpacingMs, throttled) {
  const current = Number.isFinite(currentSpacingMs) ? currentSpacingMs : PER_HOST_MIN_INTERVAL_MS;
  return throttled
    ? Math.min(current * 2, MAX_HOST_SPACING_MS)
    : Math.max(PER_HOST_MIN_INTERVAL_MS, Math.round(current / 2));
}

/** The host-signalled cooldown for one throttled result, bounded. */
function throttleCooldownMs(result) {
  const retryAfterMs = typeof result?.retryAfterMs === "number" ? result.retryAfterMs : 0;
  return Math.min(Math.max(0, retryAfterMs), MAX_HOST_COOLDOWN_MS);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DIGEST_INELIGIBILITY_KINDS = new Set(["dynamic-per-fetch", "probe-blocked"]);

/**
 * Reads the digest-ineligibility register. Fail-closed by construction: a
 * register that cannot be read is reported as an issue for buildReport to flag,
 * rather than silently classifying every reference as digest-eligible (which
 * would rebuild the impossible backlog) or as ineligible (which would hide it).
 */
function loadDigestIneligibilityRegister(filePath = DIGEST_INELIGIBILITY_REGISTER_PATH) {
  try {
    return {
      path: filePath,
      register: JSON.parse(fs.readFileSync(filePath, "utf8")),
      issues: [],
    };
  } catch (error) {
    return {
      path: filePath,
      register: null,
      issues: [
        `the register could not be read (${error instanceof Error ? error.message : String(error)})`,
      ],
    };
  }
}

/**
 * Validates the register's own shape, including the measurement evidence each
 * class must carry. Kept separate from classification so a malformed register
 * cannot be mistaken for a passing one.
 */
function validateDigestIneligibilityRegister(register) {
  const issues = [];
  if (!register || typeof register !== "object" || Array.isArray(register)) {
    return ["the register is not an object"];
  }
  if (register.schemaVersion !== 1) issues.push("schemaVersion must be 1");
  for (const field of ["reviewedOn", "reviewedBy", "authority", "policyBasis"]) {
    if (typeof register[field] !== "string" || register[field].trim() === "") {
      issues.push(`${field} must be a non-empty string`);
    }
  }
  if (!ISO_DATE.test(String(register.reviewedOn ?? ""))) {
    issues.push("reviewedOn must be an ISO date (YYYY-MM-DD)");
  }
  if (!Number.isInteger(register.reviewWindowDays) || register.reviewWindowDays < 1) {
    issues.push("reviewWindowDays must be a positive integer");
  }
  if (!Array.isArray(register.classes) || register.classes.length === 0) {
    issues.push("classes must be a non-empty array");
    return issues;
  }
  const seen = new Set();
  register.classes.forEach((entry, index) => {
    const at = `classes[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      issues.push(`${at} is not an object`);
      return;
    }
    if (typeof entry.id !== "string" || entry.id.trim() === "") {
      issues.push(`${at}.id must be a non-empty string`);
    } else if (seen.has(entry.id)) {
      issues.push(`${at}.id is duplicated`);
    }
    seen.add(entry.id);
    if (typeof entry.host !== "string" || entry.host.trim() === "") {
      issues.push(`${at}.host must be a non-empty string`);
    }
    if (typeof entry.pathPattern !== "string" || entry.pathPattern === "") {
      issues.push(`${at}.pathPattern must be a non-empty string`);
    } else {
      try {
        new RegExp(entry.pathPattern);
      } catch {
        issues.push(`${at}.pathPattern is not a valid regular expression`);
      }
    }
    if (!DIGEST_INELIGIBILITY_KINDS.has(entry.ineligibility)) {
      issues.push(`${at}.ineligibility must be one of ${[...DIGEST_INELIGIBILITY_KINDS].join(", ")}`);
    }
    if (typeof entry.reason !== "string" || entry.reason.trim() === "") {
      issues.push(`${at}.reason must be a non-empty string`);
    }
    const evidence = entry.evidence;
    if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
      issues.push(`${at}.evidence must be an object recording the measurement`);
      return;
    }
    if (!ISO_DATE.test(String(evidence.observedOn ?? ""))) {
      issues.push(`${at}.evidence.observedOn must be an ISO date`);
    }
    if (
      !Array.isArray(evidence.urls) ||
      evidence.urls.length === 0 ||
      !evidence.urls.every((url) => typeof url === "string" && /^https?:\/\//.test(url))
    ) {
      issues.push(`${at}.evidence.urls must be a non-empty array of http(s) URLs`);
    }
    if (typeof evidence.method !== "string" || evidence.method.trim() === "") {
      issues.push(`${at}.evidence.method must be a non-empty string`);
    }
    if (typeof evidence.observation !== "string" || evidence.observation.trim() === "") {
      issues.push(`${at}.evidence.observation must be a non-empty string`);
    }
  });
  return issues;
}

/**
 * The declared class a URL falls into, or null when the URL is digest-eligible
 * (an unknown or unparsable URL is treated as eligible, so it counts against
 * the ratchet rather than escaping it).
 */
function digestIneligibilityClassId(url, register) {
  if (!register || !Array.isArray(register.classes) || typeof url !== "string") return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  for (const entry of register.classes) {
    if (!entry || typeof entry !== "object" || parsed.host !== entry.host) continue;
    let pattern;
    try {
      pattern = new RegExp(entry.pathPattern);
    } catch {
      continue;
    }
    if (pattern.test(parsed.pathname)) return entry.id;
  }
  return null;
}

/**
 * Register freshness and disclosure. The review window exists because an
 * exclusion justified by a measurement is only as good as that measurement:
 * once it lapses the audit fails until the classes are re-measured.
 */
function summarizeDigestIneligibilityRegister(register, issues, todayIso) {
  const reviewedOn = typeof register?.reviewedOn === "string" ? register.reviewedOn : null;
  const windowDays = Number.isInteger(register?.reviewWindowDays) ? register.reviewWindowDays : null;
  const reviewExpiresOn =
    reviewedOn && windowDays ? addDays(reviewedOn, windowDays) : null;
  return {
    reviewedOn,
    reviewedBy: typeof register?.reviewedBy === "string" ? register.reviewedBy : null,
    reviewWindowDays: windowDays,
    reviewExpiresOn,
    expired: reviewExpiresOn !== null && todayIso > reviewExpiresOn,
    issues,
    classes: /** @type {any[]} */ (Array.isArray(register?.classes) ? register.classes : []).map((entry) => ({
      id: entry?.id ?? null,
      host: entry?.host ?? null,
      ineligibility: entry?.ineligibility ?? null,
    })),
  };
}

function addDays(isoDate, days) {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

const kbDir = path.join(process.cwd(), "data", "knowledge-base");

function readJsonFiles(directory) {
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => ({ file, data: JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")) }));
}

const daysBetween = (fromIso, toIso) =>
  Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);

function eachReference(files, visitor) {
  for (const { file, data } of files) {
    for (const suggestion of data.suggestions || []) {
      for (const reference of suggestion.sourceReferences || []) {
        visitor(reference, { file, primary: data.id, target: suggestion.conditionId });
      }
    }
  }
}

/**
 * Performs one HTTP probe of `target` with `method`, resolving
 * { status, location?, body?, blocked? }. `blocked` marks bot-wall statuses
 * (403/405/406) where the host refuses automated probes entirely.
 */
function requestOnce(target, method) {
  return new Promise((resolve) => {
    const client = target.startsWith("https:") ? https : http;
    const req = client.get(
      target,
      { method, timeout: PROBE_TIMEOUT_MS, headers: { "user-agent": PROBE_USER_AGENT } },
      (res) => {
        const status = res.statusCode || 0;
        const location = res.headers.location;
        const retryAfterMs = parseRetryAfter(res.headers["retry-after"]);
        if (method === "GET" && status >= 200 && status < 300) {
          const chunks = [];
          let received = 0;
          res.on("data", (chunk) => {
            received += chunk.length;
            if (received <= MAX_DOWNLOAD_BYTES) chunks.push(chunk);
          });
          res.on("end", () => resolve(received > MAX_DOWNLOAD_BYTES
            ? { status, bodyUnavailable: true, blocked: true, blockedReason: "body-too-large" }
            : { status, body: Buffer.concat(chunks).toString("utf8") }));
          res.on("error", () => resolve({ status, bodyUnavailable: true, blocked: true, blockedReason: "body-read-error" }));
          return;
        }
        const blocked = [403, 405, 406].includes(status);
        res.resume();
        resolve({ status, location, blocked, retryAfterMs });
      },
    );
    req.on("error", (error) => resolve({ status: 0, errorCode: error?.code ?? null }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: 0, errorCode: "timeout" });
    });
  });
}

/**
 * A failed probe, carrying the metadata that decides whether the failure is
 * decay (the resource is gone) or an unverifiable run (the host said no).
 */
function probeFailure(status, response = {}) {
  return {
    ok: false,
    status,
    retryAfterMs: typeof response.retryAfterMs === "number" ? response.retryAfterMs : null,
    errorCode: response.errorCode ?? null,
    blocked: response.blocked === true,
  };
}

/**
 * True when a probe result should be retried after a delay (throttling and
 * transient gateway failures) rather than reported as a probe verdict.
 */
function isTransientProbeResult(result) {
  return result.status === 0 || TRANSIENT_RETRY_STATUSES.has(result.status);
}

/** Evaluate only complete, source-bearing GET bodies for digest comparison. */
function evaluateGet(get, expectedDigestHex) {
  if (get.bodyUnavailable || typeof get.body !== "string" || get.body.length === 0) {
    return { ok: false, status: get.status, blocked: true, blockedReason: get.blockedReason ?? "body-unavailable" };
  }
  const reason = botBlockReason(get.status, get.body);
  if (reason) return { ok: false, status: get.status, blocked: true, blockedReason: reason };
  if (!expectedDigestHex) return { ok: true, status: get.status, body: get.body, digestCompared: false };
  const actual = hashContent(get.body ?? "");
  return actual === expectedDigestHex
    ? { ok: true, status: get.status, body: get.body, drift: false, digestCompared: true }
    : { ok: true, status: get.status, body: get.body, drift: true, digestMatched: false, digestCompared: true };
}

/**
 * Probe plus content-drift evaluation for one URL: HEAD first (following up
 * to MAX_REDIRECTS), then GET on bot-wall statuses. A 200 GET also carries
 * the body so callers can check content drift against a recorded digest.
 * When `expectedDigestHex` is provided and a body was fetched, the SHA-256 of
 * the body is compared against the recorded digest; a mismatch with HTTP 200
 * is reported as drifted (not decayed — the URL is alive, its content moved).
 */
async function probeUrlWithContent(url, expectedDigestHex) {
  let normalized = url;
  let redirects = 0;
  for (;;) {
    const head = await requestOnce(normalized, "HEAD");
    if ([301, 302, 303, 307, 308].includes(head.status) && head.location && redirects < MAX_REDIRECTS) {
      redirects += 1;
      let next = head.location;
      if (next.startsWith("/")) next = `${new URL(normalized).origin}${next}`;
      normalized = next;
      continue;
    }
    // A 2xx HEAD and a bot-walled HEAD both fall through to a GET: the HEAD
    // carries no body, so neither a challenge interstitial nor a digest can be
    // evaluated from it.
    if ((head.status >= 200 && head.status < 300) || head.blocked) {
      const get = await requestOnce(normalized, "GET");
      // HEAD and GET can route differently. Follow the GET redirect too,
      // within the same budget, rather than treating a live source as dead.
      if (get.status >= 300 && get.status < 400 && get.location) {
        if (redirects >= MAX_REDIRECTS) return probeFailure(get.status, get);
        normalized = new URL(get.location, normalized).toString();
        redirects += 1;
        continue;
      }
      if (get.status >= 200 && get.status < 300) return evaluateGet(get, expectedDigestHex);
      const reason = botBlockReason(get.status, get.body);
      if (reason) return { ok: false, status: get.status, blocked: true, blockedReason: reason };
      return probeFailure(get.status, get);
    }
    const headReason = botBlockReason(head.status, undefined);
    if (headReason) return { ok: false, status: head.status, blocked: true, blockedReason: headReason };
    return probeFailure(head.status, head);
  }
}

/**
 * Probe with retry: transient throttling/gateway statuses (and network
 * failures) are retried before being believed, so a busy host is not reported
 * as a dead link. Two rules keep that retrying from becoming the problem:
 *
 *  - Retry-After is honoured. The wait is the larger of the exponential backoff
 *    and the host's own request, capped at MAX_RETRY_DELAY_MS.
 *  - A host asking for longer than this run can afford is believed rather than
 *    out-waited: the verdict is returned immediately as `throttled`, because
 *    spending the budget against a closed door is exactly what produced the
 *    2026-10-14 sweep's 201 phantom link-rot rows (429 + `Retry-After: 60` on
 *    every request, retried 1.5 s later).
 */
async function probeUrlWithContentResilient(url, expectedDigestHex, options = {}) {
  const maxRetries = Number.isInteger(options.maxRetries) ? options.maxRetries : TRANSIENT_MAX_RETRIES;
  let result = await probeUrlWithContent(url, expectedDigestHex);
  for (let attempt = 1; isTransientProbeResult(result) && attempt <= maxRetries; attempt += 1) {
    const retryAfterMs = typeof result.retryAfterMs === "number" ? result.retryAfterMs : 0;
    if (retryAfterMs > MAX_RETRY_AFTER_WAIT_MS) return { ...result, throttled: true };
    const backoffMs = TRANSIENT_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
    await sleep(Math.min(Math.max(backoffMs, retryAfterMs), MAX_RETRY_DELAY_MS));
    result = await probeUrlWithContent(url, expectedDigestHex);
  }
  return isThrottleVerdict(result) ? { ...result, throttled: true } : result;
}

function buildReport(
  files,
  probeResults,
  todayIso,
  register = loadDigestIneligibilityRegister().register,
  digestExemptions,
) {
  // Retain the proposal-test API while keeping main's measured-class register independent.
  if (register && "compiled" in register) {
    digestExemptions = register;
    register = loadDigestIneligibilityRegister().register;
  }
  // The CLI always supplies the approval policy. Callers can exercise the
  // measured-class policy alone by omitting it (the pre-#527 report API).
  const enforceApprovalPolicy = digestExemptions !== undefined;
  digestExemptions ??= { compiled: [], entries: [], problems: [] };
  const flags = [];
  const decayed = [];
  const stale = [];
  const drifted = [];
  const blocked = [];
  const throttledUnverifiable = [];
  const unverified = [];
  const byCategory = {};
  let liveRefs = 0;
  let linkRotObserved = 0;

  for (const { file, data } of files) {
    eachReference([{ file, data }], (reference, provenance) => {
      liveRefs += 1;
      const checkedOn = reference.sourceCheckedOn;
      const windowDays = stalenessWindowDays(reference);
      const categoryKey = reference.authorityCategory ?? "unspecified";

      if (checkedOn) {
        const age = daysBetween(checkedOn, todayIso);
        byCategory[categoryKey] = byCategory[categoryKey] ?? { count: 0, stale: 0 };
        byCategory[categoryKey].count += 1;
        if (age > windowDays) {
          byCategory[categoryKey].stale += 1;
          stale.push({
            ...provenance,
            citation: reference.citation,
            checkedOn,
            age,
            authorityCategory: reference.authorityCategory ?? null,
            windowDays,
          });
        }
      } else if (reference.verified === true) {
        flags.push({ ...provenance, citation: reference.citation, reason: "verified reference without sourceCheckedOn" });
      }
      if (reference.sourceUrl) {
        const result = probeResults.get(reference.sourceUrl);
        if (!result) return;
        const outcome = classifyProbeOutcome(result);
        if (outcome === "ok" || outcome === "drift") linkRotObserved += 1;
        if (outcome === "drift") {
          drifted.push({
            ...provenance,
            citation: reference.citation,
            sourceUrl: reference.sourceUrl,
            status: result.status,
            note: "content hash no longer matches the digest recorded at verification time",
          });
          return;
        }
        if (outcome === "throttled" || outcome === "unresponsive") {
          // The host refused to answer, or never answered: this reference was
          // not checked, which is not the same as it having decayed. It is
          // counted, listed and subtracted from the run's coverage instead.
          throttledUnverifiable.push({
            ...provenance,
            citation: reference.citation,
            sourceUrl: reference.sourceUrl,
            status: result.status,
            reason: result.skipped === true ? "host-throttle-cooldown" : outcome,
            retryAfterSeconds:
              typeof result.retryAfterMs === "number" ? Math.round(result.retryAfterMs / 1000) : null,
          });
          return;
        }
        if (outcome === "decay") {
          decayed.push({ ...provenance, citation: reference.citation, sourceUrl: reference.sourceUrl, status: result.status });
          return;
        }
        if (outcome === "blocked") {
          blocked.push({ ...provenance, citation: reference.citation, sourceUrl: reference.sourceUrl, status: result.status,
            blockedReason: result.blockedReason ?? botBlockReason(result.status, result.body) ?? "unverifiable-by-probe" });
        }
      }
    });
  }

  eachReference(files, (reference, provenance) => {
    if (reference.verified === false) {
      unverified.push({ ...provenance, citation: reference.citation, sourceUrl: reference.sourceUrl });
    }
  });

  /**
   * Content-drift observability. `contentDriftCount` is only meaningful for
   * references that actually carry a digest; with none recorded the corpus
   * reports "0 drift", which is textually identical to "0 drift detected" and
   * reads as a clean result on a dimension the probe cannot observe. Count the
   * digest population separately so the report can say which of the two it is.
   */
  let verifiedRefs = 0;
  let verifiedWithDigest = 0;
  let digestEligibleWithoutDigest = 0;
  let digestIneligibleWithoutDigest = 0;
  /** @type {Record<string, number>} */
  const digestIneligibleByClass = {};
  eachReference(files, (reference) => {
    if (reference.verified !== true || !reference.sourceUrl) return;
    verifiedRefs += 1;
    if (parseContentDigest(reference.contentDigest)) {
      verifiedWithDigest += 1;
      return;
    }
    const classId = digestIneligibilityClassId(reference.sourceUrl, register);
    if (classId) {
      digestIneligibleWithoutDigest += 1;
      digestIneligibleByClass[classId] = (digestIneligibleByClass[classId] || 0) + 1;
    } else {
      digestEligibleWithoutDigest += 1;
    }
  });
  const verifiedWithoutDigest = verifiedRefs - verifiedWithDigest;
  const digestEligibleRefs = verifiedRefs - digestIneligibleWithoutDigest;
  const registerIssues = validateDigestIneligibilityRegister(register);
  const digestIneligibilityRegister = summarizeDigestIneligibilityRegister(
    register,
    registerIssues,
    todayIso,
  );

  // An unusable or expired register fails closed. Reading "no declared classes"
  // out of a broken register would rebuild the impossible backlog this gate was
  // just corrected for; reading "everything is ineligible" out of one would hide
  // the backlog the ratchet exists to hold.
  if (registerIssues.length > 0) {
    flags.push({
      file: "(corpus-wide)",
      primary: null,
      target: null,
      citation: null,
      reason:
        `digest-ineligibility register unusable: ${registerIssues.join("; ")}. ` +
        DIGEST_INELIGIBILITY_REGISTER_REMEDY,
    });
  } else if (digestIneligibilityRegister.expired) {
    flags.push({
      file: "(corpus-wide)",
      primary: null,
      target: null,
      citation: null,
      reason:
        `digest-ineligibility register review expired: the classes were measured on ` +
        `${digestIneligibilityRegister.reviewedOn} with a ` +
        `${digestIneligibilityRegister.reviewWindowDays}-day window ` +
        `(expired ${digestIneligibilityRegister.reviewExpiresOn}). ` +
        DIGEST_INELIGIBILITY_REGISTER_REMEDY,
    });
  }

  if (digestEligibleWithoutDigest > MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS) {
    flags.push({
      file: "(corpus-wide)",
      primary: null,
      target: null,
      citation: null,
      reason:
        `content-drift observability regressed: ${digestEligibleWithoutDigest} verified references on ` +
        `digest-eligible URLs lack a contentDigest (ratchet baseline ` +
        `${MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS}). A digest must be recorded by the qualified human ` +
        `who verifies the source and cannot be backfilled by a script; see ` +
        `docs/citation-verification-sop.md ("Content digests and tiered staleness"). ` +
        `${digestIneligibleWithoutDigest} further verified references sit in the declared ` +
        `digest-ineligible classes (${Object.keys(digestIneligibleByClass).join(", ") || "none"}), ` +
        `where the SOP forbids recording one — that exclusion is a measured class list in ` +
        `${DIGEST_INELIGIBILITY_REGISTER_FILE}, not headroom for this pin.`,
    });
  }

  let verifiedDigestExempt = 0;
  let verifiedUndigestedActionable = 0;
  let verifiedDigestExemptionPending = 0;
  const exemptCoverageById = new Map();
  const pendingCoverageById = new Map();
  const actionableUndigested = [];
  eachReference(files, (reference, provenance) => {
    if (reference.verified !== true || !reference.sourceUrl) return;

    const position = classifyDigestPosition(reference, digestExemptions.compiled, todayIso);
    if (position.state === "digested") {
      return;
    }
    if (position.state === "exempt") {
      verifiedDigestExempt += 1;
      const id = position.exemption.id;
      exemptCoverageById.set(id, (exemptCoverageById.get(id) ?? 0) + 1);
      return;
    }
    // Pending human policy approval never waives debt.
    if (position.pendingExemption) {
      verifiedDigestExemptionPending += 1;
      const id = position.pendingExemption.id;
      pendingCoverageById.set(id, (pendingCoverageById.get(id) ?? 0) + 1);
    }
    // A malformed digest lands here too: it is not coverage, so it stays debt.
    verifiedUndigestedActionable += 1;
    actionableUndigested.push({
      ...provenance,
      citation: reference.citation,
      sourceUrl: reference.sourceUrl,
      sourceCheckedOn: reference.sourceCheckedOn ?? null,
      pendingExemptionId: position.pendingExemption?.id ?? null,
    });
  });

  if (enforceApprovalPolicy && verifiedUndigestedActionable > MAX_UNDIGESTED_VERIFIED_REFS) {
    flags.push({
      file: "(corpus-wide)",
      primary: null,
      target: null,
      citation: null,
      reason:
        `content-drift observability regressed: ${verifiedUndigestedActionable} verified references could carry a ` +
        `contentDigest and do not (ratchet baseline ${MAX_UNDIGESTED_VERIFIED_REFS}). A digest must be recorded by ` +
        `the qualified human who verifies the source and cannot be backfilled by a script; see ` +
        `docs/citation-verification-sop.md ("Content digests and tiered staleness"). A further ` +
        `${verifiedDigestExempt} verified references are exempt because their source class was measured to be ` +
        `undigestible (data/citation-digest-exemptions.json); those are reported separately and are not this debt.`,
    });
  }

  if (verifiedDigestExemptionPending > 0) {
    flags.push({
      file: "data/citation-digest-exemptions.json", primary: null, target: null, citation: null,
      reason: `${verifiedDigestExemptionPending} verified references match proposed digest exemptions awaiting qualified-human approval; no debt has been waived.`,
    });
  }

  // The register is what makes the ratchet meaningful, so an unsound register is
  // a structural failure in its own right rather than a warning: a malformed,
  // unevidenced or expired entry must not quietly exempt sources from drift
  // detection.
  for (const problem of digestExemptions.problems ?? []) {
    flags.push({
      file: "data/citation-digest-exemptions.json",
      primary: null,
      target: null,
      citation: null,
      reason: `digest-exemption register is invalid: ${problem}`,
    });
  }
  for (const entry of digestExemptions.entries ?? []) {
    if (exemptionAssessmentStale(entry, todayIso)) {
      flags.push({
        file: "data/citation-digest-exemptions.json",
        primary: null,
        target: null,
        citation: null,
        reason:
          `digest exemption "${entry?.id ?? "(no id)"}" was measured on ${entry?.assessment?.assessedOn ?? "(no date)"} and is ` +
          `invalid, future-dated, or older than ${EXEMPTION_REASSESS_AFTER_DAYS} days: re-measure the source class before relying on it, ` +
          `or the exemption outlives the evidence for it.`,
      });
    }
  }

  const trueLinkRot = decayed.filter((entry) => !blocked.some((b) => b.sourceUrl === entry.sourceUrl));
  // Link rot is a hard failure at a single occurrence (docblock item 1): a dead
  // URL can never support a nexus, so it joins staleness and structural flags
  // in `decays` rather than hiding inside the ceiling budget. Content drift is
  // deliberately NOT here - docblock item 3 flags it and item 4 budgets it.
  // Verification debt is deliberately NOT here either: it is ratcheted by
  // audit-citation-verification.js, which hard-fails if the count grows.
  // Neither are the host-refused outcomes (bot walls, throttling, an
  // unresponsive host): they report that this run could not ask, not that the
  // answer was bad, and both the counts and the resulting probe coverage are
  // disclosed so an unchecked reference is never read as a checked one.
  const decays = [...stale, ...trueLinkRot, ...flags];
  const ceiling = trueLinkRot.length + stale.length + drifted.length;

  /**
   * How much of the sweep produced a verdict. A run that throttled its way
   * through a host reports partial coverage rather than a clean sweep, because
   * "0 link rot" over 40 percent of the corpus is a different claim from
   * "0 link rot" over all of it.
   */
  let definitiveVerdictUrlCount = 0;
  let unverifiableByProbeUrlCount = 0;
  for (const result of probeResults.values()) {
    const outcome = classifyProbeOutcome(result);
    if (outcome === "throttled" || outcome === "unresponsive" || outcome === "blocked") {
      unverifiableByProbeUrlCount += 1;
    } else if (outcome !== "unprobed") {
      definitiveVerdictUrlCount += 1;
    }
  }
  const probeCoveragePercent =
    probeResults.size === 0
      ? 100
      : Math.round((definitiveVerdictUrlCount / probeResults.size) * 1000) / 10;

  const linkRotProbedReferences = linkRotObserved + blocked.length + trueLinkRot.length + throttledUnverifiable.length;
  const linkRotObservabilityPercent =
    linkRotProbedReferences === 0
      ? 0
      : Math.round((linkRotObserved / linkRotProbedReferences) * 1000) / 10;

  const digestExemptionCoverage = (digestExemptions.entries ?? []).map((entry) => ({
    id: entry?.id ?? null,
    host: entry?.host ?? null,
    reason: entry?.reason ?? null,
    verifiedReferences: exemptCoverageById.get(entry?.id) ?? 0,
    pendingReferences: pendingCoverageById.get(entry?.id) ?? 0,
    reviewStatus: entry?.review?.status ?? null,
    assessedOn: entry?.assessment?.assessedOn ?? null,
    stale: exemptionAssessmentStale(entry, todayIso),
  }));

  const report = {
    status: decays.length > 0 || ceiling > CITATION_CEILING ? "FAIL" : "PASS",
    liveReferences: liveRefs,
    uniqueUrlsProbed: probeResults.size,
    linkRotCount: trueLinkRot.length,
    linkRotObservedCount: linkRotObserved,
    linkRotProbedReferenceCount: linkRotProbedReferences,
    linkRotObservabilityPercent,
    contentDriftCount: drifted.length,
    contentDriftDetectable: verifiedWithDigest > 0,
    verifiedReferenceCount: verifiedRefs,
    verifiedWithDigestCount: verifiedWithDigest,
    verifiedWithoutDigestCount: verifiedWithoutDigest,
    digestEligibleWithoutDigestCount: digestEligibleWithoutDigest,
    digestIneligibleWithoutDigestCount: digestIneligibleWithoutDigest,
    digestIneligibleByClass,
    digestEligibleReferenceCount: digestEligibleRefs,
    maxUndigestedEligibleVerifiedRefs: MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS,
    digestIneligibilityRegister,
    contentDriftCoveragePercent:
      verifiedRefs === 0 ? 100 : Math.round((verifiedWithDigest / verifiedRefs) * 1000) / 10,
    digestEligibleCoveragePercent:
      digestEligibleRefs === 0
        ? 100
        : Math.round((verifiedWithDigest / digestEligibleRefs) * 1000) / 10,
    verifiedDigestExemptCount: verifiedDigestExempt,
    verifiedDigestExemptionPendingCount: verifiedDigestExemptionPending,
    verifiedUndigestedActionableCount: verifiedUndigestedActionable,
    maxUndigestedVerifiedRefs: MAX_UNDIGESTED_VERIFIED_REFS,
    digestExemptionEntryCount: (digestExemptions.entries ?? []).length,
    digestExemptionProblemCount: (digestExemptions.problems ?? []).length,
    exemptionReassessAfterDays: EXEMPTION_REASSESS_AFTER_DAYS,
    digestExemptions: digestExemptionCoverage,
    botBlockedUnverifiableCount: blocked.length,
    throttledUnverifiableCount: throttledUnverifiable.length,
    unverifiableByProbeUrlCount,
    definitiveVerdictUrlCount,
    probeCoveragePercent,
    staleCount: stale.length,
    structuralFlagCount: flags.length,
    unverifiedCount: unverified.length,
    citationCeiling: CITATION_CEILING,
    citationCeilingUsage: ceiling,
    stalenessWindowsDays: STALE_AFTER_DAYS_BY_CATEGORY,
    defaultStalenessWindowDays: DEFAULT_STALE_AFTER_DAYS,
    stalenessByCategory: byCategory,
    decayed: trueLinkRot,
    contentDrift: drifted,
    stale,
    structuralFlags: flags,
    botBlockedUnverifiable: blocked,
    throttledUnverifiable,
    actionableUndigested,
  };
  return report;
}

async function main() {
  const files = readJsonFiles(kbDir);
  const urlsToProbe = new Map();

  eachReference(files, (reference) => {
    if (!reference.sourceUrl) return;
    if (!urlsToProbe.has(reference.sourceUrl)) {
      urlsToProbe.set(reference.sourceUrl, parseContentDigest(reference.contentDigest));
    }
  });

  const urls = [...urlsToProbe.entries()];
  /**
   * Per-host pacing state. `spacingMs` adapts to what the host will accept,
   * `cooldownUntil` honours a Retry-After the host sent, `nextSlotAt` is the
   * reservation clock (a worker claims the next slot before sleeping, so
   * concurrent workers never bunch up on one host), and `cooledDown` ends the
   * sweep for a host that keeps asking for quiet.
   */
  const hostState = new Map();
  function hostStateFor(host) {
    if (!hostState.has(host)) {
      hostState.set(host, {
        spacingMs: PER_HOST_MIN_INTERVAL_MS,
        nextSlotAt: 0,
        cooldownUntil: 0,
        throttleEpisodes: 0,
        cooledDown: false,
      });
    }
    return hostState.get(host);
  }
  const probeResults = new Map();
  await mapWithConcurrency(
    urls.map(([url, digestHex]) => async () => {
      let host = null;
      try {
        host = new URL(url).host;
      } catch {
        host = null;
      }
      if (host) {
        const state = hostStateFor(host);
        if (state.cooledDown) {
          // The host is still in a throttle window: asking again would neither
          // answer the question nor respect the answer we already got.
          probeResults.set(url, {
            ok: false,
            status: 0,
            throttled: true,
            skipped: true,
            retryAfterMs: null,
            errorCode: null,
          });
          return;
        }
        const now = Date.now();
        const waitMs = Math.max(0, Math.max(state.nextSlotAt, state.cooldownUntil) - now);
        state.nextSlotAt = Math.max(now, now + waitMs) + state.spacingMs + PROBE_INTER_REQUEST_DELAY_MS;
        if (waitMs > 0) await sleep(waitMs);
      }
      const result = await probeUrlWithContentResilient(url, digestHex);
      probeResults.set(url, result);
      if (!host) return;
      const state = hostStateFor(host);
      const throttled = result.throttled === true || isThrottleVerdict(result);
      state.spacingMs = nextHostSpacing(state.spacingMs, throttled);
      if (throttled) {
        state.throttleEpisodes += 1;
        state.cooldownUntil = Date.now() + throttleCooldownMs(result);
        if (state.throttleEpisodes >= MAX_HOST_THROTTLE_EPISODES) state.cooledDown = true;
      } else if (result.ok === true) {
        state.throttleEpisodes = 0;
      }
    }),
    PROBE_CONCURRENCY,
  );

  const { register } = loadDigestIneligibilityRegister();
  const report = buildReport(files, probeResults, new Date().toISOString().slice(0, 10), register, loadDigestExemptions(process.cwd()));

  console.log(JSON.stringify(report, null, 2));
  if (report.status === "FAIL") process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ status: "FAIL", error: String(error) }, null, 2));
    process.exitCode = 1;
  });
}

module.exports = {
  MAX_UNDIGESTED_VERIFIED_REFS,
  NON_AUTHORITATIVE_STATUSES, CHALLENGE_BODY_MARKERS, bodyIsBotChallenge,
  botBlockReason, isBotBlockedProbe, evaluateGet,
  buildReport,
  loadDigestIneligibilityRegister,
  validateDigestIneligibilityRegister,
  digestIneligibilityClassId,
  summarizeDigestIneligibilityRegister,
  MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS,
  DIGEST_INELIGIBILITY_REGISTER_FILE,
  CITATION_CEILING,
  stalenessWindowDays,
  parseContentDigest,
  hashContent,
  STALE_AFTER_DAYS_BY_CATEGORY,
  DEFAULT_STALE_AFTER_DAYS,
  isTransientProbeResult,
  probeUrlWithContent,
  probeUrlWithContentResilient,
  classifyProbeOutcome,
  isThrottleVerdict,
  isTransientNetworkError,
  parseRetryAfter,
  nextHostSpacing,
  throttleCooldownMs,
  mapWithConcurrency,
  PROBE_CONCURRENCY,
  PROBE_INTER_REQUEST_DELAY_MS,
  PER_HOST_MIN_INTERVAL_MS,
  TRANSIENT_RETRY_STATUSES,
  TRANSIENT_MAX_RETRIES,
  THROTTLE_VERDICT_STATUSES,
  DEAD_HOST_ERROR_CODES,
  TRANSIENT_NETWORK_ERROR_CODES,
  MAX_RETRY_DELAY_MS,
  MAX_RETRY_AFTER_WAIT_MS,
  MAX_HOST_SPACING_MS,
  MAX_HOST_COOLDOWN_MS,
  MAX_HOST_THROTTLE_EPISODES,
};
