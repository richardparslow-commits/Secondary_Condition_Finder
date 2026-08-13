import { afterEach, describe, expect, it, vi } from "vitest";

import { loadVaFormsFinder, clearVaFormsFinderCache } from "@/lib/va/forms-finder";
import {
  clearServiceBranchReferenceCache,
  loadServiceBranchReference,
} from "@/lib/va/service-branches";
import { matchExactVaReferenceTerm } from "@/lib/va/terminology-match";

afterEach(() => {
  clearVaFormsFinderCache();
  clearServiceBranchReferenceCache?.();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("VA reference product enhancements", () => {
  it("matches only normalized exact VA terminology", () => {
    const items = [
      { id: "30", name: "Migraine Headaches" },
      { id: "31", name: "Sleep Apnea" },
    ];

    expect(matchExactVaReferenceTerm("migraine-headaches", items)).toEqual(items[0]);
    expect(matchExactVaReferenceTerm("Migraine", items)).toBeNull();
    expect(matchExactVaReferenceTerm("sleep & apnea", items)).toBeNull();
  });

  it("searches VA Forms metadata and caches successful public results", async () => {
    vi.stubEnv("VA_SANDBOX_ENABLED", "true");
    vi.stubEnv("VA_FORMS_SANDBOX_API_KEY", "test-only-value");
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "5403",
              type: "va_form",
              attributes: {
                form_name: "21-526EZ",
                url: "https://www.va.gov/vaforms/21-526EZ.pdf",
                title: "Application for Disability Compensation",
                last_revision_on: "2024-01-01",
                pages: 12,
                valid_pdf: true,
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const first = await loadVaFormsFinder("21-526EZ");
    const second = await loadVaFormsFinder("21-526EZ");

    expect(first.live).toBe(true);
    expect(first.cacheStatus).toBe("miss");
    expect(first.items[0]).toEqual(
      expect.objectContaining({
        formName: "21-526EZ",
        pages: 12,
        validPdf: true,
      }),
    );
    expect(second.cacheStatus).toBe("hit");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("loads standardized service branches and falls back safely", async () => {
    vi.stubEnv("VA_SANDBOX_ENABLED", "true");
    vi.stubEnv("VA_BENEFITS_REFERENCE_SANDBOX_API_KEY", "test-only-value");
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            { code: "Army", description: "Army" },
            { code: "Navy", description: "Navy" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const live = await loadServiceBranchReference();
    expect(live.live).toBe(true);
    expect(live.items.map((item) => item.description)).toEqual(["Army", "Navy"]);

    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    const fallback = await loadServiceBranchReference();
    expect(fallback.live).toBe(false);
    expect(fallback.items.some((item) => item.description === "Army")).toBe(true);
  });
});
