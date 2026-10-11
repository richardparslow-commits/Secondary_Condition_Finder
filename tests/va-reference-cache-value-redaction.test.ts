import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearVaReferenceCache } from "@/lib/va/reference-cache";
import { loadVaFormsFinder } from "@/lib/va/forms-finder";
import { loadAccreditedRepresentatives } from "@/lib/va/accredited-representatives";
import { createFakeSharedKv } from "./helpers/fake-shared-kv";

const { fetchVaFormsMock, fetchVaAccreditedRepresentativesMock } = vi.hoisted(
  () => ({
    fetchVaFormsMock: vi.fn(),
    fetchVaAccreditedRepresentativesMock: vi.fn(),
  }),
);

vi.mock("@/lib/va/sandbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/va/sandbox")>()),
  fetchVaForms: fetchVaFormsMock,
  fetchVaAccreditedRepresentatives: fetchVaAccreditedRepresentativesMock,
}));

const KV_URL = "https://example.upstash.io";

function stubSharedKvEnv(): void {
  vi.stubEnv("VA_REFERENCE_SHARED_CACHE_URL", KV_URL);
  vi.stubEnv("VA_REFERENCE_SHARED_CACHE_TOKEN", "tok");
}

beforeEach(() => {
  clearVaReferenceCache();
  fetchVaFormsMock.mockReset();
  fetchVaAccreditedRepresentativesMock.mockReset();
  vi.stubEnv("VA_API_ENABLED", "true");
  vi.stubEnv("VA_FORMS_SANDBOX_API_KEY", "forms-test-key");
  vi.stubEnv("VA_ACCREDITED_REP_ENABLED", "true");
  stubSharedKvEnv();
});

afterEach(() => {
  clearVaReferenceCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/**
 * A01 cache-value slice: the Forms query and the locator ZIP are hashed in
 * the cache key, and the cached *value* must not replay them either. The
 * caller still sees the request text for display/prefill — it is re-attached
 * after the cache tiers, never written to either tier.
 */
describe("reference cache values omit raw user text (A01)", () => {
  it("serves the query to the caller but writes no raw query to the shared value", async () => {
    fetchVaFormsMock.mockResolvedValue({
      success: true,
      data: {
        data: [
          {
            id: "1",
            type: "forms",
            attributes: {
              form_name: "21-526EZ",
              url: "https://www.va.gov/find-forms/about-form-21-526ez/",
              title: "Application for Disability Compensation",
              deleted_at: null,
              last_revision_on: null,
            },
          },
        ],
      },
      source: "va-sandbox-api",
      environment: "sandbox",
    });
    const kv = createFakeSharedKv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => kv.respond(init)),
    );

    const view = await loadVaFormsFinder("21-526EZ");
    expect(view.live).toBe(true);
    expect(view.query).toBe("21-526EZ");

    // SET payloads are [SET, key, serialized, EX, ttl]; lease/budget keys
    // carry tokens and counters rather than view envelopes, so only the
    // forms-finder value key is in scope here.
    const sets = kv.executed.filter(
      ([name, key]) =>
        name === "SET" &&
        String(key ?? "").includes("forms-finder") &&
        !String(key ?? "").includes("inflight:") &&
        !String(key ?? "").includes("cardinality:"),
    );
    expect(sets.length).toBeGreaterThan(0);
    // The envelope's `query` field must be empty — matching directory
    // records (formName) legitimately repeat the query text as VA data, so
    // a blanket string absence check would reject correct directory results.
    const envelopes = sets.map((command) => JSON.parse(String(command[2] ?? "")) as {
      value?: { query?: unknown };
    });
    expect(envelopes.length).toBeGreaterThan(0);
    const views = envelopes.filter((envelope) => envelope.value && "query" in envelope.value);
    expect(views.length).toBeGreaterThan(0);
    for (const envelope of views) {
      expect(envelope.value?.query).toBe("");
    }
  });

  it("serves the ZIP to the caller but writes no raw ZIP to the shared value", async () => {
    fetchVaAccreditedRepresentativesMock.mockResolvedValue({
      success: true,
      data: { data: [] },
      source: "va-sandbox-api",
      environment: "sandbox",
    });
    const kv = createFakeSharedKv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => kv.respond(init)),
    );

    const view = await loadAccreditedRepresentatives({ zip: "90210" });
    expect(view.params.zip).toBe("90210");

    const sets = kv.executed.filter(
      ([name, key]) =>
        name === "SET" &&
        String(key ?? "").includes("accredited-rep") &&
        !String(key ?? "").includes("inflight:") &&
        !String(key ?? "").includes("cardinality:"),
    );
    expect(sets.length).toBeGreaterThan(0);
    // Directory items carry their own ZIPs as VA data; the request params
    // shape specifically must not replay the lookup ZIP.
    const envelopes = sets.map((command) => JSON.parse(String(command[2] ?? "")) as {
      value?: { params?: { zip?: unknown } };
    });
    expect(envelopes.length).toBeGreaterThan(0);
    const views = envelopes.filter((envelope) => envelope.value?.params);
    expect(views.length).toBeGreaterThan(0);
    for (const envelope of views) {
      expect(envelope.value?.params?.zip).toBe("");
    }
    const serialized = sets.map((command) => String(command[2] ?? "")).join("\n");
    expect(serialized).not.toContain('"zip":"90210"');
  });
});
