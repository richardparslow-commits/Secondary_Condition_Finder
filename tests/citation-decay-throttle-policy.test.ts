import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  buildReport,
  classifyProbeOutcome,
  isThrottleVerdict,
  MAX_HOST_COOLDOWN_MS,
  MAX_HOST_SPACING_MS,
  MAX_RETRY_AFTER_WAIT_MS,
  nextHostSpacing,
  parseRetryAfter,
  PER_HOST_MIN_INTERVAL_MS,
  probeUrlWithContentResilient,
  throttleCooldownMs,
  TRANSIENT_MAX_RETRIES,
} from "../scripts/audit-citation-decay";

/**
 * A host refusing the probe is not a verdict about the reference.
 *
 * The decay audit reported every non-2xx it received as link rot, so a host
 * that answered `429` with `Retry-After: 60` — the sweep of 2026-10-14 hit that
 * 201 times across ~1,700 single-host requests — filed live references as dead
 * links and asked a qualified human to re-verify them. The classification
 * contract pinned here is that the host's own answer decides:
 *
 *  - a request to slow down, or a transport failure on a host that answers
 *    other URLs, is *unverifiable by this probe* (never decay, never a hard
 *    failure, and never human work);
 *  - a definitive failure (404/410, unresolvable host, persistent server error)
 *    is still decay and still hard-fails the gate;
 *  - because a run can end with part of the corpus unasked, the report states
 *    its own coverage, so "no link rot" over half the corpus is not read as
 *    "no link rot".
 *
 * The HTTP layer is exercised against a local server that reproduces those
 * answers, so the retry, Retry-After and classification paths run for real
 * rather than against a hand-built result object.
 */

const hits: Record<string, number> = {};

const server = createServer((req, res) => {
  const route = (req.url ?? "/").split("?")[0];
  hits[route] = (hits[route] ?? 0) + 1;
  switch (route) {
    case "/throttled":
      // A host asking for a full minute of quiet, as PubMed's did.
      res.writeHead(429, { "retry-after": "60" });
      res.end("slow down");
      return;
    case "/recover":
      if (hits[route] === 1) {
        res.writeHead(429, { "retry-after": "1" });
        res.end("slow down");
        return;
      }
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("real body");
      return;
    case "/dead":
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("gone");
      return;
    case "/blocked":
      res.writeHead(403, { "content-type": "text/plain" });
      res.end("no bots");
      return;
    case "/gateway":
      // Persistent 5xx: a broken reference, not a request to slow down.
      res.writeHead(503, { "content-type": "text/plain" });
      res.end("unavailable");
      return;
    default:
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("stable body");
  }
});

let base = "";

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("classifyProbeOutcome: the host's answer decides", () => {
  it("reads a request to slow down as unverifiable, never as decay", () => {
    expect(classifyProbeOutcome({ status: 429 })).toBe("throttled");
    expect(classifyProbeOutcome({ status: 425 })).toBe("throttled");
    // Any response carrying Retry-After is the host asking for quiet, whatever
    // its status — that header is the signal, not the code beside it.
    expect(classifyProbeOutcome({ status: 503, retryAfterMs: 5_000 })).toBe("throttled");
    expect(classifyProbeOutcome({ status: 0, throttled: true, skipped: true })).toBe("throttled");
  });

  it("reads a transport failure on a host that answers as unresponsive", () => {
    for (const errorCode of ["timeout", "ECONNRESET", "EAI_AGAIN"]) {
      expect(classifyProbeOutcome({ status: 0, errorCode }), errorCode).toBe("unresponsive");
    }
  });

  it("keeps a definitive failure as decay", () => {
    for (const result of [
      { status: 404 },
      { status: 410 },
      { status: 500 },
      // 503 without Retry-After: a server that keeps erroring is a broken
      // reference. Only the host's own Retry-After admits it as throttling.
      { status: 503 },
      // An unresolvable host is a dead citation, not an unresponsive one.
      { status: 0, errorCode: "ENOTFOUND" },
      { status: 0, errorCode: "ECONNREFUSED" },
      // A failure with no identifying code is never quietly excused.
      { status: 0, errorCode: null },
    ]) {
      expect(classifyProbeOutcome(result), JSON.stringify(result)).toBe("decay");
    }
  });

  it("keeps bot walls and successes on their own verdicts", () => {
    expect(classifyProbeOutcome({ ok: true, status: 403, blocked: true })).toBe("blocked");
    expect(classifyProbeOutcome({ ok: true, status: 200 })).toBe("ok");
    expect(classifyProbeOutcome({ ok: true, status: 200, drift: true })).toBe("drift");
    expect(classifyProbeOutcome(undefined)).toBe("unprobed");
  });
});

describe("Retry-After and per-host pacing", () => {
  it("parses both RFC 9110 forms and rejects everything else", () => {
    const now = Date.parse("2026-10-14T00:00:00Z");
    expect(parseRetryAfter("60", now)).toBe(60_000);
    expect(parseRetryAfter(" 1 ", now)).toBe(1_000);
    expect(parseRetryAfter("Wed, 14 Oct 2026 00:00:30 GMT", now)).toBe(30_000);
    // A date in the past means "now", not a negative wait.
    expect(parseRetryAfter("Wed, 14 Oct 2026 00:00:00 GMT", Date.parse("2026-10-14T00:01:00Z"))).toBe(0);
    for (const value of [undefined, null, "", "soon", "60s"]) {
      expect(parseRetryAfter(value as string, now)).toBeNull();
    }
  });

  it("treats only non-success, non-bot-wall answers as throttle verdicts", () => {
    expect(isThrottleVerdict({ ok: false, status: 429 })).toBe(true);
    expect(isThrottleVerdict({ ok: false, status: 404 })).toBe(false);
    expect(isThrottleVerdict({ ok: true, status: 200 })).toBe(false);
    // A bot wall is a refusal to answer automated probes, not a throttle.
    expect(isThrottleVerdict({ ok: false, status: 403, blocked: true })).toBe(false);
  });

  it("paces a host down instead of out-waiting it, and recovers on success", () => {
    let spacing = PER_HOST_MIN_INTERVAL_MS;
    spacing = nextHostSpacing(spacing, true);
    expect(spacing).toBeGreaterThan(PER_HOST_MIN_INTERVAL_MS);
    for (let i = 0; i < 10; i += 1) spacing = nextHostSpacing(spacing, true);
    expect(spacing).toBe(MAX_HOST_SPACING_MS);
    for (let i = 0; i < 10; i += 1) spacing = nextHostSpacing(spacing, false);
    // Never below the floor: recovering means back to the polite pace, not to
    // hammering.
    expect(spacing).toBe(PER_HOST_MIN_INTERVAL_MS);
  });

  it("bounds the cooldown a host can impose", () => {
    expect(throttleCooldownMs({ retryAfterMs: 60_000 })).toBe(60_000);
    expect(throttleCooldownMs({ retryAfterMs: 3_600_000 })).toBe(MAX_HOST_COOLDOWN_MS);
    expect(throttleCooldownMs({ retryAfterMs: null })).toBe(0);
    expect(throttleCooldownMs({})).toBe(0);
    expect(MAX_RETRY_AFTER_WAIT_MS).toBeLessThanOrEqual(MAX_HOST_COOLDOWN_MS);
    expect(TRANSIENT_MAX_RETRIES).toBeGreaterThan(0);
  });
});

/**
 * The audit is plain JS, so the fields its probe results *may* carry are typed
 * here rather than inferred from whichever branch produced them.
 */
interface ProbeOutcome {
  ok?: boolean;
  status?: number;
  throttled?: boolean;
  blocked?: boolean;
  body?: string;
  retryAfterMs?: number | null;
  errorCode?: string | null;
}

const probe = (url: string) =>
  probeUrlWithContentResilient(url) as Promise<ProbeOutcome>;

describe("the probe's real HTTP path against a host that refuses", () => {
  it(
    "reports a 429 + Retry-After: 60 as throttled without spending the minute",
    async () => {
      const started = Date.now();
      const result = await probe(`${base}/throttled`);
      const elapsed = Date.now() - started;

      expect(result.status).toBe(429);
      expect(result.throttled).toBe(true);
      expect(classifyProbeOutcome(result)).toBe("throttled");
      // The host asked for 60s; a run that cannot afford it must believe the
      // host rather than sleep through its own budget.
      expect(elapsed).toBeLessThan(3_000);
      // And it did ask exactly once before drawing that conclusion.
      expect(hits["/throttled"]).toBe(1);
    },
    20_000,
  );

  it(
    "honours a short Retry-After and returns the real verdict once the host recovers",
    async () => {
      const result = await probe(`${base}/recover`);

      expect(result.status).toBe(200);
      expect(result.body).toContain("real body");
      expect(classifyProbeOutcome(result)).toBe("ok");
      expect(hits["/recover"]).toBeGreaterThan(1);
    },
    20_000,
  );

  it("still reports a genuinely dead URL as decay", async () => {
    const result = await probe(`${base}/dead`);
    expect(result.status).toBe(404);
    expect(classifyProbeOutcome(result)).toBe("decay");
  });

  it(
    "keeps a persistent server error as decay, not throttling",
    async () => {
      // 503 is retried (a gateway blip is not a verdict), and only the host's
      // own Retry-After would admit it as throttling. A server that keeps
      // erroring after the full retry budget is a broken reference — the sleeps
      // are the shipped backoff (1.5s + 3s + 6s), hence the generous timeout.
      const result = await probe(`${base}/gateway`);
      expect(result.status).toBe(503);
      expect(classifyProbeOutcome(result)).toBe("decay");
      expect(hits["/gateway"]).toBe(1 + TRANSIENT_MAX_RETRIES);
    },
    25_000,
  );

  it("keeps a bot wall unverifiable by probe", async () => {
    const result = await probe(`${base}/blocked`);
    expect(classifyProbeOutcome(result)).toBe("blocked");
    expect(result.blocked).toBe(true);
  });
});

describe("buildReport: throttling is disclosed, not gated", () => {
  const TODAY = "2026-10-14";
  const THROTTLED_URL = "https://pubmed.ncbi.nlm.nih.gov/30407234/";
  const UNRESPONSIVE_URL = "https://example.gov/flaky";
  const DEAD_URL = "https://example.gov/dead";

  function corpus(sourceUrls: string[]) {
    return [
      {
        file: "primary-x.json",
        data: {
          id: "primary-x",
          draft: false,
          todo: [],
          suggestions: [
            {
              conditionId: "secondary-y",
              rank: 1,
              sourceReferences: sourceUrls.map((sourceUrl, index) => ({
                citation: `Source ${index + 1}`,
                note: "throttle-policy fixture",
                sourceUrl,
                verified: true,
                sourceCheckedOn: TODAY,
              })),
            },
          ],
        },
      },
    ];
  }

  it("does not fail the gate on a run that was refused, and says so", () => {
    const probeResults = new Map([
      [THROTTLED_URL, { ok: false, status: 429, throttled: true, retryAfterMs: 60_000 }],
      [UNRESPONSIVE_URL, { ok: false, status: 0, errorCode: "ECONNRESET", retryAfterMs: null }],
    ]);
    const report = buildReport(corpus([THROTTLED_URL, UNRESPONSIVE_URL]), probeResults, TODAY);

    expect(report.status).toBe("PASS");
    expect(report.linkRotCount).toBe(0);
    expect(report.decayed).toEqual([]);
    expect(report.citationCeilingUsage).toBe(0);
    expect(report.throttledUnverifiableCount).toBe(2);
    expect(report.throttledUnverifiable.map((entry) => entry.reason)).toEqual([
      "throttled",
      "unresponsive",
    ]);
    expect(report.throttledUnverifiable[0].retryAfterSeconds).toBe(60);
    // Coverage is the honest half of "0 link rot": nothing here was checked.
    expect(report.probeCoveragePercent).toBe(0);
    expect(report.definitiveVerdictUrlCount).toBe(0);
    expect(report.unverifiableByProbeUrlCount).toBe(2);
  });

  it("records a host dropped by the circuit breaker as skipped, not dead", () => {
    const report = buildReport(
      corpus([THROTTLED_URL]),
      new Map([
        [THROTTLED_URL, { ok: false, status: 0, throttled: true, skipped: true, retryAfterMs: null }],
      ]),
      TODAY,
    );

    expect(report.status).toBe("PASS");
    expect(report.throttledUnverifiable[0]).toMatchObject({
      reason: "host-throttle-cooldown",
      status: 0,
    });
    expect(report.probeCoveragePercent).toBe(0);
  });

  it("still fails on the references that were actually checked and found dead", () => {
    const probeResults = new Map([
      [THROTTLED_URL, { ok: false, status: 429, throttled: true, retryAfterMs: 60_000 }],
      [DEAD_URL, { ok: false, status: 404 }],
    ]);
    const report = buildReport(corpus([THROTTLED_URL, DEAD_URL]), probeResults, TODAY);

    expect(report.status).toBe("FAIL");
    expect(report.linkRotCount).toBe(1);
    expect(report.decayed.map((entry) => entry.sourceUrl)).toEqual([DEAD_URL]);
    // The refused reference is not re-verification work.
    expect(report.decayed).not.toContainEqual(
      expect.objectContaining({ sourceUrl: THROTTLED_URL }),
    );
    expect(report.throttledUnverifiableCount).toBe(1);
    expect(report.probeCoveragePercent).toBe(50);
  });

  it("qualifies coverage when only part of the sweep produced a verdict", () => {
    const probeResults = new Map([
      [THROTTLED_URL, { ok: false, status: 429, throttled: true, retryAfterMs: 60_000 }],
      [UNRESPONSIVE_URL, { ok: false, status: 0, errorCode: "timeout" }],
      [DEAD_URL, { ok: false, status: 404 }],
      ["https://example.gov/live", { ok: true, status: 200 }],
    ]);
    const report = buildReport(
      corpus([THROTTLED_URL, UNRESPONSIVE_URL, DEAD_URL, "https://example.gov/live"]),
      probeResults,
      TODAY,
    );

    expect(report.uniqueUrlsProbed).toBe(4);
    expect(report.definitiveVerdictUrlCount).toBe(2);
    expect(report.unverifiableByProbeUrlCount).toBe(2);
    expect(report.probeCoveragePercent).toBe(50);
  });
});

describe("the disclosure reaches the surfaces a human reads", () => {
  const workflow = readFileSync(
    path.join(process.cwd(), ".github/workflows/citation-decay-watch.yml"),
    "utf8",
  );
  const summaryJs = workflow.slice(
    workflow.indexOf('-e "'),
    workflow.indexOf('"', workflow.indexOf('-e "') + 4),
  );
  const issueJs = workflow.slice(workflow.indexOf("--input-type=module - <<'NODE'"));

  it("prints throttling and probe coverage in the weekly step summary", () => {
    expect(summaryJs).toContain("report.throttledUnverifiableCount");
    expect(summaryJs).toContain("report.probeCoveragePercent");
    expect(summaryJs).toContain("report.definitiveVerdictUrlCount");
    expect(summaryJs).toContain("report.unverifiableByProbeUrlCount");
    expect(summaryJs).toContain("throttled / unresponsive (unverifiable by probe)");
    expect(summaryJs).toContain("probe coverage (URLs that produced a verdict)");
    // The summary JS sits inside a double-quoted shell string: no backticks.
    expect(summaryJs).not.toContain("`");
  });

  it("carries the same disclosure, and the not-checked qualifier, into the tracking issue", () => {
    expect(issueJs).toContain("report.throttledUnverifiableCount");
    expect(issueJs).toContain("report.probeCoveragePercent");
    expect(issueJs).toContain("report.definitiveVerdictUrlCount");
    expect(issueJs).toContain("report.throttledUnverifiable");
    expect(issueJs).toContain("Throttled or unresponsive (not checked — not decay)");
    // The issue is the surface that asks a human to act, so it must not leave
    // a refused reference looking like a finding.
    expect(issueJs).toContain("was NOT checked");
  });

  it("says so instead of crashing when the sweep never produced a report", () => {
    // A cancelled or timed-out sweep leaves an empty capture, and a probe that
    // never started leaves no artifact at all. Neither is decay, and neither
    // may turn the tracking job into an unhandled JSON syntax error.
    expect(issueJs).toContain("if (!report)");
    expect(issueJs).toContain("the sweep did not complete");
    const downloadStep = workflow.slice(
      workflow.indexOf("Download decay report artifact"),
      workflow.indexOf("Maintain citation decay tracking issue"),
    );
    expect(downloadStep).toContain("continue-on-error: true");
  });

  it("gives the sweep a budget that outlasts it", () => {
    const probeJob = workflow.slice(workflow.indexOf("decay-probe:"), workflow.indexOf("track-decay:"));
    // ~1.7k URLs, two requests each, at a per-host spacing floor (plus throttled
    // hosts' bounded cool-downs) does not fit in the old 20-minute budget: the
    // job would be cancelled mid-sweep and report nothing at all.
    const timeout = /timeout-minutes:\s*(\d+)/.exec(probeJob);
    expect(timeout).not.toBeNull();
    expect(Number(timeout?.[1])).toBeGreaterThanOrEqual(45);
  });

  it("keeps the classification, the disclosure and the decision record wired to the audit", () => {
    const source = readFileSync(
      path.join(process.cwd(), "scripts/audit-citation-decay.js"),
      "utf8",
    );
    const policyRecord = "docs/citation-decay-probe-outcome-policy-2026-10-14.md";
    const sop = readFileSync(path.join(process.cwd(), "docs/citation-verification-sop.md"), "utf8");

    expect(existsSync(path.join(process.cwd(), policyRecord))).toBe(true);
    expect(source).toContain("docs/citation-decay-probe-outcome-policy-2026-10-14.md");
    expect(sop).toContain(policyRecord);
    // The classification must stay the single source of the verdict: a result
    // the probe could not obtain may not re-enter the hard-fail path.
    expect(source).toContain('if (outcome === "throttled" || outcome === "unresponsive")');
    expect(source).toContain("const decays = [...stale, ...trueLinkRot, ...flags];");
    // The circuit breaker trips at its documented cap (MAX_HOST_THROTTLE_EPISODES),
    // so a host is dropped after that many refusals rather than one more.
    expect(source).toContain(
      "if (state.throttleEpisodes >= MAX_HOST_THROTTLE_EPISODES) state.cooledDown = true;",
    );
  });
});
