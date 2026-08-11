import { describe, expect, it, vi } from "vitest";

import { loadClaimFormReference } from "@/lib/va/form-reference";

describe("Phase 2 VA Form reference feature", () => {
  it("uses validated sandbox metadata when current Form 21-526EZ is returned", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      success: true,
      source: "va-sandbox-api",
      data: {
        data: [
          {
            attributes: {
              form_name: "21-526EZ",
              title: "Application for Disability Compensation",
              url: "https://www.va.gov/vaforms/21-526EZ.pdf",
              last_revision_on: "2026-01-01",
              deleted_at: null,
            },
          },
        ],
      },
    });

    const reference = await loadClaimFormReference(fetcher);

    expect(fetcher).toHaveBeenCalledWith("21-526EZ");
    expect(reference).toEqual(
      expect.objectContaining({
        formName: "21-526EZ",
        source: "va-sandbox-api",
        sourceLabel: "VA sandbox reference",
        lastRevisionOn: "2026-01-01",
      }),
    );
    expect(reference.notice).toContain("Sandbox data is for testing");
  });

  it("falls back locally when sandbox access is disabled or unavailable", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      success: false,
      source: "local-fallback",
      data: null,
      error: "disabled",
    });

    const reference = await loadClaimFormReference(fetcher);

    expect(reference.formName).toBe("21-526EZ");
    expect(reference.source).toBe("local-fallback");
    expect(reference.sourceLabel).toBe("Local reference");
    expect(reference.url).toContain("va.gov");
    expect(reference.notice).toContain("Confirm the current form");
  });

  it("ignores deleted or unrelated sandbox records and keeps the safe fallback", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      success: true,
      source: "va-sandbox-api",
      data: {
        data: [
          {
            attributes: {
              form_name: "20-0995",
              title: "Supplemental Claim",
              url: "https://www.va.gov/vaforms/20-0995.pdf",
              deleted_at: null,
            },
          },
          {
            attributes: {
              form_name: "21-526EZ",
              title: "Deleted test record",
              url: "https://example.test/deleted.pdf",
              deleted_at: "2026-01-01",
            },
          },
        ],
      },
    });

    const reference = await loadClaimFormReference(fetcher);

    expect(reference.source).toBe("local-fallback");
    expect(reference.url).toContain("va.gov/find-forms");
  });
});
