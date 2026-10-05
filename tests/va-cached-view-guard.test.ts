import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isTrustedCachedClaimFormReference,
  isTrustedCachedLiveView,
} from "@/lib/va/cached-view-guard";
import { isTrustedHttpsUrl } from "@/lib/va/trusted-link";
import {
  clearVaApiOutboundRateLimitState,
  fetchVaAccreditedRepresentatives,
  fetchVaForms,
} from "@/lib/va/sandbox";
import { clearVaReferenceCache } from "@/lib/va/reference-cache";

function liveView(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    query: "21-526EZ",
    items: [
      {
        formName: "21-526EZ",
        title: "Application for Disability Compensation",
        url: "https://www.va.gov/find-forms/about-form-21-526ez/",
        lastRevisionOn: null,
        pages: null,
        validPdf: true,
      },
    ],
    source: "va-sandbox-api",
    sourceLabel: "VA Forms sandbox",
    notice: "Results came from the VA Forms sandbox.",
    live: true,
    environment: "sandbox",
    retrievedAt: "2026-10-03T00:00:00.000Z",
    cacheStatus: "miss",
    ...overrides,
  };
}

function okJson(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  clearVaReferenceCache();
  clearVaApiOutboundRateLimitState();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("trusted VA links", () => {
  it("accepts only credential-free https URLs", () => {
    expect(isTrustedHttpsUrl("https://www.va.gov/find-forms/about-form-21-526ez/")).toBe(true);
    expect(isTrustedHttpsUrl("https://vso.example.org/help")).toBe(true);
    for (const raw of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "http://www.va.gov/insecure",
      "ftp://files.example.org/form.pdf",
      "//protocol-relative.example.org/x",
      "https://user:pass@www.va.gov/form",
      "not a url",
      "",
    ]) {
      expect(isTrustedHttpsUrl(raw)).toBe(false);
    }
  });
});

describe("cached reference view guard (audit item 12 acceptance)", () => {
  it("accepts a view that matches the deployment's provenance and links", () => {
    expect(isTrustedCachedLiveView(liveView(), "sandbox")).toBe(true);
    expect(
      isTrustedCachedLiveView(
        liveView({ source: "va-production-api", sourceLabel: "VA Forms production", environment: "production" }),
        "production",
      ),
    ).toBe(true);
  });

  it("rejects provenance forgery: a production-labelled value in a sandbox deployment and vice versa", () => {
    expect(
      isTrustedCachedLiveView(
        liveView({ source: "va-production-api", sourceLabel: "VA Forms production", environment: "production" }),
        "sandbox",
      ),
    ).toBe(false);
    expect(
      isTrustedCachedLiveView(liveView({ environment: "production" }), "sandbox"),
    ).toBe(false);
    expect(
      isTrustedCachedLiveView(
        liveView({ live: false, source: "local-fallback", sourceLabel: "Local reference fallback" }),
        "sandbox",
      ),
    ).toBe(false);
  });

  it("rejects unbounded or missing label metadata", () => {
    expect(isTrustedCachedLiveView(liveView({ sourceLabel: "" }), "sandbox")).toBe(false);
    expect(isTrustedCachedLiveView(liveView({ sourceLabel: "L".repeat(201) }), "sandbox")).toBe(false);
    expect(isTrustedCachedLiveView(liveView({ notice: "N".repeat(401) }), "sandbox")).toBe(false);
    expect(isTrustedCachedLiveView(liveView({ notice: 42 }), "sandbox")).toBe(false);
    expect(isTrustedCachedLiveView(liveView({ retrievedAt: "T".repeat(41) }), "sandbox")).toBe(false);
  });

  it("rejects any untrusted link anywhere in the value", () => {
    expect(
      isTrustedCachedLiveView(
        liveView({
          items: [{ formName: "21-526EZ", title: "t", url: "javascript:alert(1)" }],
        }),
        "sandbox",
      ),
    ).toBe(false);
    expect(
      isTrustedCachedLiveView(
        liveView({ items: [{ nested: { href: "http://insecure.example.org/x" } }] }),
        "sandbox",
      ),
    ).toBe(false);
    expect(
      isTrustedCachedLiveView(
        liveView({ items: [{ website: "https://user:pass@example.org/x" }] }),
        "sandbox",
      ),
    ).toBe(false);
  });

  it("rejects non-objects, oversized item lists, and pathological nesting", () => {
    for (const candidate of [null, "cached", 7, [1, 2, 3], {}]) {
      expect(isTrustedCachedLiveView(candidate, "sandbox")).toBe(false);
    }
    expect(
      isTrustedCachedLiveView(
        liveView({ items: Array.from({ length: 201 }, () => ({ formName: "x" })) }),
        "sandbox",
      ),
    ).toBe(false);

    let deep: Record<string, unknown> = { formName: "ok" };
    for (let i = 0; i < 6_000; i += 1) deep = { child: deep };
    expect(isTrustedCachedLiveView(liveView({ items: [deep] }), "sandbox")).toBe(false);
  });

  it("guards the single-form reference shape too", () => {
    const reference = {
      formName: "21-526EZ",
      title: "Application for Disability Compensation",
      url: "https://www.va.gov/find-forms/about-form-21-526ez/",
      lastRevisionOn: null,
      source: "va-sandbox-api",
      sourceLabel: "VA sandbox reference",
      notice: "This metadata came from the VA sandbox environment.",
    };
    expect(isTrustedCachedClaimFormReference(reference, "sandbox")).toBe(true);
    expect(isTrustedCachedClaimFormReference({ ...reference, url: "javascript:alert(1)" }, "sandbox")).toBe(
      false,
    );
    expect(
      isTrustedCachedClaimFormReference({ ...reference, source: "va-production-api" }, "sandbox"),
    ).toBe(false);
    expect(isTrustedCachedClaimFormReference({ ...reference, title: "" }, "sandbox")).toBe(false);
  });
});

describe("upstream payload link policy (audit A-03 approved links)", () => {
  it("fails the VA Forms payload validation when a form link is not credential-free https", async () => {
    vi.stubEnv("VA_API_ENABLED", "true");
    vi.stubEnv("VA_API_ENV", "sandbox");
    vi.stubEnv("VA_FORMS_SANDBOX_API_KEY", "forms-key");
    const attributes = {
      form_name: "21-526EZ",
      title: "Application for Disability Compensation",
      url: "javascript:alert(1)",
      last_revision_on: null,
      deleted_at: null,
    };
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(okJson({ data: [{ id: "21-526EZ", type: "va_form", attributes }] }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchVaForms("21-526EZ");
    expect(result.success).toBe(false);
    expect(result.source).toBe("local-fallback");
  });

  it("rejects an http or credential-bearing representative website", async () => {
    vi.stubEnv("VA_ACCREDITED_REP_ENABLED", "true");
    vi.stubEnv("VA_API_ENV", "sandbox");
    vi.stubEnv("VA_ACCREDITED_REP_SANDBOX_API_KEY", "rep-key");
    for (const website of ["http://www.va.gov/dir", "https://user:pass@www.va.gov/dir"]) {
      const fetchSpy = vi.fn().mockResolvedValue(
        okJson({
          data: [
            {
              id: "1",
              name: "Example VSO",
              accreditationType: "VSO",
              zip: "90210",
              website,
            },
          ],
        }),
      );
      vi.stubGlobal("fetch", fetchSpy);
      const result = await fetchVaAccreditedRepresentatives({ zip: "90210" });
      expect(result.success).toBe(false);
      expect(result.source).toBe("local-fallback");
    }
  });

  it("still accepts a canonical https VA link", async () => {
    vi.stubEnv("VA_API_ENABLED", "true");
    vi.stubEnv("VA_API_ENV", "sandbox");
    vi.stubEnv("VA_FORMS_SANDBOX_API_KEY", "forms-key");
    const fetchSpy = vi.fn().mockResolvedValue(
      okJson({
        data: [
          {
            id: "21-526EZ",
            type: "va_form",
            attributes: {
              form_name: "21-526EZ",
              title: "Application for Disability Compensation",
              url: "https://www.va.gov/find-forms/about-form-21-526ez/",
              last_revision_on: null,
              deleted_at: null,
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const result = await fetchVaForms("21-526EZ");
    expect(result.success).toBe(true);
    expect(result.data?.data[0]?.attributes.url).toContain("https://www.va.gov/");
  });
});
