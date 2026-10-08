import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { readBrowserWorkflowContext } from "@/lib/secondary-workflow/browser-context";

const workflowPages = [
  "src/components/secondary/steps/DiagnosedStep.tsx",
  "src/components/secondary/steps/ServiceConnectedStep.tsx",
  "src/components/secondary/steps/RatingsStep.tsx",
  "src/components/secondary/steps/UploadStep.tsx",
  "src/components/secondary/steps/SuggestionsStep.tsx",
  "src/components/secondary/steps/EvidenceStep.tsx",
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("workflow privacy", () => {
  it("does not propagate sensitive secondary-workflow state through URLs", () => {
    for (const file of workflowPages) {
      const source = read(file);
      expect(source).not.toContain("workflowStateToSearchParams");
      expect(source).not.toMatch(/method=["']get["']/i);
      expect(source).not.toMatch(/secondary\/(?:diagnosed|service-connected|ratings|upload|suggestions|evidence)\?[^\n]*(?:diagnosed|serviceConnected|rating-)/);
    }
  });

  it("keeps presumptive service history out of query strings", () => {
    const form = read("src/components/ServiceHistoryForm.tsx");
    const results = read("src/app/presumptive/results/page.tsx");

    expect(form).toContain("action={saveServiceHistory}");
    expect(form).not.toMatch(/method=["']get["']/i);
    expect(form).not.toContain('action="/presumptive/results"');
    // Service history (locations/dates/branch) must not be read from query strings;
    // a narrow ZIP lookup for the accredited-representative public directory is allowed.
    expect(results).not.toContain("params.location");
    expect(results).not.toContain("params.serviceStart");
    expect(results).not.toContain("params.serviceEnd");
    if (results.includes("searchParams")) {
      expect(results).toContain("zip");
      // The ZIP lookup must not also propagate service-history fields via the query string.
      expect(results).not.toMatch(/qpZip\?\.(location|serviceStart|serviceEnd)/);
      expect(results).not.toMatch(/searchParams[^]*\bparams\.location\b/);
    }
  });

  it("keeps secondary workflow state in the browser-local record, not cookies", () => {
    for (const file of [
      "src/lib/secondary-workflow/client-steps.ts",
      "src/lib/secondary-workflow/browser-context.ts",
      "src/lib/secondary-workflow/use-browser-context.ts",
      "src/lib/secondary-workflow/transport.ts",
      "src/components/ScenarioLaunchForm.tsx",
    ]) {
      const source = read(file);
      expect(source).not.toMatch(/from\s+["']next\/headers["']/);
      expect(source).not.toMatch(/document\.cookie/);
    }
    for (const file of workflowPages) {
      const source = read(file);
      expect(source).not.toMatch(/from\s+["']next\/headers["']/);
      expect(source).not.toMatch(/document\.cookie/);
    }

    // Retired, not merely sealed: the legacy module is gone and the proxy
    // tombstones any stale cookie a browser still presents (PRIV-01 stage 3).
    expect(
      fs.existsSync(path.join(process.cwd(), "src/lib/secondary-workflow/session.ts")),
    ).toBe(false);
    const proxy = read("src/proxy.ts");
    expect(proxy).toContain('"secondary-workflow-v2"');
    expect(proxy).toContain("clearRetiredWorkflowCookie");

    // The presumptive track keeps its hardened cookie contract.
    const presumptive = read("src/lib/presumptive/session.ts");
    const crypto = read("src/lib/workflow-session-crypto.ts");
    expect(presumptive).toContain("httpOnly: true");
    expect(presumptive).toContain('sameSite: "strict"');
    expect(presumptive).toContain("WORKFLOW_SESSION_MAX_AGE_SECONDS");
    expect(presumptive).toContain("maxAge: WORKFLOW_SESSION_MAX_AGE_SECONDS");
    expect(presumptive).toContain('path: "/presumptive"');
    expect(crypto).toContain("WORKFLOW_SESSION_MAX_AGE_SECONDS = 30 * 60");
    expect(crypto).toContain('createCipheriv("aes-256-gcm"');
    expect(crypto).toContain("WORKFLOW_SESSION_SECRET");
    expect(crypto).toContain("expiresAt");
  });

  it("treats a tampered, out-of-version or oversized browser-local record as absent", () => {
    const valid = JSON.stringify({
      version: 1,
      diagnosedConditionIds: ["ptsd", "sleep-apnea"],
      serviceConnectedConditionIds: ["ptsd"],
      ratingsByConditionId: { ptsd: 100 },
      documentsShared: true,
    });

    expect(
      readBrowserWorkflowContext({ getItem: () => valid })?.diagnosedConditionIds,
    ).toEqual(["ptsd", "sleep-apnea"]);
    expect(readBrowserWorkflowContext({ getItem: () => "not-json" })).toBeNull();
    expect(
      readBrowserWorkflowContext({
        getItem: () => valid.replace('"version":1', '"version":99'),
      }),
    ).toBeNull();
    expect(
      readBrowserWorkflowContext({
        getItem: () =>
          JSON.stringify({
            version: 1,
            medications: Array.from({ length: 21 }, (_, index) => `medication-${index}`),
          }),
      }),
    ).toBeNull();
  });

  it("never transmits the browser-local record and never builds a URL from it", () => {
    for (const file of [
      "src/lib/secondary-workflow/client-steps.ts",
      "src/lib/secondary-workflow/browser-context.ts",
      "src/lib/secondary-workflow/use-browser-context.ts",
      "src/lib/secondary-workflow/transport.ts",
      "src/components/secondary/SecondaryWorkflowCompletionActions.tsx",
      "src/components/ScenarioLaunchForm.tsx",
    ]) {
      const source = read(file);
      expect(source).not.toContain("sendBeacon");
      expect(source).not.toContain("document.cookie");
    }

    const transport = read("src/lib/secondary-workflow/transport.ts");
    expect(transport).not.toContain("URLSearchParams");
    expect(transport).not.toContain("location.");
  });

  it("keeps browser telemetry disabled while server automatic tracing stays off", () => {
    const layout = read("src/app/layout.tsx");
    const proxy = read("src/proxy.ts");
    const privacy = read("src/app/privacy/page.tsx");
    const instrumentation = read("src/instrumentation.ts");
    const packageJson = read("package.json");
    const packageLock = read("package-lock.json");

    expect(fs.existsSync(path.join(process.cwd(), "src/lib/appInsights.ts"))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), "src/components/AppInsightsInit.tsx"))).toBe(false);
    expect(layout).not.toContain("AppInsightsInit");
    expect(proxy).toContain('connect-src \'self\'');
    expect(proxy).not.toMatch(/applicationinsights|azure\.com|dc\.services\.visualstudio\.com/i);

    // Server tracing stays off until framework-generated span names/URLs and
    // exception text are sanitized and collector retention is reviewed.
    expect(instrumentation).not.toMatch(/^import .*@vercel\/otel/m);
    expect(instrumentation).not.toContain("registerOTel({");
    expect(instrumentation).not.toContain('"use client"');

    // The exporter dependency was removed with the disabled policy; re-adding
    // it requires the sanitization review (tests/telemetry-policy.test.ts).
    expect(packageJson).not.toContain("@vercel/otel");
    expect(packageLock).not.toContain("@vercel/otel");
    expect(packageJson).toContain('"@opentelemetry/api": "1.9.0"');
    expect(packageJson).not.toContain("@microsoft/applicationinsights-web");
    expect(packageLock).not.toContain("@microsoft/applicationinsights-web");

    expect(privacy).toContain("does not initialize Application Insights or another client analytics/telemetry SDK");
    expect(privacy).toContain("does not currently enable automatic server trace export");
  });
});
