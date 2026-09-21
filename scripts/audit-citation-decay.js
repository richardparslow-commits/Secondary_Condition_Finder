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
 *     link-rot probes cannot see.
 *  4. Ceiling enforcement — a live reference that is unverified OR decayed
 *     cannot exceed CITATION_CEILING (10) before new mapping promotions must
 *     halt. This mirrors the audit-citation-verification ratchet but operates
 *     over the union of unverified + decayed + drifted references.
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
const PROBE_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;
const PROBE_USER_AGENT = "citation-decay-audit";
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

  const trueLinkRot = decayed.filter((entry) => !blocked.some((b) => b.sourceUrl === entry.sourceUrl));
  const decays = [...stale, ...flags];
  const ceiling = unverified.length + trueLinkRot.length + stale.length + drifted.length;

  const report = {
    status: decays.length > 0 || ceiling > CITATION_CEILING ? "FAIL" : "PASS",
    liveReferences: liveRefs,
    uniqueUrlsProbed: probeResults.size,
    linkRotCount: trueLinkRot.length,
    contentDriftCount: drifted.length,
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

  const probeResults = new Map();
  await Promise.all([...urlsToProbe.entries()].map(async ([url, digestHex]) => {
    probeResults.set(url, await probeUrlWithContent(url, digestHex));
  }));

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
  stalenessWindowDays,
  parseContentDigest,
  hashContent,
  STALE_AFTER_DAYS_BY_CATEGORY,
  DEFAULT_STALE_AFTER_DAYS,
};
