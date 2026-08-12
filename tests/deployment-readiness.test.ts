import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  workflowSessionRuntimeReady,
  workflowSessionSecret,
} from "@/lib/workflow-session-crypto";
import { loadVaSandboxConfig } from "@/lib/va/sandbox";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("production deployment readiness", () => {
  it("fails closed when the production workflow-session secret is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WORKFLOW_SESSION_SECRET", "");
    vi.stubEnv("SECONDARY_WORKFLOW_SESSION_SECRET", "");

    expect(() => workflowSessionSecret()).toThrow(/WORKFLOW_SESSION_SECRET/);
  });

  it("requires the primary production secret for runtime readiness", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WORKFLOW_SESSION_SECRET", "");
    vi.stubEnv(
      "SECONDARY_WORKFLOW_SESSION_SECRET",
      "legacy-fallback-secret-that-is-long-enough-for-tests",
    );

    expect(workflowSessionRuntimeReady()).toBe(false);
  });

  it("proves runtime readiness only after a production crypto round trip", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(
      "WORKFLOW_SESSION_SECRET",
      "primary-production-secret-that-is-long-enough-for-tests",
    );
    vi.stubEnv("SECONDARY_WORKFLOW_SESSION_SECRET", "");

    expect(workflowSessionRuntimeReady()).toBe(true);
  });

  it("does not report production runtime readiness in non-production mode", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv(
      "WORKFLOW_SESSION_SECRET",
      "primary-production-secret-that-is-long-enough-for-tests",
    );

    expect(workflowSessionRuntimeReady()).toBe(false);
  });

  it("keeps the runtime-readiness page dynamic and non-sensitive", () => {
    const pagePath = "src/app/runtime-readiness/page.tsx";
    const routePath = path.join(process.cwd(), "src/app/runtime-readiness/route.ts");
    const page = read(pagePath);

    expect(page).toContain('export const dynamic = "force-dynamic"');
    expect(page).toContain("export const revalidate = 0");
    expect(page).toContain('ready ? "ready" : "not_ready"');
    expect(page).toContain("data-runtime-readiness={status}");
    expect(page).not.toContain("process.env.WORKFLOW_SESSION_SECRET");
    expect(page).not.toContain("SECONDARY_WORKFLOW_SESSION_SECRET");
    expect(fs.existsSync(routePath)).toBe(false);
  });

  it("keeps the VA sandbox disabled by default and requires a key when enabled", () => {
    const disabled = loadVaSandboxConfig({});
    expect(disabled.enabled).toBe(false);
    expect(disabled.apiKey).toBeUndefined();

    const enabledWithoutKey = loadVaSandboxConfig({ VA_SANDBOX_ENABLED: "true" });
    expect(enabledWithoutKey.enabled).toBe(true);
    expect(enabledWithoutKey.apiKey).toBeUndefined();
  });

  it("declares the Node 22 production runtime contract", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      engines?: { node?: string };
    };

    expect(packageJson.engines?.node).toBe("22.x");
  });

  it("enforces the baseline security headers on all Next.js routes", () => {
    const source = read("next.config.ts");

    expect(source).toContain('source: "/:path*"');
    expect(source).toContain('key: "Content-Security-Policy"');
    expect(source).toContain("frame-ancestors 'none'");
    expect(source).toContain('key: "Referrer-Policy", value: "no-referrer"');
    expect(source).toContain('key: "X-Content-Type-Options", value: "nosniff"');
    expect(source).toContain('key: "X-Frame-Options", value: "DENY"');
    expect(source).toContain('key: "Permissions-Policy"');
    expect(source).toContain('key: "Strict-Transport-Security"');
  });

  it("pins the Azure deployment action and disables Next.js build telemetry", () => {
    const workflow = read(
      ".github/workflows/azure-static-web-apps-gentle-tree-04b340f0f.yml",
    );

    expect(workflow).toContain("actions/checkout@v6");
    expect(workflow).toContain(
      "Azure/static-web-apps-deploy@1a947af9992250f3bc2e68ad0754c0b0c11566c9",
    );
    expect(workflow).toContain("NEXT_TELEMETRY_DISABLED: '1'");
    expect(workflow).not.toContain("NEXT_PUBLIC_WORKFLOW_SESSION_SECRET");
    expect(workflow).not.toContain("NEXT_PUBLIC_VA_SANDBOX_API_KEY");
  });

  it("documents the Azure runtime-setting verification boundary", () => {
    const runbook = read("docs/deployment-readiness.md");

    expect(runbook).toContain("WORKFLOW_SESSION_SECRET");
    expect(runbook).toContain("at least 32 characters");
    expect(runbook).toContain("VA_SANDBOX_ENABLED");
    expect(runbook).toContain("cannot by itself prove the current value of Azure resource application settings");
    expect(runbook).toContain("/runtime-readiness");
    expect(runbook).not.toContain("/api/runtime-readiness");
    expect(runbook).toContain("data-runtime-readiness");
    expect(runbook).toContain("Issue #213");
  });
});
