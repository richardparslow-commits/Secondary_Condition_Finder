import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  openWorkflowState,
  sealWorkflowState,
} from "@/lib/secondary-workflow/session";

const workflowPages = [
  "src/app/secondary/diagnosed/page.tsx",
  "src/app/secondary/service-connected/page.tsx",
  "src/app/secondary/ratings/page.tsx",
  "src/app/secondary/upload/page.tsx",
  "src/app/secondary/suggestions/page.tsx",
  "src/app/secondary/evidence/page.tsx",
];

const TEST_SECRET = "test-secondary-workflow-session-secret-32-plus-characters";

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

  it("stores workflow state in short-lived hardened first-party cookies", () => {
    const secondary = read("src/lib/secondary-workflow/session.ts");
    const presumptive = read("src/lib/presumptive/session.ts");
    const crypto = read("src/lib/workflow-session-crypto.ts");

    for (const source of [secondary, presumptive]) {
      expect(source).toContain("httpOnly: true");
      expect(source).toContain('sameSite: "strict"');
      expect(source).toContain("WORKFLOW_SESSION_MAX_AGE_SECONDS");
      expect(source).toContain("maxAge: WORKFLOW_SESSION_MAX_AGE_SECONDS");
    }
    expect(secondary).toContain('path: "/secondary"');
    expect(presumptive).toContain('path: "/presumptive"');
    expect(crypto).toContain("WORKFLOW_SESSION_MAX_AGE_SECONDS = 30 * 60");
    expect(crypto).toContain('createCipheriv("aes-256-gcm"');
    expect(crypto).toContain("WORKFLOW_SESSION_SECRET");
    expect(crypto).toContain("expiresAt");
  });

  it("encrypts secondary workflow state without exposing condition IDs or ratings", () => {
    const state = {
      diagnosedConditionIds: ["ptsd", "sleep-apnea"],
      serviceConnectedConditionIds: ["ptsd"],
      serviceConnectedAnswerDraft: { ptsd: "yes" as const, "sleep-apnea": "no" as const },
      ratingsByConditionId: { ptsd: 100 },
      documentsShared: true,
    };

    const sealed = sealWorkflowState(state, TEST_SECRET);

    expect(sealed).not.toContain("ptsd");
    expect(sealed).not.toContain("sleep-apnea");
    expect(sealed).not.toContain('"ratingsByConditionId":{"ptsd":100}');
    expect(openWorkflowState(sealed, TEST_SECRET)).toEqual(state);
  });

  it("rejects tampered or incorrectly keyed workflow cookies", () => {
    const sealed = sealWorkflowState(
      { diagnosedConditionIds: ["ptsd"] },
      TEST_SECRET,
    );
    const parts = sealed.split(".");
    const ciphertext = Buffer.from(parts[2], "base64url");
    ciphertext[0] = ciphertext[0] ^ 0x01;
    parts[2] = ciphertext.toString("base64url");
    const tampered = parts.join(".");

    expect(openWorkflowState(tampered, TEST_SECRET)).toBeNull();
    expect(
      openWorkflowState(
        sealed,
        "different-test-secondary-workflow-secret-32-plus-characters",
      ),
    ).toBeNull();
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
