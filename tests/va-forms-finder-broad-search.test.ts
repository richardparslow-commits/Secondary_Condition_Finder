/**
 * Regression suite for the broad Forms Finder search defect: the loader sliced
 * matches to 25, so a query with more matches silently left the rest out. The
 * bound is now the shared 200-item cache ceiling and the page discloses it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearVaFormsFinderCache,
  loadVaFormsFinder,
} from "@/lib/va/forms-finder";
import { VA_FORMS_MAX_ITEMS } from "@/lib/va/forms-finder-search";
import type { VaApiResult, VaFormIndex } from "@/lib/va/sandbox";

const { fetchVaFormsMock } = vi.hoisted(() => ({ fetchVaFormsMock: vi.fn() }));

vi.mock("@/lib/va/sandbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/va/sandbox")>()),
  fetchVaForms: fetchVaFormsMock,
}));

function liveResult(count: number): VaApiResult<VaFormIndex> {
  return {
    success: true,
    data: {
      data: Array.from({ length: count }, (_, index) => ({
        id: `form-${index}`,
        type: "va_forms",
        attributes: {
          form_name: `21-${String(index).padStart(4, "0")}`,
          title: `Matching form ${index}`,
          url: `https://www.va.gov/find-forms/about-form-${index}/`,
        },
      })),
    },
    source: "va-sandbox-api",
    environment: "sandbox",
  };
}

beforeEach(() => {
  vi.stubEnv("VA_API_ENABLED", "true");
  vi.stubEnv("VA_API_ENV", "sandbox");
  vi.stubEnv("VA_FORMS_SANDBOX_API_KEY", "test-key");
  fetchVaFormsMock.mockReset();
  clearVaFormsFinderCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  clearVaFormsFinderCache();
});

describe("broad Forms Finder searches", () => {
  it("lists every match above the old 25-item cap", async () => {
    fetchVaFormsMock.mockResolvedValue(liveResult(30));

    const view = await loadVaFormsFinder("disability");

    expect(view.live).toBe(true);
    expect(view.items).toHaveLength(30);
    // The thirtieth match used to be dropped without a trace.
    expect(view.items.at(-1)?.formName).toBe("21-0029");
  });

  it("bounds a very broad search at the shared ceiling and serves it from cache", async () => {
    fetchVaFormsMock.mockResolvedValue(liveResult(250));

    const view = await loadVaFormsFinder("disability");

    expect(view.items).toHaveLength(VA_FORMS_MAX_ITEMS);
    expect(view.items[0].formName).toBe("21-0000");

    // The bounded view is inside the cache DTO, so a repeated lookup stays
    // populated instead of being rejected and degraded to the local fallback.
    const cachedView = await loadVaFormsFinder("disability");
    expect(cachedView.cacheStatus).toBe("hit");
    expect(cachedView.items).toHaveLength(VA_FORMS_MAX_ITEMS);
    expect(fetchVaFormsMock).toHaveBeenCalledTimes(1);
  });
});
