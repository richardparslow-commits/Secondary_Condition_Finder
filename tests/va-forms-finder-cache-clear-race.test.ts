import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadVaFormsFinder } from "@/lib/va/forms-finder";
import {
  clearVaReferenceCache,
  hashedCacheKeySegment,
  readVaReferenceCache,
} from "@/lib/va/reference-cache";
import { clearVaReferenceInFlightForTests } from "@/lib/va/reference-cache-access";
import type { VaApiResult, VaFormIndex } from "@/lib/va/sandbox";

const { fetchVaFormsMock } = vi.hoisted(() => ({ fetchVaFormsMock: vi.fn() }));

vi.mock("@/lib/va/sandbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/va/sandbox")>()),
  fetchVaForms: fetchVaFormsMock,
}));

const CRON_SECRET = "test-cache-clear-secret-0123456789abcdef";
const query = "disability";
const cacheKey = `forms-finder:sandbox:q:${hashedCacheKeySegment(query)}`;

function liveResult(): VaApiResult<VaFormIndex> {
  return {
    success: true,
    data: {
      data: [
        {
          id: "form-1",
          type: "va_forms",
          attributes: {
            form_name: "21-526EZ",
            title: "Application for Disability Compensation",
            url: "https://www.va.gov/find-forms/about-form-21-526ez/",
            last_revision_on: "2026-01-01",
            pages: 4,
            valid_pdf: true,
          },
        },
      ],
    },
    source: "va-sandbox-api",
    environment: "sandbox",
  };
}

function authorizedClearRequest(): Request {
  return new Request("https://example.test/api/admin/cache-clear", {
    method: "POST",
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VA_API_ENABLED", "true");
  vi.stubEnv("VA_API_ENV", "sandbox");
  vi.stubEnv("VA_FORMS_SANDBOX_API_KEY", "test-key");
  vi.stubEnv("CRON_SECRET", CRON_SECRET);
  for (const name of [
    "VA_REFERENCE_SHARED_CACHE_URL",
    "VA_REFERENCE_SHARED_CACHE_TOKEN",
    "VA_REFERENCE_KV_REST_URL",
    "VA_REFERENCE_KV_REST_TOKEN",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
  ]) {
    vi.stubEnv(name, "");
  }
  fetchVaFormsMock.mockReset();
  clearVaReferenceCache();
  clearVaReferenceInFlightForTests();
});

afterEach(() => {
  clearVaReferenceCache();
  clearVaReferenceInFlightForTests();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Forms Finder cache clear race", () => {
  it("does not let a search already in flight repopulate the cleared cache", async () => {
    let resolveFetch!: (result: VaApiResult<VaFormIndex>) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });

    fetchVaFormsMock.mockImplementation(() => {
      markStarted();
      return new Promise<VaApiResult<VaFormIndex>>((resolve) => {
        resolveFetch = resolve;
      });
    });

    const search = loadVaFormsFinder(query);
    await started;

    const { POST } = await import("@/app/api/admin/cache-clear/route");
    const response = await POST(authorizedClearRequest());
    expect(response.status).toBe(200);

    resolveFetch(liveResult());
    const view = await search;
    expect(view.live).toBe(true);
    expect(readVaReferenceCache(cacheKey)).toBeNull();

    fetchVaFormsMock.mockResolvedValue(liveResult());
    const next = await loadVaFormsFinder(query);
    expect(next.cacheStatus).toBe("miss");
    expect(fetchVaFormsMock).toHaveBeenCalledTimes(2);
  });
});
