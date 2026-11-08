/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Loader and validator for data/citation-digest-exemptions.json.
 *
 * One definition, three consumers: the weekly citation-decay probe (which needs
 * to split verified-without-digest references into structurally undigestible and
 * genuinely actionable), the offline PR-time verification audit (which must not
 * let new debt in just because the network probe only runs weekly), and the
 * digestibility assessment tool (which proposes new entries). A second copy of
 * these rules would drift, and an exemption register that drifts silently
 * widens the content-drift blind spot it is supposed to document.
 *
 * The register records MEASUREMENTS about how a source behaves over the wire,
 * not verification decisions. Nothing here may set `verified`, and an entry
 * never authorises a promotion; docs/citation-verification-sop.md still reserves
 * both to a qualified human. What an entry does is make the SOP's two digest
 * rules jointly satisfiable: a dynamic body must omit its digest, and omitting a
 * digest must not be indistinguishable from forgetting to record one.
 *
 * Every check fails closed. An entry that is malformed, unevidenced, stale, or
 * whose urlPattern matches a URL on a different host than the one declared does
 * not grant an exemption — it is reported as a register problem and the
 * reference stays counted as actionable debt.
 */
const fs = require("fs");
const path = require("path");

const REGISTER_PATH = path.join("data", "citation-digest-exemptions.json");

/**
 * An exemption is a claim about a host's transport behaviour, and hosts change
 * platforms. Requiring periodic re-measurement is what stops an entry recorded
 * once from exempting a source class forever after the behaviour that justified
 * it has gone away.
 */
const EXEMPTION_REASSESS_AFTER_DAYS = 365;

/**
 * Closed vocabulary. A reason outside this set is rejected rather than ignored,
 * so the register cannot acquire a new exemption class without a code change
 * that a reviewer has to look at.
 */
const DIGEST_EXEMPTION_REASONS = Object.freeze([
  "volatile-body-per-fetch",
  "bot-walled-body-unavailable",
]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value) {
  return typeof value === "string" && DATE_RE.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function daysBetween(fromIso, toIso) {
  return Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

/**
 * Validates one entry and returns human-readable problems (empty when sound).
 * Deliberately strict: the entry's whole job is to justify NOT collecting
 * drift evidence, so it has to carry enough to re-perform the measurement.
 */
function validateEntry(entry, index) {
  const problems = [];
  const at = (message) => problems.push(`exemptions[${index}]${entry && entry.id ? ` (${entry.id})` : ""}: ${message}`);

  if (!entry || typeof entry !== "object") return [`exemptions[${index}]: not an object`];

  if (typeof entry.id !== "string" || !entry.id.trim()) at("id is required");
  if (typeof entry.host !== "string" || !entry.host.trim()) at("host is required");
  if (typeof entry.urlPattern !== "string" || !entry.urlPattern.trim()) at("urlPattern is required");
  if (typeof entry.summary !== "string" || !entry.summary.trim()) at("summary is required");
  if (typeof entry.sopBasis !== "string" || !entry.sopBasis.trim()) at("sopBasis is required (which SOP rule the exemption rests on)");
  if (!DIGEST_EXEMPTION_REASONS.includes(entry.reason)) {
    at(`reason must be one of ${DIGEST_EXEMPTION_REASONS.join(", ")} (got ${JSON.stringify(entry.reason)})`);
  }

  if (typeof entry.urlPattern === "string" && entry.urlPattern.trim()) {
    try {
      new RegExp(entry.urlPattern);
    } catch (error) {
      at(`urlPattern is not a valid regular expression: ${String(error)}`);
    }
  }

  const a = entry.assessment;
  if (!a || typeof a !== "object") {
    at("assessment is required (the exemption must be backed by a measurement)");
  } else {
    if (!validDate(a.assessedOn)) at("assessment.assessedOn must be a real YYYY-MM-DD date");
    if (typeof a.method !== "string" || !a.method.trim()) at("assessment.method is required so the measurement can be re-performed");
    if (!Array.isArray(a.sampleUrls) || a.sampleUrls.length === 0) at("assessment.sampleUrls must list at least one measured URL");
    if (!Number.isInteger(a.sampleCount) || a.sampleCount < 2) {
      at("assessment.sampleCount must be an integer >= 2 (volatility cannot be established from one fetch)");
    }
    if (!Number.isInteger(a.distinctBodyDigests) || a.distinctBodyDigests < 1) {
      at("assessment.distinctBodyDigests must be an integer >= 1");
    }
    if (!Array.isArray(a.httpStatuses) || a.httpStatuses.length !== a.sampleCount ||
        a.httpStatuses.some((status) => !Number.isInteger(status) || status < 100 || status > 599)) {
      at("assessment.httpStatuses must record one valid HTTP status per sample");
    }
    if (Array.isArray(a.sampleUrls)) {
      for (const url of a.sampleUrls) {
        try {
          const parsed = new URL(url);
          if (parsed.protocol !== "https:" || parsed.host !== entry.host || parsed.username || parsed.password ||
              !new RegExp(entry.urlPattern).test(url)) {
            at("assessment.sampleUrls must be HTTPS URLs on the declared host matching urlPattern");
          }
        } catch {
          at("assessment.sampleUrls contains an invalid URL or pattern");
        }
      }
    }
    if (a.deterministic !== false) at("assessment.deterministic must be false (a deterministic body should carry a digest, not an exemption)");
    if (Number.isInteger(a.sampleCount) && Number.isInteger(a.distinctBodyDigests) && a.distinctBodyDigests > a.sampleCount) {
      at("assessment.distinctBodyDigests exceeds assessment.sampleCount");
    }
    if (entry.reason === "bot-walled-body-unavailable") {
      const allBlocked = Array.isArray(a.httpStatuses) && a.httpStatuses.length > 0 && a.httpStatuses.every((s) => Number.isInteger(s) && s >= 400);
      if (!allBlocked) at("reason bot-walled-body-unavailable requires every observed status to be >= 400");
    }
    if (entry.reason === "volatile-body-per-fetch" &&
        Number.isInteger(a.sampleCount) && Number.isInteger(a.distinctBodyDigests) &&
        a.sampleCount >= 2 && a.distinctBodyDigests < 2) {
      at("reason volatile-body-per-fetch requires at least two distinct body digests across the samples");
    }
  }

  const review = entry.review;
  if (!review || typeof review !== "object") at("review is required");
  else {
    if (!["pending-qualified-human", "approved", "rejected"].includes(review.status)) {
      at("review.status must be pending-qualified-human, approved, or rejected");
    }
    if (review.status === "approved") {
      if (typeof review.reviewer !== "string" || !review.reviewer.trim()) at("approved review requires a named reviewer");
      if (!validDate(review.reviewedOn)) at("approved review requires a real review.reviewedOn date");
      if (validDate(review.reviewedOn) && validDate(a?.assessedOn) && review.reviewedOn < a.assessedOn) {
        at("review.reviewedOn must not predate the assessment");
      }
    }
  }

  return problems;
}

/**
 * Validates a whole entry list: per-entry rules plus the cross-entry rules that
 * need to see the list (duplicate ids). One home for both, so the disk loader
 * and any in-memory construction cannot disagree about what a sound register is.
 */
function validateEntries(entries) {
  if (!Array.isArray(entries)) return ["register.exemptions must be an array"];
  const problems = [];
  entries.forEach((entry, index) => problems.push(...validateEntry(entry, index)));

  const seen = new Map();
  entries.forEach((entry, index) => {
    const id = entry && typeof entry === "object" ? entry.id : undefined;
    if (typeof id !== "string" || !id) return;
    if (seen.has(id)) problems.push(`exemptions[${index}]: duplicate id ${JSON.stringify(id)} (first at index ${seen.get(id)})`);
    else seen.set(id, index);
  });

  return problems;
}

/** Compiles entries into the {entry, regex} pairs used for URL matching. */
function compileEntries(entries) {
  const compiled = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (validateEntry(entry, 0).length > 0) continue;
    let regex;
    try { regex = new RegExp(entry.urlPattern); } catch { continue; }
    compiled.push({ entry, regex });
  }
  return compiled;
}

/**
 * Loads and validates the register. A missing file is not an error — the
 * register is allowed to be empty, which simply means nothing is exempt and
 * every verified reference without a digest counts as actionable debt.
 */
function loadDigestExemptions(rootDir = process.cwd()) {
  const empty = { path: null, present: false, version: null, entries: [], compiled: [], problems: [] };
  const file = path.join(rootDir, REGISTER_PATH);
  empty.path = file;
  if (!fs.existsSync(file)) return empty;

  let register;
  try {
    register = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return { ...empty, present: true, problems: [`register is not valid JSON: ${String(error)}`] };
  }

  if (!register || typeof register !== "object" || Array.isArray(register)) {
    return { ...empty, present: true, problems: ["register must be a JSON object"] };
  }

  const problems = [];
  if (register.version !== 1) problems.push(`unsupported register version ${JSON.stringify(register.version)} (expected 1)`);
  problems.push(...validateEntries(register.exemptions));

  const entries = Array.isArray(register.exemptions) ? register.exemptions : [];
  return { path: file, present: true, version: register.version ?? null, entries, compiled: problems.length === 0 ? compileEntries(entries) : [], problems };
}

/**
 * Returns the exemption entry covering `url`, or null.
 *
 * The declared host must match the URL's actual host. This is the guard against
 * an over-broad urlPattern: a pattern written loosely enough to reach another
 * host grants nothing there, and the caller reports the mismatch instead of
 * quietly exempting a source nobody measured.
 */
function findDigestExemption(url, compiled) {
  if (typeof url !== "string" || !url || !Array.isArray(compiled)) return null;
  let parsed;
  try { parsed = new URL(url); } catch { return null; }

  for (const { entry, regex } of compiled) {
    if (!regex.test(url)) continue;
    if (typeof entry.host === "string" && entry.host && parsed.host !== entry.host) {
      return { mismatchedHost: true, entry, declaredHost: entry.host, actualHost: parsed.host };
    }
    return { mismatchedHost: false, entry };
  }
  return null;
}

/** True when an entry's measurement is older than the re-assessment window. */
function exemptionAssessmentStale(entry, todayIso) {
  if (entry && entry.review && entry.review.status === "rejected") return false;
  const assessedOn = entry && entry.assessment ? entry.assessment.assessedOn : undefined;
  if (!validDate(assessedOn) || !validDate(todayIso)) return true;
  const age = daysBetween(assessedOn, todayIso);
  return !Number.isFinite(age) || age < 0 || age > EXEMPTION_REASSESS_AFTER_DAYS;
}

/**
 * Classifies one verified reference's digest position.
 *
 *  - "digested"   drift detection is live for this reference
 *  - "exempt"     a measured, evidence-backed reason says a digest would
 *                 false-positive; drift detection is impossible by design
 *  - "actionable" a qualified human can and should record a digest
 */
function classifyDigestPosition(reference, compiled, todayIso = new Date().toISOString().slice(0, 10)) {
  const digest = reference && typeof reference.contentDigest === "string" ? reference.contentDigest.trim() : "";
  if (/^sha256-[0-9a-f]{64}$/i.test(digest)) return { state: "digested", exemption: null };
  if (digest) return { state: "actionable", exemption: null };
  const match = findDigestExemption(reference ? reference.sourceUrl : undefined, compiled);
  if (match && !match.mismatchedHost && !exemptionAssessmentStale(match.entry, todayIso)) {
    if (match.entry.review.status === "approved" && match.entry.review.reviewedOn <= todayIso) {
      return { state: "exempt", exemption: match.entry };
    }
    if (match.entry.review.status === "pending-qualified-human") {
      return { state: "actionable", exemption: null, pendingExemption: match.entry };
    }
  }
  return { state: "actionable", exemption: null, hostMismatch: match && match.mismatchedHost ? match : null };
}

module.exports = {
  REGISTER_PATH,
  EXEMPTION_REASSESS_AFTER_DAYS,
  DIGEST_EXEMPTION_REASONS,
  DATE_RE,
  validDate,
  daysBetween,
  validateEntry,
  validateEntries,
  compileEntries,
  loadDigestExemptions,
  findDigestExemption,
  exemptionAssessmentStale,
  classifyDigestPosition,
};
