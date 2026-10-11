import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PROBE_MAX_RESPONSE_BYTES, PROBE_TIMEOUT_MS, verifyProductionReference } from "../scripts/verify-va-production-reference.mts";

const env = {
  VA_PRODUCTION_ACCESS_GRANTED: "true",
  VA_API_ENABLED: "false",
  VA_FORMS_PRODUCTION_API_KEY: "synthetic-forms-secret",
  VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY: "synthetic-reference-secret",
};
const payloads = [
  { data: [{ id: "1", type: "va_form", attributes: { form_name: "21-526EZ", title: "sensitive-upstream-title", url: "https://www.va.gov/form.pdf" } }] },
  { items: [{ id: 1, name: "sensitive-upstream-name" }] },
  { items: [{ code: "ARMY", description: "sensitive-upstream-description" }] },
];
const options = { env, confirmed: true };

afterEach(() => vi.useRealTimers());

describe("controlled VA production reference verification", () => {
  it("refuses before any network call without every approval and service credential", async () => {
    for (const missing of [
      { confirmed: false }, { env: {} },
      { env: { ...env, VA_PRODUCTION_ACCESS_GRANTED: "false" } },
      { env: { ...env, VA_FORMS_PRODUCTION_API_KEY: "", VA_FORMS_SANDBOX_API_KEY: "sandbox-key" } },
      { env: { ...env, VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY: " " } },
      { env: { ...env, VA_API_ENABLED: "true" } },
      { env: { ...env, VA_SANDBOX_ENABLED: "maybe" } },
    ]) {
      const fetchImpl = vi.fn<typeof fetch>();
      const evidence = await verifyProductionReference({ ...options, ...missing, fetchImpl });
      expect(evidence.passed).toBe(false);
      expect(evidence.refusal).not.toBeNull();
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it("makes exactly three fixed requests using separate keys and emits only sanitized evidence", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    payloads.forEach((payload) => fetchImpl.mockResolvedValueOnce(Response.json(payload)));
    const original = { ...env };
    const evidence = await verifyProductionReference({ ...options, fetchImpl });
    expect(env).toEqual(original);
    expect(evidence.passed).toBe(true);
    expect(evidence.applicationActivated).toBe(false);
    expect(evidence.checks.map((row) => row.count)).toEqual([1, 1, 1]);
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      "https://api.va.gov/services/va_forms/v0/forms?query=21-526EZ",
      "https://api.va.gov/services/benefits-reference-data/v1/disabilities",
      "https://api.va.gov/services/benefits-reference-data/v1/service-branches",
    ]);
    fetchImpl.mock.calls.forEach(([, init], index) => {
      expect(init?.redirect).toBe("error");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init?.headers).toEqual({
        Accept: "application/json", apikey: index === 0 ? env.VA_FORMS_PRODUCTION_API_KEY : env.VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY,
        "X-Request-ID": evidence.checks[index].requestId,
      });
    });
    const serialized = JSON.stringify(evidence);
    for (const forbidden of ["sensitive-upstream", "synthetic-forms-secret", "synthetic-reference-secret", "https:"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it.each([
    ["unauthorized", () => new Response("private response", { status: 401 }), "http-error"],
    ["redirect", () => new Response("", { status: 302 }), "http-error"],
    ["rate limit", () => new Response("", { status: 429 }), "http-error"],
    ["empty", () => Response.json({ data: [] }), "invalid-payload"],
    ["bad shape", () => Response.json({ data: [{}] }), "invalid-payload"],
    ["unsafe link", () => Response.json({ data: [{ ...payloads[0].data![0], attributes: { ...payloads[0].data![0].attributes, url: "javascript:alert(1)" } }] }), "invalid-payload"],
    ["bad JSON", () => new Response("private malformed payload"), "invalid-payload"],
    ["declared size", () => new Response("", { headers: { "content-length": String(PROBE_MAX_RESPONSE_BYTES + 1) } }), "response-too-large"],
    ["streamed size", () => new Response("x".repeat(PROBE_MAX_RESPONSE_BYTES + 1)), "response-too-large"],
  ])("stops without retries after %s", async (_name, response, outcome) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response());
    const evidence = await verifyProductionReference({ ...options, fetchImpl });
    expect(evidence.passed).toBe(false);
    expect(evidence.checks[0].outcome).toBe(outcome);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(evidence)).not.toContain("private");
  });

  it("keeps the deadline armed during a stalled response body", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const body = new ReadableStream({ start(controller) {
        init?.signal?.addEventListener("abort", () => controller.error(new Error("secret-bearing failure")));
      } });
      return new Response(body);
    });
    const pending = verifyProductionReference({ ...options, fetchImpl });
    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS + 1);
    const evidence = await pending;
    expect(evidence.checks[0].outcome).toBe("timeout");
    expect(JSON.stringify(evidence)).not.toContain("secret-bearing");
  });

  it("does not expose thrown network errors", async () => {
    const evidence = await verifyProductionReference({ ...options, fetchImpl: vi.fn<typeof fetch>().mockRejectedValue(new Error(env.VA_FORMS_PRODUCTION_API_KEY)) });
    expect(evidence.checks[0].outcome).toBe("network-error");
    expect(JSON.stringify(evidence)).not.toContain(env.VA_FORMS_PRODUCTION_API_KEY);
  });

  it("refuses through the actual CLI without leaking arguments or credentials", () => {
    for (const args of [["--confirm-va-production-access"], ["--url=secret-url"], []]) {
      const result = spawnSync(process.execPath, ["scripts/verify-va-production-reference.mts", ...args], {
        encoding: "utf8", env: { ...process.env, ...env, VA_PRODUCTION_ACCESS_GRANTED: "false" }, timeout: 5_000,
      });
      expect(result.status).toBe(1);
      expect(result.stdout + result.stderr).not.toMatch(/synthetic-forms-secret|secret-url/);
    }
  });

  it("runs the actual CLI successfully with synthetic transport and retains no payload or key", () => {
    const preload = `const payloads = ${JSON.stringify(payloads)}; let i = 0; globalThis.fetch = async () => Response.json(payloads[i++]);`;
    const result = spawnSync(process.execPath, [
      `--import=data:text/javascript,${encodeURIComponent(preload)}`,
      "scripts/verify-va-production-reference.mts", "--confirm-va-production-access",
    ], { encoding: "utf8", env: { ...process.env, ...env, VA_SANDBOX_ENABLED: "false" }, timeout: 5_000 });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const evidence = JSON.parse(result.stdout);
    expect(evidence.passed).toBe(true);
    expect(evidence.applicationActivated).toBe(false);
    expect(evidence.checks).toHaveLength(3);
    expect(result.stdout).not.toMatch(/sensitive-upstream|synthetic-forms-secret|synthetic-reference-secret/);
  });

  it("keeps the workflow manual, main-only, approval-scoped and unable to close the issue", () => {
    const workflow = readFileSync(".github/workflows/va-production-reference-check.yml", "utf8");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("github.ref == 'refs/heads/main' && inputs.confirm_va_grant == true");
    expect(workflow).toContain("environment: va-production-reference");
    expect(workflow).toContain("VA_PRODUCTION_ACCESS_GRANTED: ${{ vars.VA_PRODUCTION_ACCESS_GRANTED }}");
    expect(workflow).toContain("VA_API_ENABLED: 'false'");
    expect(workflow).toContain("set -euo pipefail");
    expect(workflow).toContain("GITHUB_SHA");
    expect(workflow).not.toMatch(/pull_request:|push:|issues: write|gh issue close|upload-artifact|NEXT_PUBLIC_/);
  });
});
