import fs from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CSP_VIOLATION_REPORT_MAX_DIRECTIVES,
  CSP_VIOLATION_WINDOW_MAX_EVENTS,
  CSP_VIOLATION_WINDOW_MS,
  clearCspViolationWindow,
  cspViolationWindowReport,
  recordCspViolationFact,
} from "@/lib/observability/csp-violation-window";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

const INTAKE = "src/app/api/csp-report/route.ts";
const HEALTH = "src/app/api/health/route.ts";
const WINDOW = "src/lib/observability/csp-violation-window.ts";

/**
 * Recent CSP / Trusted-Types violations as an operator-readable runtime fact.
 *
 * `/api/csp-report` already redacted every browser report to a content-free
 * event, and counted it as an OTel metric — which is a no-op without a
 * collector, so in the deployed application a **policy regression was visible
 * only in a visitor's browser console**. The window module keeps the last few
 * minutes of reports in memory and `/api/health` reports them.
 *
 * Two properties have to hold at once, and they pull in opposite directions:
 *
 *   1. an operator can see *that* a regression is happening, which directive
 *      it names, and how much of it — so the fact must survive on a public
 *      payload; and
 *   2. nothing a violation report *contains* reaches that payload — no
 *      document URL, blocked URL, source file, or sample — and the endpoint
 *      must not be able to grow the process or change overall health.
 *
 * So the suite plants real report content and then asserts it is absent from
 * the serialized health body, drives the two real route handlers end to end
 * (POST → GET, not a re-implementation of either), and falsifies the bounds
 * with a flood and a hostile directive name.
 */
describe("recent CSP violation window", () => {
  beforeEach(() => {
    clearCspViolationWindow();
  });

  afterEach(() => {
    clearCspViolationWindow();
    vi.useRealTimers();
  });

  it("counts what it received, per directive, with newest and oldest times", () => {
    recordCspViolationFact({ effectiveDirective: "style-src-attr", disposition: "enforce" });
    recordCspViolationFact({ effectiveDirective: "require-trusted-types-for", disposition: "enforce" });
    recordCspViolationFact({ effectiveDirective: "require-trusted-types-for", disposition: "enforce" });

    const report = cspViolationWindowReport();
    expect(report.scope).toBe("process-local");
    expect(report.received).toBe(3);
    expect(report.windowMs).toBe(CSP_VIOLATION_WINDOW_MS);
    expect(report.maxEvents).toBe(CSP_VIOLATION_WINDOW_MAX_EVENTS);
    // Most-reported first: the directive firing on every page load is the one
    // an operator needs to see at the top of the list.
    expect(report.directives.map((entry) => [entry.directive, entry.count])).toEqual([
      ["require-trusted-types-for", 2],
      ["style-src-attr", 1],
    ]);
    expect(report.directives[0]?.dispositions).toEqual(["enforce"]);
    expect(report.since).not.toBeNull();
    expect(report.lastReceivedAt).not.toBeNull();
    expect(new Date(report.lastReceivedAt!).getTime()).toBeGreaterThanOrEqual(
      new Date(report.since!).getTime(),
    );
    expect(report.detail).toMatch(/3 CSP violation report\(s\) in the last 15m across 2 directive\(s\)/);
    expect(report.detail).toMatch(/per instance/);
  });

  it("reads zero as 'this instance, this window' rather than 'no violations anywhere'", () => {
    const report = cspViolationWindowReport();
    expect(report.received).toBe(0);
    expect(report.since).toBeNull();
    expect(report.lastReceivedAt).toBeNull();
    expect(report.directives).toEqual([]);
    expect(report.detail).toMatch(/no CSP violation report in the last 15m/);
    expect(report.detail).toMatch(/forgets rows on cold start/);
  });

  it("drops violations that leave the window instead of reporting them forever", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
    recordCspViolationFact({ effectiveDirective: "script-src", disposition: "enforce" });
    expect(cspViolationWindowReport().received).toBe(1);

    // Still inside the window: one minute short of the edge.
    vi.setSystemTime(new Date(Date.now() + CSP_VIOLATION_WINDOW_MS - 60_000));
    expect(cspViolationWindowReport().received).toBe(1);

    // Past it: the regression reading is about the current deploy, not history.
    vi.setSystemTime(new Date(Date.now() + 61_000));
    const expired = cspViolationWindowReport();
    expect(expired.received).toBe(0);
    expect(expired.directives).toEqual([]);
    expect(expired.detail).toMatch(/no CSP violation report/);
  });

  it("bounds retention so a flood drops its own oldest rows and says so", () => {
    for (let index = 0; index < CSP_VIOLATION_WINDOW_MAX_EVENTS + 5; index += 1) {
      recordCspViolationFact({ effectiveDirective: "script-src", disposition: "enforce" });
    }
    const report = cspViolationWindowReport();
    expect(report.received).toBe(CSP_VIOLATION_WINDOW_MAX_EVENTS);
    expect(report.evicted).toBe(5);
    expect(report.detail).toMatch(/5 dropped at the retention bound/);
  });

  it("caps the reported directive list and records how many it omitted", () => {
    for (let index = 0; index < CSP_VIOLATION_REPORT_MAX_DIRECTIVES + 3; index += 1) {
      recordCspViolationFact({ effectiveDirective: `directive-${index}`, disposition: "enforce" });
    }
    const report = cspViolationWindowReport();
    expect(report.received).toBe(CSP_VIOLATION_REPORT_MAX_DIRECTIVES + 3);
    expect(report.directives).toHaveLength(CSP_VIOLATION_REPORT_MAX_DIRECTIVES);
    expect(report.directivesOmitted).toBe(3);
  });

  it("re-bounds a hostile directive and disposition rather than echoing them", () => {
    // A caller can only reach the window through the redacting intake today, so
    // this is the second bound, not the trust boundary — it still has to hold.
    recordCspViolationFact({
      effectiveDirective: "BAD DIRECTIVE <script>alert(1)</script>",
      disposition: "x".repeat(200),
    });
    const report = cspViolationWindowReport();
    expect(report.directives.map((entry) => entry.directive)).toEqual(["unknown"]);
    expect(report.directives[0]?.dispositions).toEqual(["enforce"]);
    expect(JSON.stringify(report)).not.toContain("alert(1)");
    expect(JSON.stringify(report)).not.toContain("x".repeat(100));
  });

  it("counts an oversized payload as a report without inventing a directive for it", () => {
    recordCspViolationFact({ effectiveDirective: "unknown", disposition: "enforce", oversized: true });
    recordCspViolationFact({ effectiveDirective: "style-src", disposition: "enforce" });
    const report = cspViolationWindowReport();
    expect(report.received).toBe(2);
    expect(report.oversized).toBe(1);
    expect(report.detail).toMatch(/1 oversized payload\(s\) rejected/);
  });

  it("stores no field that could carry report content", () => {
    // Comments explain what is *deliberately absent*, so they are stripped:
    // the claim is about the stored shape, not the prose around it.
    const source = read(WINDOW)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:"'/])\/\/[^\n]*/g, "$1");
    for (const forbidden of [
      "documentOrigin",
      "blockedOrigin",
      "sourceFileOrigin",
      "sampleFingerprint",
      "document-uri",
      "blocked-uri",
      "sample",
    ]) {
      expect(source, `the window must not know about ${forbidden}`).not.toContain(forbidden);
    }
    // It is not a log sink either: no console, no redacting logger, and no OTel
    // meter — the sink inventory pins the meter count at three.
    expect(source).not.toContain("console.");
    expect(source).not.toContain("observability/logger");
    expect(source).not.toContain("@opentelemetry/api");
  });
});

describe("GET /api/health reports reported violations", () => {
  beforeEach(() => {
    clearCspViolationWindow();
    vi.resetModules();
  });

  afterEach(() => {
    clearCspViolationWindow();
    vi.unstubAllEnvs();
  });

  /** Posts one report through the real intake handler. */
  async function postReport(
    body: unknown,
    headers: Record<string, string> = { "content-type": "application/csp-report" },
  ): Promise<number> {
    const { POST } = await import("@/app/api/csp-report/route");
    const response = await POST(
      new NextRequest("https://example.test/api/csp-report", {
        method: "POST",
        headers,
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );
    return response.status;
  }

  async function health() {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    return { response, body: await response.json() };
  }

  it("surfaces a violation an operator would otherwise only see in a browser console", async () => {
    // Planted content: the report names a real page with a query string, a
    // blocked third-party origin, a source file, and a sample of page script.
    expect(
      await postReport(
        {
          "csp-report": {
            "document-uri": "https://app.example/secondary/upload?next=/x&token=PLANTED-QUERY",
            "effective-directive": "require-trusted-types-for",
            disposition: "enforce",
            "blocked-uri": "https://evil.test/payload-PLANTED-ORIGIN.js",
            "source-file": "https://app.example/_next/static/chunks/PLANTED-CHUNK.js",
            sample: "PLANTED-SAMPLE alert(document.cookie)",
          },
        },
        { "content-type": "application/csp-report", "x-forwarded-for": "203.0.113.11" },
      ),
    ).toBe(204);

    const { response, body } = await health();
    const reported = body.components.cspReports;

    // The regression is now operator-readable: which directive, how much, when.
    expect(reported.status).toBe("ok");
    expect(reported.scope).toBe("process-local");
    expect(reported.received).toBe(1);
    expect(reported.directives).toEqual([
      expect.objectContaining({ directive: "require-trusted-types-for", count: 1, dispositions: ["enforce"] }),
    ]);
    expect(reported.lastReceivedAt).not.toBeNull();
    expect(reported.detail).toMatch(/1 CSP violation report\(s\) in the last 15m across 1 directive\(s\)/);

    // …and nothing the report contained comes with it. The payload is public.
    const serialized = JSON.stringify(body);
    for (const planted of [
      "PLANTED-QUERY",
      "PLANTED-ORIGIN",
      "PLANTED-CHUNK",
      "PLANTED-SAMPLE",
      "evil.test",
      "/secondary/upload",
      "document.cookie",
      "token=",
    ]) {
      expect(serialized, `health leaked ${planted}`).not.toContain(planted);
    }

    // Reporting a violation is not a readiness failure: the deployment can
    // still serve, so a policy finding must not take health down.
    expect(response.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.components.cspReports.status).toBe("ok");
  });

  it("counts a Reporting API array entry with camelCase fields", async () => {
    expect(
      await postReport(
        [
          {
            type: "csp-violation",
            age: 1,
            url: "https://app.example/secondary/upload?token=PLANTED-REPORTING-QUERY",
            body: {
              documentURL: "https://app.example/secondary/upload?token=PLANTED-REPORTING-QUERY",
              effectiveDirective: "img-src",
              blockedURL: "https://evil.example/x.png",
              sourceFile: "https://app.example/_next/static/chunk.js",
              disposition: "enforce",
              sample: "PLANTED-REPORTING-SAMPLE",
            },
          },
        ],
        { "content-type": "application/reports+json", "x-forwarded-for": "203.0.113.14" },
      ),
    ).toBe(204);

    const { body } = await health();
    const reported = body.components.cspReports;
    expect(reported.received).toBe(1);
    expect(reported.directives).toEqual([
      expect.objectContaining({ directive: "img-src", count: 1, dispositions: ["enforce"] }),
    ]);
    const serialized = JSON.stringify(body);
    for (const planted of ["PLANTED-REPORTING", "evil.example", "/secondary/upload"]) {
      expect(serialized, `health leaked ${planted}`).not.toContain(planted);
    }
  });

  it("counts an oversized payload without attributing or echoing it", async () => {
    const oversizedBody = JSON.stringify({
      "csp-report": {
        "document-uri": "https://app.example/",
        "effective-directive": "script-src",
        padding: "PLANTED-OVERSIZED ".repeat(300),
      },
    });
    const byteLength = new TextEncoder().encode(oversizedBody).byteLength;
    expect(byteLength).toBeGreaterThan(4_096);

    expect(
      await postReport(oversizedBody, {
        "content-type": "application/csp-report",
        "content-length": String(byteLength),
        "x-forwarded-for": "203.0.113.12",
      }),
    ).toBe(204);

    const { body } = await health();
    expect(body.components.cspReports.oversized).toBe(1);
    expect(body.components.cspReports.received).toBe(1);
    // A rejected payload has no attribute to report, and its bytes are absent.
    expect(body.components.cspReports.directives.map((entry: { directive: string }) => entry.directive)).toEqual([
      "unknown",
    ]);
    expect(JSON.stringify(body)).not.toContain("PLANTED-OVERSIZED");
  });

  it("keeps the CSP intake's own privacy posture intact", async () => {
    // Content-free answers, no oracle: malformed and wrong-type posts still 204.
    expect(await postReport("{not-json", { "content-type": "application/csp-report", "x-forwarded-for": "203.0.113.13" })).toBe(204);
    expect(await postReport("hello", { "content-type": "text/plain", "x-forwarded-for": "203.0.113.13" })).toBe(204);
    const { body } = await health();
    // Neither learned anything: unparseable and wrong-type bodies are not
    // violations, so they must not appear as reported coverage.
    expect(body.components.cspReports.received).toBe(0);
  });
});

describe("per-run wiring of the reported window", () => {
  it("has the intake record a fact on the accepted path and on the oversized path", () => {
    const route = read(INTAKE);
    expect(route).toContain("recordCspViolationFact(");
    expect(route).toContain("import { recordCspViolationFact }");
    // Both oversized paths go through one helper, so neither can drift out of
    // the report while the other keeps counting.
    // Exactly two call sites (the helper itself is the third textual match):
    // the declared-length rejection and the streaming overrun.
    expect(route.match(/^ {4}recordOversizedReport\(\);/gm) ?? []).toHaveLength(2);
    // The helper's pair — the metric and the window fact — are the only places
    // an unattributed oversized payload is recorded, so a third inline
    // recording (which could drift out of the report) fails here.
    expect(count(route, 'effectiveDirective: "unknown"')).toBe(2);
    // The window is handed bounded fields only — never an origin or a sample.
    expect(route).not.toMatch(
      /recordCspViolationFact\(\{[\s\S]{0,200}(documentOrigin|blockedOrigin|sourceFileOrigin|sampleFingerprint)/,
    );
  });

  it("forwards the window's own report from health instead of re-deriving it", () => {
    const health = read(HEALTH);
    expect(health).toContain("@/lib/observability/csp-violation-window");
    expect(health).toContain("cspViolationWindowReport()");
    expect(health).toContain("...cspReports");
    // The reads the window owns must not be duplicated here; health reads the
    // report, it does not count violations.
    expect(health).not.toContain("CSP_VIOLATION_WINDOW_MAX_EVENTS");
  });

  it("does not let a violation change the readiness verdict", () => {
    const health = read(HEALTH);
    // The healthy computation stays exactly the four integrity components.
    const healthy = health.slice(health.indexOf("const healthy ="), health.indexOf("const status = healthy"));
    expect(healthy).toContain("catalog.status");
    expect(healthy).toContain("sessionCrypto.status");
    expect(healthy).toContain("workflowSession.status");
    expect(healthy).toContain("kbGraph.status");
    expect(healthy).not.toContain("cspReports");
  });
});
