import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildReport,
  classifyStatus,
  extractWalkthroughUrls,
  loadWalkthroughUrls,
  VERDICT_ALIVE,
  VERDICT_AUTH_REDIRECT,
  VERDICT_DEAD,
  VERDICT_SERVER_ERROR,
  VERDICT_UNREACHABLE,
} from "../scripts/probe-va-gov-links";

/**
 * Contract tests for the VA.gov walkthrough deep-link probe. No network in
 * unit tests: these pin the pure surfaces — URL extraction from the authored
 * walkthrough module, auth-aware verdict classification, and report
 * aggregation/exit semantics. The probe itself runs on the weekly schedule
 * (and via npm run probe:va-gov-walkthrough) with polite single-GET probing.
 */

describe("extractWalkthroughUrls", () => {
  it("extracts every url field and dedupes", () => {
    const source = [
      'url: "https://www.va.gov/?next=loginModal&oauth=true",',
      'url: "https://www.va.gov/my-va/?postLogin=true",',
      'url: "https://www.va.gov/my-health",',
      'url: "https://www.va.gov/my-health",',
      "detail: 'no url here',",
    ].join("\n");

    expect(extractWalkthroughUrls(source)).toEqual([
      "https://www.va.gov/?next=loginModal&oauth=true",
      "https://www.va.gov/my-va/?postLogin=true",
      "https://www.va.gov/my-health",
    ]);
  });

  it("handles url fields on the line after the key", () => {
    const source = ['url:\n    "https://www.va.gov/my-health/medical-records/",'].join(
      "\n",
    );
    expect(extractWalkthroughUrls(source)).toEqual([
      "https://www.va.gov/my-health/medical-records/",
    ]);
  });
});

describe("loadWalkthroughUrls (real walkthrough module)", () => {
  it("extracts exactly the URLs on the compiled walkthrough steps", () => {
    // Cross-check the plain-text extractor against the authored steps so
    // extraction drift can never go unnoticed.
    const walkthroughPath = path.join(
      process.cwd(),
      "src/lib/secondary-workflow/va-gov-record-walkthrough.ts",
    );
    const moduleSource = fs.readFileSync(walkthroughPath, "utf8");
    const urlFields = [
      ...moduleSource.matchAll(/\burl:\s*\n?\s*"([^"]+)"/g),
    ].map((match) => match[1]);

    const extracted = loadWalkthroughUrls();
    expect(extracted.length).toBeGreaterThan(0);
    expect(extracted).toEqual([...new Set(urlFields)]);
  });

  it("throws with guidance when extraction finds nothing", () => {
    const emptyModule = path.join(process.cwd(), "does-not-exist.ts");
    expect(() => loadWalkthroughUrls(emptyModule)).toThrow();
  });
});

describe("classifyStatus (auth-aware verdicts)", () => {
  it("classifies definitive gone routes as dead", () => {
    expect(classifyStatus(404)).toBe(VERDICT_DEAD);
    expect(classifyStatus(410)).toBe(VERDICT_DEAD);
  });

  it("classifies login redirects and auth challenges as auth-redirect (alive)", () => {
    // VA.gov's my-health routes sit behind login; a redirect to the sign-in
    // flow is the route being alive, not dead.
    expect(classifyStatus(301)).toBe(VERDICT_AUTH_REDIRECT);
    expect(classifyStatus(302)).toBe(VERDICT_AUTH_REDIRECT);
    expect(classifyStatus(303)).toBe(VERDICT_AUTH_REDIRECT);
    expect(classifyStatus(307)).toBe(VERDICT_AUTH_REDIRECT);
    expect(classifyStatus(308)).toBe(VERDICT_AUTH_REDIRECT);
    expect(classifyStatus(401)).toBe(VERDICT_AUTH_REDIRECT);
    expect(classifyStatus(403)).toBe(VERDICT_AUTH_REDIRECT);
  });

  it("classifies 2xx as alive and 5xx as server-error", () => {
    expect(classifyStatus(200)).toBe(VERDICT_ALIVE);
    expect(classifyStatus(204)).toBe(VERDICT_ALIVE);
    expect(classifyStatus(500)).toBe(VERDICT_SERVER_ERROR);
    expect(classifyStatus(503)).toBe(VERDICT_SERVER_ERROR);
  });

  it("classifies unexpected statuses as inconclusive, never dead", () => {
    expect(classifyStatus(429)).toBe(VERDICT_UNREACHABLE);
    expect(classifyStatus(418)).toBe(VERDICT_UNREACHABLE);
    expect(classifyStatus(0)).toBe(VERDICT_UNREACHABLE);
  });
});

describe("buildReport (aggregation and exit semantics)", () => {
  it("passes when everything is alive or auth-redirected", () => {
    const report = buildReport([
      { url: "https://www.va.gov/", finalStatus: 200, hops: 0, verdict: VERDICT_ALIVE },
      {
        url: "https://www.va.gov/my-health",
        finalStatus: 302,
        hops: 1,
        verdict: VERDICT_AUTH_REDIRECT,
      },
    ]);

    expect(report.status).toBe("PASS");
    expect(report.deadCount).toBe(0);
    expect(report.aliveCount).toBe(2);
  });

  it("fails when any deep link is a dead route", () => {
    const report = buildReport([
      { url: "https://www.va.gov/my-health", finalStatus: 302, hops: 1, verdict: VERDICT_AUTH_REDIRECT },
      { url: "https://www.va.gov/my-health/medical-records/gone", finalStatus: 404, hops: 2, verdict: VERDICT_DEAD },
    ]);

    expect(report.status).toBe("FAIL");
    expect(report.deadCount).toBe(1);
    expect(report.dead[0]?.url).toBe(
      "https://www.va.gov/my-health/medical-records/gone",
    );
  });

  it("reports server errors and unreachable links without failing the run", () => {
    const report = buildReport([
      { url: "https://www.va.gov/a", finalStatus: 503, hops: 0, verdict: VERDICT_SERVER_ERROR },
      {
        url: "https://www.va.gov/b",
        finalStatus: null,
        hops: 0,
        verdict: VERDICT_UNREACHABLE,
        error: "getaddrinfo ENOTFOUND www.va.gov",
      },
    ]);

    // VA.gov having a bad moment must not read as route rot; the counts
    // surface for humans while the verdict stays inconclusive.
    expect(report.status).toBe("PASS");
    expect(report.serverErrorCount).toBe(1);
    expect(report.unreachableCount).toBe(1);
    expect(report.deadCount).toBe(0);
  });

  it("summarizes the probed URL count", () => {
    const report = buildReport([]);
    expect(report.totalUrls).toBe(0);
    expect(report.status).toBe("PASS");
  });
});
