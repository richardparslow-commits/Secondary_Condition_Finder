import fs from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  REFUSAL_REPORT_MAX_SURFACES,
  REFUSAL_WINDOW_MAX_EVENTS,
  REFUSAL_WINDOW_MS,
  admissionRefusalWindowReport,
  clearAdmissionRefusalWindow,
  recordAdmissionRefusal,
} from "@/lib/observability/refusal-window";
import { healthLimiter, unattributedAdmissionLimiter } from "@/lib/rate-limiter";
import { proxy } from "@/proxy";

/**
 * The inbound-admission refusal window (SEC-02).
 *
 * `chargeAdmission` decided which budget refused from the day the shared ceiling
 * landed, and the 429 body deliberately never said so — which left the gap the
 * deployment-readiness note recorded: ceiling saturation was not directly
 * alertable, so a 429 count could not be read as a capacity signal. This suite
 * pins the fix at both ends: the window's own bounds and aggregation, and the
 * proxy/health wiring that makes a real refusal readable.
 */

const PROJECT_ROOT = process.cwd();

function read(relative: string): string {
  return fs.readFileSync(path.join(PROJECT_ROOT, relative), "utf8");
}

beforeEach(() => {
  clearAdmissionRefusalWindow();
});

afterEach(() => {
  vi.unstubAllEnvs();
  clearAdmissionRefusalWindow();
  healthLimiter.reset();
  unattributedAdmissionLimiter(process.env).reset();
});

describe("admission refusal window", () => {
  // This split is the whole point of the module: a refusal count alone cannot
  // distinguish one client at its own limit from the shared ceiling being spent
  // by everybody.
  it("keeps the two budgets apart and reports the ceiling's share", () => {
    recordAdmissionRefusal({ surface: "reference-read", budget: "ceiling" });
    recordAdmissionRefusal({ surface: "reference-read", budget: "ceiling" });
    recordAdmissionRefusal({ surface: "/api/health", budget: "ceiling" });
    recordAdmissionRefusal({ surface: "/api/health", budget: "per-client" });

    const report = admissionRefusalWindowReport();
    expect(report.scope).toBe("process-local");
    expect(report.received).toBe(4);
    expect(report.byBudget).toEqual({ ceiling: 3, perClient: 1, unidentified: 0 });
    expect(report.ceilingShare).toBe(75);
    expect(report.windowMs).toBe(REFUSAL_WINDOW_MS);
    expect(report.maxEvents).toBe(REFUSAL_WINDOW_MAX_EVENTS);
    // Busiest surface first, so the surface under pressure is at the top, and a
    // surface refused by both budgets is two rows rather than one blended count.
    expect(report.surfaces[0]).toMatchObject({
      surface: "reference-read",
      budget: "ceiling",
      count: 2,
    });
    expect(report.surfaces).toHaveLength(3);
    expect(
      report.surfaces
        .filter((entry) => entry.surface === "/api/health")
        .map((entry) => entry.budget)
        .sort(),
    ).toEqual(["ceiling", "per-client"]);
    expect(report.detail).toMatch(/3 by the shared ceiling \(75% of them\)/);
    expect(report.detail).toMatch(/per instance/);
  });

  it("reads zero as 'this instance, this window' rather than 'no refusals anywhere'", () => {
    const report = admissionRefusalWindowReport();
    expect(report.received).toBe(0);
    expect(report.ceilingShare).toBeNull();
    expect(report.since).toBeNull();
    expect(report.surfaces).toEqual([]);
    expect(report.detail).toMatch(/no inbound admission refusal/);
    // The edge WAF's own refusals never reach this code, and the window is
    // process-local: a zero must not be read as "nothing was refused anywhere".
    expect(report.detail).toMatch(/edge WAF/);
  });

  it("expires rows out of the window instead of accumulating history", () => {
    vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
    recordAdmissionRefusal({ surface: "method-post", budget: "per-client" });
    expect(admissionRefusalWindowReport().received).toBe(1);

    // Still inside the window: one minute short of the edge.
    vi.setSystemTime(new Date(Date.now() + REFUSAL_WINDOW_MS - 60_000));
    expect(admissionRefusalWindowReport().received).toBe(1);

    // Past it: the reading describes the current deploy, not its history.
    vi.setSystemTime(new Date(Date.now() + 61_000));
    const expired = admissionRefusalWindowReport();
    expect(expired.received).toBe(0);
    expect(expired.surfaces).toEqual([]);
  });

  // The refusal path is reachable by an unauthenticated caller, so a refusal
  // storm must not be able to grow the process that is refusing it.
  it("bounds retention so a storm drops its own oldest rows and says so", () => {
    for (let index = 0; index < REFUSAL_WINDOW_MAX_EVENTS + 5; index += 1) {
      recordAdmissionRefusal({ surface: "method-post", budget: "ceiling" });
    }
    const report = admissionRefusalWindowReport();
    expect(report.received).toBe(REFUSAL_WINDOW_MAX_EVENTS);
    expect(report.evicted).toBe(5);
    expect(report.detail).toMatch(/5 dropped at the retention bound/);
  });

  it("caps the reported surface list and records how many it omitted", () => {
    for (let index = 0; index < REFUSAL_REPORT_MAX_SURFACES + 3; index += 1) {
      recordAdmissionRefusal({ surface: `/api/surface-${index}`, budget: "per-client" });
    }
    const report = admissionRefusalWindowReport();
    expect(report.received).toBe(REFUSAL_REPORT_MAX_SURFACES + 3);
    expect(report.surfaces).toHaveLength(REFUSAL_REPORT_MAX_SURFACES);
    expect(report.surfacesOmitted).toBe(3);
  });

  // A caller is a second bound, not a trust boundary: this module owns what the
  // public health payload can say, so a new caller cannot widen its vocabulary.
  it("bounds a surface label and an unknown budget instead of trusting the caller", () => {
    recordAdmissionRefusal({ surface: "not a surface!", budget: "ceiling" });
    recordAdmissionRefusal({ surface: "x".repeat(200), budget: "ceiling" });
    recordAdmissionRefusal({
      surface: "/api/health",
      budget: "edge-waf" as unknown as "ceiling",
    });

    const report = admissionRefusalWindowReport();
    expect(report.received).toBe(3);
    expect(report.surfaces.map((entry) => entry.surface)).toEqual(["unknown", "/api/health"]);
    expect(report.unknownBudget).toBe(1);
    expect(report.byBudget).toEqual({ ceiling: 2, perClient: 0, unidentified: 0 });
    expect(report.detail).toMatch(/1 with an unrecognised refusal reason/);
  });

  // The third budget is the one that reports a *wrong declaration*: the deployment
  // said its ingress always writes the identity, and a request without one arrived.
  it("counts the class bucket's refusals as their own reading", () => {
    recordAdmissionRefusal({ surface: "reference-read", budget: "unidentified" });
    recordAdmissionRefusal({ surface: "reference-read", budget: "ceiling" });

    const report = admissionRefusalWindowReport();
    expect(report.byBudget).toEqual({ ceiling: 1, perClient: 0, unidentified: 1 });
    expect(report.unknownBudget).toBe(0);
    expect(report.ceilingShare).toBe(50);
    expect(report.detail).toMatch(/1 by the shared bucket for requests that presented no identity/);
    expect(report.detail).toMatch(/the model this deployment declared and the edge it actually runs disagree/);
  });

  it("counts a row's fields, so the payload cannot grow a field later", () => {
    recordAdmissionRefusal({ surface: "method-post", budget: "ceiling" });
    expect(Object.keys(admissionRefusalWindowReport().surfaces[0]!).sort()).toEqual([
      "budget",
      "count",
      "lastRefusedAt",
      "surface",
    ]);
  });

  it("never throws, even when handed a malformed fact", () => {
    expect(() => recordAdmissionRefusal(undefined as never)).not.toThrow();
    expect(() => recordAdmissionRefusal({} as never)).not.toThrow();
    expect(admissionRefusalWindowReport().received).toBe(2);
    expect(admissionRefusalWindowReport().surfaces[0]!.surface).toBe("unknown");
  });
});

describe("a refusal through the real proxy is readable, and names no client", () => {
  const CLIENT = "203.0.113.77";
  const send = (pathname: string, headers: Record<string, string>) =>
    proxy(new NextRequest(`https://example.test${pathname}`, { headers }));

  it("records a ceiling refusal against the route it refused", () => {
    vi.stubEnv("RATE_LIMIT_UNATTRIBUTED_MAX", "2");
    unattributedAdmissionLimiter(process.env).reset();

    // No identity: only the shared ceiling can refuse this request.
    expect(send("/api/health", {}).status).toBe(200);
    expect(send("/api/health", {}).status).toBe(200);
    expect(send("/api/health", {}).status).toBe(429);

    const report = admissionRefusalWindowReport();
    expect(report.received).toBe(1);
    expect(report.byBudget).toEqual({ ceiling: 1, perClient: 0, unidentified: 0 });
    expect(report.ceilingShare).toBe(100);
    expect(report.surfaces[0]).toMatchObject({ surface: "/api/health", budget: "ceiling" });
  });

  it("records a per-client refusal without recording whose bucket it was", () => {
    // 31 requests, one constant identity: the 31st exceeds the per-client limit,
    // which is the other budget the operator has to tell apart from the ceiling.
    for (let index = 0; index < 30; index += 1) {
      expect(send("/api/health", { "x-forwarded-for": CLIENT }).status).toBe(200);
    }
    expect(send("/api/health", { "x-forwarded-for": CLIENT }).status).toBe(429);

    const report = admissionRefusalWindowReport();
    expect(report.byBudget).toEqual({ ceiling: 0, perClient: 1, unidentified: 0 });
    expect(report.surfaces[0]).toMatchObject({ surface: "/api/health", budget: "per-client" });
    // The bucket key is a client address and the health payload is public: the
    // refusal is reported, the refused client is not.
    expect(JSON.stringify(report)).not.toContain(CLIENT);
    expect(JSON.stringify(report)).not.toMatch(/\d{1,3}(\.\d{1,3}){3}/);
  });

  // The end-to-end statement of the fix: an identity-less request is refused by the
  // surface's own budget once the deployment has declared an ingress model, with
  // the aggregate ceiling untouched — instead of being admitted until the ceiling
  // (a much larger allowance) runs out.
  it("bounds an identity-less request by the surface, not by the whole ceiling", () => {
    vi.stubEnv("RATE_LIMIT_TRUSTED_INGRESS", "append");
    vi.stubEnv("RATE_LIMIT_UNATTRIBUTED_MAX", "5000");
    unattributedAdmissionLimiter(process.env).reset();

    for (let index = 0; index < 30; index += 1) {
      expect(send("/api/health", {}).status, `request ${index + 1}`).toBe(200);
    }
    expect(send("/api/health", {}).status).toBe(429);

    const report = admissionRefusalWindowReport();
    expect(report.byBudget).toEqual({ ceiling: 0, perClient: 0, unidentified: 1 });
    expect(report.surfaces[0]).toMatchObject({ surface: "/api/health", budget: "unidentified" });

    // And with no model declared the same 31 requests stay admitted: that is the
    // behaviour this change deliberately leaves alone, and the reason to declare.
    vi.stubEnv("RATE_LIMIT_TRUSTED_INGRESS", "");
    for (let index = 0; index < 31; index += 1) {
      expect(send("/api/health", {}).status, `undeclared request ${index + 1}`).toBe(200);
    }
  });

  it("labels the surfaces the proxy actually polices", () => {
    vi.stubEnv("RATE_LIMIT_UNATTRIBUTED_MAX", "1");
    unattributedAdmissionLimiter(process.env).reset();

    expect(send("/va-forms/finder", {}).status).toBe(200);
    expect(send("/va-forms/finder", {}).status).toBe(429);

    expect(admissionRefusalWindowReport().surfaces).toEqual([
      expect.objectContaining({ surface: "reference-read", budget: "ceiling" }),
    ]);
  });

  it("forwards the window on /api/health instead of re-deriving it", async () => {
    vi.stubEnv("RATE_LIMIT_UNATTRIBUTED_MAX", "1");
    unattributedAdmissionLimiter(process.env).reset();
    expect(send("/api/health", {}).status).toBe(200);
    expect(send("/api/health", {}).status).toBe(429);

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = (await response.json()) as {
      components: { rateLimit: { refusals: Record<string, unknown> } };
    };

    const forwarded = admissionRefusalWindowReport();
    expect(body.components.rateLimit.refusals).toMatchObject({
      scope: "process-local",
      received: forwarded.received,
      byBudget: forwarded.byBudget,
      ceilingShare: forwarded.ceilingShare,
    });
    expect((body.components.rateLimit.refusals as { received: number }).received).toBeGreaterThan(0);
  });
});

/**
 * Wiring pins. These name the two ends a refactor is most likely to drop — the
 * proxy recording the refusal, and health forwarding the one report — because a
 * window nothing writes to reports a persuasive zero.
 */
describe("refusal-window wiring", () => {
  it("records a refusal at every 429 the proxy raises", () => {
    const proxySource = read("src/proxy.ts");
    expect(proxySource).toContain("@/lib/observability/refusal-window");
    expect(proxySource).toContain("recordAdmissionRefusal({ surface, budget: reason })");
    // One call site per limited branch, each labelled with its own surface: the
    // method-scoped POST bucket, the shared reference-read budget, and whatever
    // route policy matched.
    expect(proxySource.match(/recordRefusal\(/g)).toHaveLength(3);
    expect(proxySource).toContain('recordRefusal("method-post", result.refusedBy)');
    expect(proxySource).toContain('recordRefusal("reference-read", result.refusedBy)');
    expect(proxySource).toContain("recordRefusal(routePolicy.path, result.refusedBy)");
  });

  it("reports the window from the capability report, not from the health route", () => {
    const capabilities = read("src/lib/runtime-capabilities.ts");
    expect(capabilities).toContain("admissionRefusalWindowReport()");
    expect(capabilities).toContain("refusals: admissionRefusalWindowReport()");

    // Health reads the report the control owns; it must not count refusals itself.
    const health = read("src/app/api/health/route.ts");
    expect(health).not.toContain("REFUSAL_WINDOW_MAX_EVENTS");
    expect(health).not.toContain("recordAdmissionRefusal");
  });
});
