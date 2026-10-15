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
    expect(selectedButDisabled.mode).toBe("disabled");
    expect(selectedButDisabled.environment).toBe("production");

    // Issue #287 gate rule: enablement plus credentials are still not sufficient.
    // Production endpoints require an explicit acknowledgement that VA granted
    // production access, so a lone VA_API_ENABLED=true cannot repoint the public
    // reference surfaces at production or label data production-sourced.
    const enabledButUnacknowledged = loadVaApiConfig({
      VA_API_ENV: "production",
      VA_API_ENABLED: "true",
      VA_FORMS_PRODUCTION_API_KEY: "forms-prod-key",
      VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY: "reference-prod-key",
    });
    expect(enabledButUnacknowledged.enabled).toBe(false);
    expect(enabledButUnacknowledged.mode).toBe("disabled");
    expect(enabledButUnacknowledged.environment).toBe("production");
    expect(enabledButUnacknowledged.modeReason).toContain("VA_PRODUCTION_ACCESS_GRANTED");

    const enabled = loadVaApiConfig({
      VA_API_ENV: "production",
      VA_API_ENABLED: "true",
      VA_PRODUCTION_ACCESS_GRANTED: "true",
      VA_FORMS_PRODUCTION_API_KEY: "forms-prod-key",
      VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY: "reference-prod-key",
    });
    expect(enabled.enabled).toBe(true);
    expect(enabled.mode).toBe("production");
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

  it("enforces baseline security headers and nonce CSP across Next.js routes", () => {
    const config = read("next.config.ts");
    const proxy = read("src/proxy.ts");

    expect(config).toContain('source: "/:path*"');
    expect(config).toContain('key: "Referrer-Policy", value: "no-referrer"');
    expect(config).toContain('key: "X-Content-Type-Options", value: "nosniff"');
    expect(config).toContain('key: "X-Frame-Options", value: "DENY"');
    expect(config).toContain('key: "Permissions-Policy"');
    expect(config).toContain('key: "Strict-Transport-Security"');

    expect(proxy).toContain('response.headers.set("Content-Security-Policy"');
    expect(proxy).toContain("frame-ancestors 'none'");
    expect(proxy).toContain("script-src-attr 'none'");
    expect(proxy).toContain("'strict-dynamic'");
    expect(proxy).not.toMatch(/script-src[^;\n]*'unsafe-inline'/);
  });

  it("authorizes production styles by nonce, refusing the style attribute, and keeps the inline-style allowance to development", () => {
    const proxy = read("src/proxy.ts");

    // SEC-03: production styles were previously authorized with 'unsafe-inline'
    // because React's `style` prop writes an HTML style attribute, which no nonce
    // can reach. Every rendered style is now declarative (Tailwind classes, SVG
    // presentation attributes, a drawn rect) or written through the CSSOM, so the
    // production policy is a nonce plus `style-src-attr 'none'`.
    expect(proxy).toContain("style-src 'self' 'nonce-");
    expect(proxy).toContain("style-src-attr 'none'");

    // The one surviving style-src 'unsafe-inline' is the development branch (the
    // Next.js dev overlay injects inline markup); it must not be reachable
    // without the `isDevelopment` guard.
    const styleLines = proxy
      .split("\n")
      .filter((line) => line.includes("style-src"));
    const unsafeInlineStyleLines = styleLines.filter((line) => line.includes("'unsafe-inline'"));
    expect(unsafeInlineStyleLines).toHaveLength(1);
    expect(unsafeInlineStyleLines[0]).toContain("[");
    expect(proxy).toMatch(/isDevelopment\s*\n\s*\? \["style-src 'self' 'unsafe-inline'"\]/);

    // script-src must NEVER contain unsafe-inline — nonce-based script execution
    // is the actual XSS boundary. This is the non-negotiable security contract.
    expect(proxy).not.toMatch(/script-src[^;\n]*'unsafe-inline'/);
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

/**
 * REL-04: `/api/health` must answer the *readiness* question, not only the
 * liveness one.
 *
 * `components.sessionCrypto` proves the seal/open primitives work using an
 * ephemeral probe secret, which is deliberate — it must not fail because of
 * configuration. That is exactly why it cannot report a missing production
 * secret: the primitives stay green while every workflow write fails. These
 * cases pin the second component that closes that gap, and pin that it never
 * leaks the configured value.
 */
describe("health readiness truthfulness (REL-04)", () => {
  async function health(): Promise<{ status: number; body: Record<string, unknown> }> {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  function component(body: Record<string, unknown>, name: string) {
    const components = body.components as Record<string, Record<string, unknown>>;
    return components[name];
  }

  it("degrades when the configured production workflow secret is unusable", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WORKFLOW_SESSION_SECRET", "");
    vi.stubEnv("SECONDARY_WORKFLOW_SESSION_SECRET", "");

    const { status, body } = await health();

    expect(status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(component(body, "workflowSession").status).toBe("error");
    expect(component(body, "workflowSession").detail).toBe("Workflow session configuration unusable");
    // The distinction that made this a false green: the primitive check stays
    // ok, so its verdict is not evidence about configuration.
    expect(component(body, "sessionCrypto").status).toBe("ok");
  });

  it("reports ready when the configured secret survives a real round trip", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(
      "WORKFLOW_SESSION_SECRET",
      "primary-production-secret-that-is-long-enough-for-tests",
    );
    vi.stubEnv("SECONDARY_WORKFLOW_SESSION_SECRET", "");

    const { status, body } = await health();

    expect(status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(component(body, "workflowSession").status).toBe("ok");
    expect(component(body, "workflowSession").detail).toMatch(/round-trip verified/);
  });

  it("never echoes the configured secret, its length, or an exception value", async () => {
    const secret = "primary-production-secret-that-is-long-enough-for-tests";
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WORKFLOW_SESSION_SECRET", secret);

    const { body } = await health();
    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("WORKFLOW_SESSION_SECRET=");
  });

  it("treats the development-only fallback as ready outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("WORKFLOW_SESSION_SECRET", "");
    vi.stubEnv("SECONDARY_WORKFLOW_SESSION_SECRET", "");

    const { status, body } = await health();

    // Non-production runs on the documented development-only fallback, where
    // workflows genuinely work. Reporting it broken would train operators to
    // ignore the field that exists to be trusted.
    expect(status).toBe(200);
    expect(component(body, "workflowSession").status).toBe("ok");
    expect(component(body, "workflowSession").detail).toMatch(/development-only fallback/);
  });

  it("reports the enforced rate-limit identity, ceiling and store regime", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const { body } = await health();
    const rateLimit = component(body, "rateLimit") as {
      identity: Record<string, unknown>;
      ceiling: Record<string, unknown>;
      store: Record<string, unknown>;
    };

    // SEC-02's reporting half: the trust decision, the enforced ceiling and the
    // store regime are readable from the deployment rather than from comments.
    expect(rateLimit.identity.identity).toBe("self-declared");
    expect(rateLimit.identity.variable).toBe("RATE_LIMIT_TRUSTED_INGRESS");
    expect(rateLimit.ceiling.variable).toBe("RATE_LIMIT_UNATTRIBUTED_MAX");
    expect(typeof rateLimit.ceiling.max).toBe("number");
    expect((rateLimit.ceiling.max as number)).toBeGreaterThan(0);
    expect(rateLimit.store.mode).toBe("process-local");
    expect(rateLimit.store.distributed).toBe(false);
    expect(rateLimit.store.blockedBy).toBe("no-store-provisioned");

    // SEC-02b: what an identity-less request gets is reported rather than inferred.
    // With no ingress model declared it is still bounded by the ceiling alone, so an
    // operator cannot mistake the class bucket for a control that is in force.
    const unidentified = rateLimit.identity.unidentified as Record<string, unknown>;
    expect(unidentified.policy).toBe("ceiling");
    expect(unidentified.keyTemplate).toBeNull();
    expect(typeof unidentified.detail).toBe("string");
    const refusals = (component(body, "rateLimit") as Record<string, unknown>).refusals as {
      byBudget: Record<string, number>;
    };
    expect(refusals.byBudget.unidentified).toBe(0);
  });

  it("reports the declared ingress model and the hop enforcement reads", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_TRUSTED_INGRESS", "append:2");

    const { body } = await health();
    const identity = component(body, "rateLimit").identity as Record<string, unknown>;

    // SEC-02's ingress half: an operator can read *which end* of the forwarding
    // header enforcement trusts, so the claim can be checked against what the
    // ingress actually writes instead of being taken on trust.
    expect(identity.identity).toBe("asserted");
    expect(identity.model).toBe("append");
    expect(identity.header).toBe("x-forwarded-for");
    expect(identity.hop).toBe("nth-from-right");
    expect(identity.hopsFromRight).toBe(2);
    expect(identity.fallback).toBeNull();

    // SEC-02b: and a declared model puts the identity-less class bucket in force,
    // which is the policy the same report has to name for the runbook's A3.
    const unidentified = identity.unidentified as Record<string, unknown>;
    expect(unidentified.policy).toBe("shared-per-client-bucket");
    expect(unidentified.keyTemplate).toBe("unidentified:<limiter>");
  });
});
