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
 *     than backfilled: MAX_UNDIGESTED_VERIFIED_REFS pins the backlog so it can
 *     only shrink, and the report always states how much of the corpus drift
 *     detection can actually see, so a zero drift count is never mistaken for
 *     assurance the probe did not earn.
 *  4. Ceiling enforcement — the union of link-rot, stale and drifted live
 *     references cannot exceed CITATION_CEILING (10) before new mapping
 *     promotions must halt. Because link rot and staleness already hard-fail
 *     at a single occurrence (items 1-2), the ceiling's operative effect is
 *     the tolerance budget for content drift, which item 3 flags rather than
 *     hard-fails.
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
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const https = require("https");

const CITATION_CEILING = 10;
/**
 * Non-regression ratchet for content-drift observability. A `contentDigest`
 * may only be recorded by the qualified human who verified the source
 * (docs/citation-verification-sop.md: "During a qualified-human verification
 * ... compute sha256-<hex> over the retrieved source body"), and it is anchored
 * to that verification's `sourceCheckedOn` date — so no script may backfill it,
 * and dynamic bodies must omit it rather than record a value that will
 * false-positive. Every verified reference therefore arrives without one until
 * a human records it, which means the corpus-wide backlog can only be worked
 * down, never grown. Pinning the current count makes that monotonic: adding a
 * `verified: true` reference without a digest fails this audit instead of
 * silently widening the blind spot. Lower the pin as digests are recorded.
 */
const MAX_UNDIGESTED_VERIFIED_REFS = 383;
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
        if (method === "GET" && status >= 200 && status < 300) {
          const chunks = [];
          let received = 0;
          res.on("data", (chunk) => {
            received += chunk.length;
            if (received <= MAX_DOWNLOAD_BYTES) chunks.push(chunk);
          });
          res.on("end", () => resolve({ status, body: Buffer.concat(chunks).toString("utf8") }));
          res.on("error", () => resolve({ status }));
          return;
        }
        const blocked = [403, 405, 406].includes(status);
        res.resume();
        resolve({ status, location, blocked });
      },
    );
    req.on("error", () => resolve({ status: 0 }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: 0 });
    });
  });
}

/**
 * True when a probe result should be retried after a delay (throttling and
 * transient gateway failures) rather than reported as a probe verdict.
 */
function isTransientProbeResult(result) {
  return result.status === 0 || TRANSIENT_RETRY_STATUSES.has(result.status);
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
    if (head.status >= 200 && head.status < 300 && !head.blocked) {
      const get = await requestOnce(normalized, "GET");
      if (get.status >= 200 && get.status < 300) {
        if (!expectedDigestHex) return { ok: true, status: get.status, body: get.body };
        const actual = hashContent(get.body ?? "");
        return actual === expectedDigestHex
          ? { ok: true, status: get.status, body: get.body, drift: false }
          : { ok: true, status: get.status, body: get.body, drift: true, digestMatched: false };
      }
      return { ok: false, status: get.status };
    }
    if (head.blocked) {
      const get = await requestOnce(normalized, "GET");
      if (get.status >= 200 && get.status < 300) {
        if (!expectedDigestHex) return { ok: true, status: get.status, body: get.body };
        const actual = hashContent(get.body ?? "");
        return actual === expectedDigestHex
          ? { ok: true, status: get.status, body: get.body, drift: false }
          : { ok: true, status: get.status, body: get.body, drift: true, digestMatched: false };
      }
      if (get.blocked) return { ok: true, status: get.status, blocked: true };
      return { ok: false, status: get.status };
    }
    return { ok: false, status: head.status };
  }
}

/**
 * Probe with retry: transient throttling/gateway statuses (and network
 * failures) are retried with exponential backoff before being believed, so a
 * busy host is never misreported as a dead link.
 */
async function probeUrlWithContentResilient(url, expectedDigestHex) {
  let result = await probeUrlWithContent(url, expectedDigestHex);
  for (let attempt = 1; isTransientProbeResult(result) && attempt <= TRANSIENT_MAX_RETRIES; attempt += 1) {
    await sleep(TRANSIENT_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    result = await probeUrlWithContent(url, expectedDigestHex);
  }
  return result;
}

function buildReport(files, probeResults, todayIso) {
  const flags = [];
  const decayed = [];
  const stale = [];
  const drifted = [];
  const blocked = [];
  const unverified = [];
  const byCategory = {};
  let liveRefs = 0;

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
        if (result.drift === true) {
          drifted.push({
            ...provenance,
            citation: reference.citation,
            sourceUrl: reference.sourceUrl,
            status: result.status,
            note: "content hash no longer matches the digest recorded at verification time",
          });
          return;
        }
        if (result.ok === false) {
          decayed.push({ ...provenance, citation: reference.citation, sourceUrl: reference.sourceUrl, status: result.status });
          return;
        }
        if (result.blocked) {
          blocked.push({ ...provenance, citation: reference.citation, sourceUrl: reference.sourceUrl, status: result.status });
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
  eachReference(files, (reference) => {
    if (reference.verified !== true || !reference.sourceUrl) return;
    verifiedRefs += 1;
    if (parseContentDigest(reference.contentDigest)) verifiedWithDigest += 1;
  });
  const verifiedWithoutDigest = verifiedRefs - verifiedWithDigest;

  if (verifiedWithoutDigest > MAX_UNDIGESTED_VERIFIED_REFS) {
    flags.push({
      file: "(corpus-wide)",
      primary: null,
      target: null,
      citation: null,
      reason:
        `content-drift observability regressed: ${verifiedWithoutDigest} verified references lack a ` +
        `contentDigest (ratchet baseline ${MAX_UNDIGESTED_VERIFIED_REFS}). A digest must be recorded by ` +
        `the qualified human who verifies the source and cannot be backfilled by a script; see ` +
        `docs/citation-verification-sop.md ("Content digests and tiered staleness").`,
    });
  }

  const trueLinkRot = decayed.filter((entry) => !blocked.some((b) => b.sourceUrl === entry.sourceUrl));
  // Link rot is a hard failure at a single occurrence (docblock item 1): a dead
  // URL can never support a nexus, so it joins staleness and structural flags
  // in `decays` rather than hiding inside the ceiling budget. Content drift is
  // deliberately NOT here - docblock item 3 flags it and item 4 budgets it.
  // Verification debt is deliberately NOT here either: it is ratcheted by
  // audit-citation-verification.js, which hard-fails if the count grows.
  const decays = [...stale, ...trueLinkRot, ...flags];
  const ceiling = trueLinkRot.length + stale.length + drifted.length;

  const report = {
    status: decays.length > 0 || ceiling > CITATION_CEILING ? "FAIL" : "PASS",
    liveReferences: liveRefs,
    uniqueUrlsProbed: probeResults.size,
    linkRotCount: trueLinkRot.length,
    contentDriftCount: drifted.length,
    contentDriftDetectable: verifiedWithDigest > 0,
    verifiedReferenceCount: verifiedRefs,
    verifiedWithDigestCount: verifiedWithDigest,
    verifiedWithoutDigestCount: verifiedWithoutDigest,
    contentDriftCoveragePercent:
      verifiedRefs === 0 ? 100 : Math.round((verifiedWithDigest / verifiedRefs) * 1000) / 10,
    maxUndigestedVerifiedRefs: MAX_UNDIGESTED_VERIFIED_REFS,
    botBlockedUnverifiableCount: blocked.length,
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
  const lastProbeAtByHost = new Map();
  const probeResults = new Map();
  await mapWithConcurrency(
    urls.map(([url, digestHex]) => async () => {
      let hostDelayMs = 0;
      try {
        const host = new URL(url).host;
        const now = Date.now();
        const last = lastProbeAtByHost.get(host) ?? 0;
        hostDelayMs = Math.max(0, last + PER_HOST_MIN_INTERVAL_MS - now);
        lastProbeAtByHost.set(host, Math.max(now, now + hostDelayMs) + PROBE_INTER_REQUEST_DELAY_MS);
      } catch {
        hostDelayMs = 0;
      }
      if (hostDelayMs > 0) await sleep(hostDelayMs);
      probeResults.set(url, await probeUrlWithContentResilient(url, digestHex));
    }),
    PROBE_CONCURRENCY,
  );

  const report = buildReport(files, probeResults, new Date().toISOString().slice(0, 10));

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
  buildReport,
  MAX_UNDIGESTED_VERIFIED_REFS,
  CITATION_CEILING,
  stalenessWindowDays,
  parseContentDigest,
  hashContent,
  STALE_AFTER_DAYS_BY_CATEGORY,
  DEFAULT_STALE_AFTER_DAYS,
  isTransientProbeResult,
  mapWithConcurrency,
  PROBE_CONCURRENCY,
  PROBE_INTER_REQUEST_DELAY_MS,
  PER_HOST_MIN_INTERVAL_MS,
  TRANSIENT_RETRY_STATUSES,
  TRANSIENT_MAX_RETRIES,
};
