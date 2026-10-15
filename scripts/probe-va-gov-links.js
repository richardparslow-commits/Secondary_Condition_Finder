#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * VA.gov walkthrough deep-link probe (npm run probe:va-gov-walkthrough).
 *
 * The guided VA.gov records-download walkthrough
 * (src/lib/secondary-workflow/va-gov-record-walkthrough.ts) deep-links
 * veterans straight into VA.gov routes. When VA.gov renames or removes one of
 * those routes, the only symptom today is a veteran hitting a 404 mid-flow.
 * This probe catches route rot automatically.
 *
 * Source of truth: the authored walkthrough module itself. URLs are extracted
 * from the file's `url:` fields so an added step is probed automatically; the
 * test suite cross-checks the extractor against the compiled step array so
 * extraction drift cannot go unnoticed.
 *
 * Probe design (no browser automation, no DOM scraping — DOM/flow drift is
 * still caught by human walkthrough review per the module's own disclaimer):
 * - One GET per unique URL, browser-like User-Agent, 15s timeout, at most two
 *   redirects followed by hand so each hop is classified (polite: 14 URLs max).
 * - Auth-aware verdicts: VA.gov's my-health routes sit behind login and 3xx
 *   redirect to the sign-in flow — that is the route being ALIVE, not dead.
 *   Only definitive "no such route" responses (404/410) fail the probe;
 *   everything else (200, redirects, 401/403, 5xx) is alive-or-inconclusive.
 *
 * Exit codes: 0 = no dead links; 1 = at least one dead route
 * (404/410); 2 = infrastructure error (probe itself could not run).
 *
 * Output contract: in `--json` mode stdout carries exactly one JSON document
 * and nothing else, because the scheduled workflow captures stdout with
 * `> va-gov-walkthrough-probe-report.json`. Progress and per-URL lines go to
 * stderr there, where a human still reads them in the run log. This is not
 * cosmetic: until 2026-10-14 the progress banner was written ahead of the JSON
 * on stdout, both workflow readers parsed the whole captured file, and so a run
 * whose deep link had genuinely rotted died on `JSON.parse` — the step summary
 * was silently dropped and the tracking issue was never opened, which left the
 * probe unable to report the exact failure it exists to catch
 * (docs/va-gov-probe-handoff-policy-2026-10-14.md).
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

const WALKTHROUGH_MODULE_PATH = path.join(
  process.cwd(),
  "src/lib/secondary-workflow/va-gov-record-walkthrough.ts",
);

const PROBE_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 SecondaryConditionFinderLinkProbe/1.0";
const PROBE_TIMEOUT_MS = 15_000;
const MAX_REDIRECT_HOPS = 2;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Verdicts. Only `dead` fails the run. */
const VERDICT_ALIVE = "alive";
const VERDICT_AUTH_REDIRECT = "auth-redirect";
const VERDICT_SERVER_ERROR = "server-error";
const VERDICT_UNREACHABLE = "unreachable";
const VERDICT_DEAD = "dead";

/**
 * Routes this probe's two kinds of output. In `--json` mode the human-readable
 * lines go to stderr and stdout receives one JSON document, so a shell redirect
 * captures something `JSON.parse` accepts. Without `--json` (the maintainer run,
 * `npm run probe:va-gov-walkthrough`) everything stays on stdout as before.
 * Injected streams keep that routing testable without spawning a process.
 */
function createOutput({ json = false, stdout = process.stdout, stderr = process.stderr } = {}) {
  return {
    note(message) {
      (json ? stderr : stdout).write(`${message}\n`);
    },
    report(value) {
      if (json) stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    },
  };
}

/**
 * Extracts `url: "…"` literals from the authored walkthrough module source.
 * Deliberately a plain-text extraction (not an import) so the script stays a
 * dependency-free node script; tests pin the extractor against the compiled
 * step array so drift between the two is caught.
 */
function extractWalkthroughUrls(source) {
  const urls = [];
  const pattern = /\burl:\s*\n?\s*"([^"]+)"/g;
  for (const match of source.matchAll(pattern)) {
    urls.push(match[1]);
  }
  return [...new Set(urls)];
}

function loadWalkthroughUrls(modulePath = WALKTHROUGH_MODULE_PATH) {
  const source = fs.readFileSync(modulePath, "utf8");
  const urls = extractWalkthroughUrls(source);
  if (urls.length === 0) {
    throw new Error(
      `No walkthrough URLs found in ${modulePath}; the extraction pattern may need updating.`,
    );
  }
  return urls;
}

function classifyStatus(status) {
  if (status === 404 || status === 410) return VERDICT_DEAD;
  if (status >= 200 && status < 300) return VERDICT_ALIVE;
  if (REDIRECT_STATUSES.has(status)) return VERDICT_AUTH_REDIRECT;
  if (status === 401 || status === 403) return VERDICT_AUTH_REDIRECT;
  if (status >= 500) return VERDICT_SERVER_ERROR;
  return VERDICT_UNREACHABLE;
}

/**
 * Performs one probe with at most MAX_REDIRECT_HOPS redirects followed by
 * hand so each hop's status is classified. Resolves { finalStatus, hops,
 * verdict } on any completed HTTP exchange; rejects only when no HTTP
 * exchange was possible (DNS/network/timeout).
 */
function probeUrlOnce(url) {
  return new Promise((resolve, reject) => {
    let currentUrl = url;
    let hops = 0;

    const attempt = () => {
      if (hops > MAX_REDIRECT_HOPS) {
        resolve({ finalStatus: null, hops, verdict: VERDICT_UNREACHABLE, redirectLoop: true });
        return;
      }
      let parsed;
      try {
        parsed = new URL(currentUrl);
      } catch {
        reject(new Error(`Invalid URL: ${currentUrl}`));
        return;
      }
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        reject(new Error(`Unsupported protocol: ${parsed.protocol}`));
        return;
      }

      const isHttps = parsed.protocol === "https:";
      const transport = isHttps ? https : http;
      const request = transport.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || (isHttps ? 443 : 80),
          path: `${parsed.pathname}${parsed.search}`,
          method: "GET",
          headers: {
            "user-agent": PROBE_USER_AGENT,
            accept: "text/html,application/xhtml+xml",
            "accept-language": "en-US,en;q=0.9",
          },
          timeout: PROBE_TIMEOUT_MS,
        },
        (response) => {
          const status = response.statusCode ?? 0;
          response.resume();
          if (REDIRECT_STATUSES.has(status)) {
            const location = response.headers.location;
            if (location) {
              hops += 1;
              currentUrl = new URL(location, currentUrl).toString();
              attempt();
              return;
            }
            resolve({ finalStatus: status, hops, verdict: classifyStatus(status) });
            return;
          }
          resolve({ finalStatus: status, hops, verdict: classifyStatus(status) });
        },
      );
      request.on("timeout", () => {
        request.destroy(new Error(`timed out after ${PROBE_TIMEOUT_MS}ms`));
      });
      request.on("error", (error) => {
        reject(error);
      });
      request.end();
    };

    attempt();
  });
}

/** Probes one URL, translating "no HTTP exchange" into an inconclusive verdict. */
async function probeUrl(url) {
  try {
    const result = await probeUrlOnce(url);
    return { url, ...result };
  } catch (error) {
    return {
      url,
      finalStatus: null,
      hops: 0,
      verdict: VERDICT_UNREACHABLE,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function probeAll(urls, { delayMs = 1_500 } = {}) {
  const results = [];
  for (const [index, url] of urls.entries()) {
    if (index > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    results.push(await probeUrl(url));
  }
  return results;
}

function buildReport(results) {
  const dead = results.filter((result) => result.verdict === VERDICT_DEAD);
  const serverErrors = results.filter(
    (result) => result.verdict === VERDICT_SERVER_ERROR,
  );
  const unreachable = results.filter(
    (result) => result.verdict === VERDICT_UNREACHABLE,
  );
  const alive = results.filter(
    (result) =>
      result.verdict === VERDICT_ALIVE ||
      result.verdict === VERDICT_AUTH_REDIRECT,
  );

  return {
    probedAt: new Date().toISOString(),
    totalUrls: results.length,
    aliveCount: alive.length,
    deadCount: dead.length,
    serverErrorCount: serverErrors.length,
    unreachableCount: unreachable.length,
    status: dead.length > 0 ? "FAIL" : "PASS",
    results,
    dead,
    serverErrors,
    unreachable,
  };
}

async function main() {
  const out = createOutput({ json: process.argv.includes("--json") });
  let urls;
  try {
    urls = loadWalkthroughUrls();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`va-gov-walkthrough-probe: ${detail}`);
    process.exitCode = 2;
    return;
  }

  out.note(
    `va-gov-walkthrough-probe: probing ${urls.length} walkthrough deep-link(s)…`,
  );
  const results = await probeAll(urls);
  const report = buildReport(results);

  for (const result of results) {
    const status = result.finalStatus ?? (result.error ? "ERR" : "n/a");
    out.note(
      `  [${result.verdict}] ${result.url} (status ${status}${result.hops ? `, ${result.hops} redirect(s)` : ""})`,
    );
  }
  out.note(
    `va-gov-walkthrough-probe: ${report.status} — ${report.aliveCount} alive, ${report.deadCount} dead, ${report.serverErrorCount} server-error, ${report.unreachableCount} unreachable.`,
  );

  out.report(report);

  process.exitCode = report.status === "FAIL" ? 1 : 0;
}

module.exports = {
  createOutput,
  VERDICT_ALIVE,
  VERDICT_AUTH_REDIRECT,
  VERDICT_SERVER_ERROR,
  VERDICT_UNREACHABLE,
  VERDICT_DEAD,
  WALKTHROUGH_MODULE_PATH,
  extractWalkthroughUrls,
  loadWalkthroughUrls,
  classifyStatus,
  probeUrlOnce,
  probeUrl,
  probeAll,
  buildReport,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(
      `va-gov-walkthrough-probe: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 2;
  });
}
