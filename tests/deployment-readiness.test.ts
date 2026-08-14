import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  workflowSessionRuntimeReady,
  workflowSessionSecret,
} from "@/lib/workflow-session-crypto";
import { loadVaApiConfig, loadVaSandboxConfig } from "@/lib/va/sandbox";

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

  it("does not report production runtime readiness outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv(
      "WORKFLOW_SESSION_SECRET",
      "primary-production-secret-that-is-long-enough-for-tests",
    );

    expect(workflowSessionRuntimeReady()).toBe(false);
  });

  it("keeps the runtime-readiness page dynamic and non-sensitive", () => {
    const page = read("src/app/runtime-readiness/page.tsx");

    expect(page).toContain('export const dynamic = "force-dynamic"');
    expect(page).toContain("export const revalidate = 0");
    expect(page).toContain('ready ? "ready" : "not_ready"');
    expect(page).toContain("data-runtime-readiness={status}");
    expect(page).not.toContain("process.env.WORKFLOW_SESSION_SECRET");
    expect(page).not.toContain("SECONDARY_WORKFLOW_SESSION_SECRET");
    expect(fs.existsSync(path.join(process.cwd(), "src/app/runtime-readiness/route.ts"))).toBe(false);
  });

  it("keeps VA access disabled by default and preserves sandbox compatibility mode", () => {
    const disabled = loadVaApiConfig({});
    expect(disabled.enabled).toBe(false);
    expect(disabled.environment).toBe("sandbox");
    expect(disabled.formsApiKey).toBeUndefined();
    expect(disabled.benefitsReferenceDataApiKey).toBeUndefined();

    const compatibility = loadVaSandboxConfig({
      VA_SANDBOX_ENABLED: "true",
      VA_FORMS_SANDBOX_API_KEY: "forms-test-key",
      VA_BENEFITS_REFERENCE_SANDBOX_API_KEY: "reference-test-key",
    });
    expect(compatibility.enabled).toBe(true);
    expect(compatibility.environment).toBe("sandbox");
    expect(compatibility.formsApiKey).toBe("forms-test-key");
    expect(compatibility.benefitsReferenceDataApiKey).toBe("reference-test-key");
  });

  it("requires explicit activation and production-specific credentials for production mode", () => {
    const selectedButDisabled = loadVaApiConfig({
      VA_API_ENV: "production",
      VA_FORMS_PRODUCTION_API_KEY: "forms-prod-key",
      VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY: "reference-prod-key",
    });
    expect(selectedButDisabled.enabled).toBe(false);
    expect(selectedButDisabled.environment).toBe("production");

    const enabled = loadVaApiConfig({
      VA_API_ENV: "production",
      VA_API_ENABLED: "true",
      VA_FORMS_PRODUCTION_API_KEY: "forms-prod-key",
      VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY: "reference-prod-key",
    });
    expect(enabled.enabled).toBe(true);
    expect(enabled.environment).toBe("production");
    expect(enabled.formsApiKey).toBe("forms-prod-key");
    expect(enabled.benefitsReferenceDataApiKey).toBe("reference-prod-key");
    expect(enabled.formsBaseUrl).toBe("https://api.va.gov/services/va_forms/v0");
    expect(enabled.benefitsReferenceDataBaseUrl).toBe(
      "https://api.va.gov/services/benefits-reference-data/v1",
    );
  });

  it("declares the Node 22 production runtime contract", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      engines?: { node?: string };
    };
    expect(packageJson.engines?.node).toBe("22.x");
  });

  it("enforces baseline security headers on all Next.js routes", () => {
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

  it("keeps Azure deployment manual-only as legacy fallback", () => {
    const workflow = read(
      ".github/workflows/azure-static-web-apps-gentle-tree-04b340f0f.yml",
    );

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("deploy_legacy_azure:");
    expect(workflow).not.toMatch(/^\s*push:/m);
    expect(workflow).not.toMatch(/^\s*pull_request:/m);
    expect(workflow).toContain(
      "Azure/static-web-apps-deploy@1a947af9992250f3bc2e68ad0754c0b0c11566c9",
    );
    expect(workflow).toContain('app_build_command: "npm run build:azure"');
  });

  it("keeps normal builds Vercel-native and standalone packaging Azure-only", () => {
    const workflow = read(
      ".github/workflows/azure-static-web-apps-gentle-tree-04b340f0f.yml",
    );
    const packageJson = JSON.parse(read("package.json")) as {
      scripts?: Record<string, string>;
    };
    const nextConfig = read("next.config.ts");

    expect(packageJson.scripts?.build).toBe("next build");
    expect(nextConfig).toContain(
      'const isAzureStaticWebAppsBuild = process.env.AZURE_STATIC_WEB_APPS_BUILD === "1"',
    );
    expect(nextConfig).toContain(
      '...(isAzureStaticWebAppsBuild ? { output: "standalone" as const } : {})',
    );
    expect(workflow).toContain('app_build_command: "npm run build:azure"');
  });

  it("gates production readiness on exact-commit Vercel status and alias convergence", () => {
    const workflow = read(".github/workflows/production-runtime-readiness.yml");

    expect(workflow).toContain("workflows:\n      - CI");
    expect(workflow).toContain(
      "PRODUCTION_BASE_URL: https://secondary-condition-finder.vercel.app",
    );
    expect(workflow).toContain('select(.context == "Vercel")');
    expect(workflow).toContain("data-dpl-id");
    expect(workflow).toContain("EXPECTED_DEPLOYMENT_ID");
    expect(workflow).toContain('data-runtime-readiness="ready"');
    expect(workflow).toContain("Temporary response bodies are deleted");
    expect(workflow).not.toContain("gentle-tree-04b340f0f.7.azurestaticapps.net");
  });

  it("documents current Vercel and VA runtime boundaries", () => {
    const runbook = read("docs/deployment-readiness.md");

    expect(runbook).toContain("WORKFLOW_SESSION_SECRET");
    expect(runbook).toContain("at least 32 characters");
    expect(runbook).toContain("Vercel project's **Production** environment");
    expect(runbook).toContain("VA_API_ENV");
    expect(runbook).toContain("VA_API_ENABLED");
    expect(runbook).toContain("VA_FORMS_SANDBOX_API_KEY");
    expect(runbook).toContain("VA_BENEFITS_REFERENCE_SANDBOX_API_KEY");
    expect(runbook).toContain("VA_FORMS_PRODUCTION_API_KEY");
    expect(runbook).toContain("VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY");
    expect(runbook).toContain("193f26030b9b90b81c832c6a645f179717abf307");
    expect(runbook).toContain("CI #797");
    expect(runbook).toContain("dpl_BwX77rhfw5Bank2oRe3zjgYaykR6");
    expect(runbook).toContain("Production Runtime Readiness #156");
    expect(runbook).toContain("Legacy Azure manual fallback");
    expect(runbook).toContain("no `push` or `pull_request` trigger");
    expect(runbook).toContain("issue #189");
    expect(runbook).toContain("issue #195");
    expect(runbook).toContain("issue #287");
    expect(runbook).not.toContain("VA_SANDBOX_API_KEY`");
  });
});
