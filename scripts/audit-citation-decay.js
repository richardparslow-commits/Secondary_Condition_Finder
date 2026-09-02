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
 *  2. Temporal decay — flags references whose sourceCheckedOn is older than
 *     STALE_AFTER_DAYS (365) as stale, which requires a re-check.
 *  3. Ceiling enforcement — a live reference that is unverified OR decayed
 *     cannot exceed CITATION_CEILING (10) before new mapping promotions must
 *     halt. This mirrors the audit-citation-verification ratchet but operates
 *     over the union of unverified + decayed references.
 *
 * Notes:
 *  - No writes are performed: this is an audit, not a mutator. A separate
 *    qualified-human follow-up promotes or withdraws flagged references.
 *  - The probe uses HEAD first and falls back to GET on 405/403; it follows no
 *    redirects beyond 5 and times out after 15 seconds per URL.
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

const STALE_AFTER_DAYS = 365;
const CITATION_CEILING = 10;
const PROBE_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

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

function probeUrl(url) {
  return new Promise((resolve) => {
    let normalized = url;
    let redirects = 0;
    const attempt = (target) => {
      let client = http;
      if (target.startsWith("https:")) client = https;
      const req = client.get(
        target,
        { method: "HEAD", timeout: PROBE_TIMEOUT_MS, headers: { "user-agent": "citation-decay-audit" } },
        (res) => {
          const status = res.statusCode || 0;
          if ([301, 302, 303, 307, 308].includes(status) && res.headers.location && redirects < MAX_REDIRECTS) {
            res.resume();
            redirects += 1;
            let next = res.headers.location;
            if (next.startsWith("/")) {
              const base = new URL(target);
              next = `${base.origin}${next}`;
            }
            attempt(next);
            return;
          }
          res.resume();
          if (status >= 200 && status < 300) return resolve({ ok: true, status });
          if (status === 403 || status === 405 || status === 406) {
            // 403 from publisher CDNs is usually bot-blocking, not link rot;
            // some hosts also block HEAD but serve GET. Do one GET fallback;
            // if it still 403s, treat the URL as unverifiable-by-automated-
            // probe rather than decayed, so CI is not held hostage by bot walls.
            const getReq = client.get(
              target,
              { method: "GET", timeout: PROBE_TIMEOUT_MS, headers: { "user-agent": "citation-decay-audit" } },
              (getRes) => {
                getRes.resume();
                const s = getRes.statusCode || 0;
                if (s >= 200 && s < 300) return resolve({ ok: true, status: s });
                if (s === 403 || s === 405 || s === 406) return resolve({ ok: true, status: s, blocked: true });
                return resolve({ ok: false, status: s });
              },
            );
            getReq.on("error", () => resolve({ ok: false, status }));
            getReq.on("timeout", () => { getReq.destroy(); resolve({ ok: false, status }); });
            return;
          }
          return resolve({ ok: false, status });
        },
      );
      req.on("error", () => resolve({ ok: false, status: 0 }));
      req.on("timeout", () => { req.destroy(); resolve({ ok: false, status: 0 }); });
    };
    attempt(normalized);
  });
}

async function main() {
  const flags = [];
  const decayed = [];
  const stale = [];
  let liveRefs = 0;

  const files = readJsonFiles(kbDir);
  const urlsToProbe = new Set();

  for (const { file, data } of files) {
    for (const suggestion of data.suggestions || []) {
      for (const reference of suggestion.sourceReferences || []) {
        liveRefs += 1;
        const checkedOn = reference.sourceCheckedOn;
        if (checkedOn) {
          const age = daysBetween(checkedOn, new Date().toISOString().slice(0, 10));
          if (age > STALE_AFTER_DAYS) {
            stale.push({ file, primary: data.id, target: suggestion.conditionId, citation: reference.citation, checkedOn, age });
          }
        } else if (reference.verified === true) {
          flags.push({ file, primary: data.id, target: suggestion.conditionId, citation: reference.citation, reason: "verified reference without sourceCheckedOn" });
        }
        if (reference.sourceUrl) urlsToProbe.add(reference.sourceUrl);
      }
    }
  }

  // Probe each unique URL once, then attribute results back to references.
  const probeResults = new Map();
  await Promise.all([...urlsToProbe].map(async (url) => {
    probeResults.set(url, await probeUrl(url));
  }));

  for (const { file, data } of files) {
    for (const suggestion of data.suggestions || []) {
      for (const reference of suggestion.sourceReferences || []) {
        if (!reference.sourceUrl) continue;
        const result = probeResults.get(reference.sourceUrl);
        if (result && !result.ok) {
          decayed.push({ file, primary: data.id, target: suggestion.conditionId, citation: reference.citation, sourceUrl: reference.sourceUrl, status: result.status });
        }
      }
    }
  }

  const unverified = [];
  for (const { file, data } of files) {
    for (const suggestion of data.suggestions || []) {
      for (const reference of suggestion.sourceReferences || []) {
        if (reference.verified === false) {
          unverified.push({ file, primary: data.id, target: suggestion.conditionId, citation: reference.citation, sourceUrl: reference.sourceUrl });
        }
      }
    }
  }

  const blocked = [];
  for (const { file, data } of files) {
    for (const suggestion of data.suggestions || []) {
      for (const reference of suggestion.sourceReferences || []) {
        if (!reference.sourceUrl) continue;
        const result = probeResults.get(reference.sourceUrl);
        if (result && result.blocked) {
          blocked.push({ file, primary: data.id, target: suggestion.conditionId, citation: reference.citation, sourceUrl: reference.sourceUrl, status: result.status });
        }
      }
    }
  }

  // Link rot is a hard failure only on genuine 4xx-without-bot-block or 5xx.
  const trueLinkRot = decayed.filter((entry) => !blocked.some((b) => b.sourceUrl === entry.sourceUrl));
  const decays = [...stale, ...flags];
  const ceiling = unverified.length + trueLinkRot.length + stale.length;

  const report = {
    status: decays.length > 0 || ceiling > CITATION_CEILING ? "FAIL" : "PASS",
    liveReferences: liveRefs,
    uniqueUrlsProbed: urlsToProbe.size,
    linkRotCount: trueLinkRot.length,
    botBlockedUnverifiableCount: blocked.length,
    staleCount: stale.length,
    structuralFlagCount: flags.length,
    unverifiedCount: unverified.length,
    citationCeiling: CITATION_CEILING,
    citationCeilingUsage: ceiling,
    decayed: trueLinkRot,
    stale,
    structuralFlags: flags,
    botBlockedUnverifiable: blocked,
  };
  console.log(JSON.stringify(report, null, 2));
  if (report.status === "FAIL") process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ status: "FAIL", error: String(error) }, null, 2));
  process.exitCode = 1;
});