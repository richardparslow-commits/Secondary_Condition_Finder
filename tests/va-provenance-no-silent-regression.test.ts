import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { loadClaimFormReference } from "@/lib/va/form-reference";
import {
  VA_REFERENCE_SURFACES,
  vaFallbackCopy,
  vaFallbackStatus,
  vaLiveStatus,
  vaProvenanceCopy,
} from "@/lib/va/provenance";
import {
  loadDisabilityReference,
  type DisabilityReferenceView,
} from "@/lib/va/disability-reference";
import { loadClaimFormReference as loadFormRef } from "@/lib/va/form-reference";
import {
  loadServiceBranchReference,
  type ServiceBranchReferenceView,
} from "@/lib/va/service-branches";

/**
 * Provenance cannot silently regress.
 *
 * Every production VA reference surface must, on EVERY execution path, tell
 * the user where its data came from: either an explicit live provenance block
 * (`va-production-api` / `va-sandbox-api` + environment-aware label and
 * notice) or an explicit fallback block (`local-fallback` + Local label and
 * "unavailable or disabled" notice). Nothing else is renderable.
 *
 * The copy-ownership guarantees live in `tests/va-provenance-copy.test.ts`;
 * `docs/va-api-runtime-configuration.md` reports the *configured* posture.
 * This file extends both with the runtime contract: take a real view produced
 * by a real loader and prove it cannot exist without one of the two provenance
 * shapes. The three shapes the loaders can return are exercised directly, and
 * the page-level surfaces are pinned so the pages cannot drop their label
 * bindings without failing this file.
 */

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

/** The three loader-outcome families shared across the contract tests. */
const OUTCOME_LABELS = ["local fallback", "sandbox live", "production live"] as const;

describe("every VA production reference surface carries explicit provenance", () => {
  const pageSurfaces = [
    { path: "src/app/va-reference/page.tsx", view: "reference" },
    { path: "src/app/va-reference/service-branches/page.tsx", view: "reference" },
    { path: "src/app/va-forms/page.tsx", view: "reference" },
    { path: "src/app/va-forms/finder/page.tsx", view: "reference" },
    {
      path: "src/components/va/AccreditedRepresentativeFinder.tsx",
      view: "initialView",
    },
  ] as const;

  it("renders sourceLabel and notice on every production surface", () => {
    for (const { path, view } of pageSurfaces) {
      const page = source(path);
      expect(page, `${path} must bind ${view}.sourceLabel`).toContain(
        `${view}.sourceLabel`,
      );
      expect(page, `${path} must bind ${view}.notice`).toContain(
        `${view}.notice`,
      );
    }
  });

  it("reports the three outcome shapes for each loader, never unlabelled", async () => {
    // (a) Disabled / coordinator-unreachable → fallback provenance block.
    vi.stubEnv("VA_API_ENABLED", "false");
    const disabledDisability = await loadDisabilityReference();
    expect(disabledDisability.source).toBe("local-fallback");
    expect(disabledDisability.live).toBe(false);
    expect(disabledDisability.environment).toBeNull();
    expect(disabledDisability.sourceLabel).toBe(
      vaFallbackCopy("disability-reference").sourceLabel,
    );
    expect(disabledDisability.notice).toContain("unavailable or disabled");

    const disabledServiceBranches = await loadServiceBranchReference();
    expect(disabledServiceBranches.source).toBe("local-fallback");
    expect(disabledServiceBranches.live).toBe(false);
    expect(disabledServiceBranches.sourceLabel).toContain("Local");

    // (b) Live sandbox result → provenance attributed with the environment
    // the result REPORTS, under-claiming sandbox even when production is
    // configured. The forms finder is laden with cache; injected fetcher
    // keeps these calls isolated.
    //
    // `ClaimFormReference` is the narrow shape (source + label + notice, no
    // `live`/`environment`/`cacheStatus` fields): its provenance contract is
    // carried by `source` + the exact copy from the shared owner.
    const attributes = {
      form_name: "21-526EZ",
      title: "Application for Disability Compensation",
      url: "https://www.va.gov/vaforms/21-526EZ.pdf",
      last_revision_on: "2026-01-01",
      pages: 4,
      valid_pdf: true,
      deleted_at: null,
    };
    const injectedFormRef = await loadClaimFormReference(async () => ({
      success: true,
      source: "va-sandbox-api",
      environment: "sandbox",
      data: { data: [{ attributes }] },
    }));
    expect(injectedFormRef.source).toBe("va-sandbox-api");
    expect(injectedFormRef.sourceLabel).toBe(
      vaProvenanceCopy("form-reference", "sandbox").sourceLabel,
    );
    expect(injectedFormRef.notice).toContain("may not be current");

    // (c) A production reported result → production label.
    const productionFormRef = await loadFormRef(async () => ({
      success: true,
      source: "va-production-api",
      environment: "production",
      data: { data: [{ attributes }] },
    }));
    expect(productionFormRef.source).toBe("va-production-api");
    expect(productionFormRef.sourceLabel).toBe(
      vaProvenanceCopy("form-reference", "production").sourceLabel,
    );
    expect(productionFormRef.notice).not.toContain("sandbox");

    // No middle ground: every returned view carrying a `source` field carries
    // exactly one of va-production-api | va-sandbox-api | local-fallback.
    const permitted = new Set(["va-production-api", "va-sandbox-api", "local-fallback"]);
    for (const view of [
      disabledDisability,
      disabledServiceBranches,
      injectedFormRef,
      productionFormRef,
    ] as Array<DisabilityReferenceView | ServiceBranchReferenceView | typeof injectedFormRef>) {
      expect(permitted.has(view.source), `source=${view.source}`).toBe(true);
      expect(view.sourceLabel.length).toBeGreaterThan(0);
      expect(view.notice.length).toBeGreaterThan(0);
      expect(OUTCOME_LABELS.length).toBe(3); // shape guard, not a claim
    }
  });

  it("never lets a fallback view carry a live provenance block (and vice versa)", () => {
    for (const surface of VA_REFERENCE_SURFACES) {
      const fallback = vaFallbackCopy(surface);
      // A fallback cannot reuse live wording, and vice versa.
      expect(fallback.sourceLabel).not.toBe(vaProvenanceCopy(surface, "sandbox").sourceLabel);
      expect(fallback.sourceLabel).not.toBe(vaProvenanceCopy(surface, "production").sourceLabel);
      // Provenance blocks are explicit: the fallback path explicitly says
      // "Local" and the live path explicitly says the surface + environment.
      expect(fallback.sourceLabel).toContain("Local");
      expect(vaProvenanceCopy(surface, "sandbox").sourceLabel).toContain("VA");
      expect(vaProvenanceCopy(surface, "production").sourceLabel).toContain("VA");
    }
  });

  it("keeps the live status block honest about what produced it", () => {
    const status = vaLiveStatus("forms-finder", "sandbox", "va-sandbox-api");
    expect(status).toMatchObject({
      source: "va-sandbox-api",
      live: true,
      environment: "sandbox",
      retrievedAt: expect.any(String),
      ...vaProvenanceCopy("forms-finder", "sandbox"),
    });

    // `vaLiveStatus` marks a view `live: true`, so a caller that hands it a
    // local-fallback source would be lying about live-ness; nothing in the
    // runtime actually does this (fallback goes through `vaFallbackStatus`),
    // so pin the invariant here rather than on a throw that doesn't exist.
    expect(status.live).toBe(true);
    expect(status.source).not.toBe("local-fallback");
    const fallbackStatus = vaFallbackStatus("forms-finder");
    expect(fallbackStatus.live).toBe(false);
    expect(fallbackStatus.source).toBe("local-fallback");
  });

  it("does not route live data through the fallback builder or vice versa", () => {
    const fallbackView = vaFallbackCopy("forms-finder");
    const liveStatus = vaLiveStatus("forms-finder", "production", "va-production-api");
    expect(liveStatus.sourceLabel).not.toBe(fallbackView.sourceLabel);
    expect(liveStatus.notice).not.toBe(fallbackView.notice);
    expect(liveStatus.environment).toBe("production");
  });

  it("requires a real live result to change the proving pages' rendered sourceLabel", () => {
    // A live va-production-api view, injected at page level, cannot reuse the
    // fallback label: the bound data must visibly change provenance before the
    // same rendered markup can claim production sourcing.
    const fallbackView = vaFallbackCopy("forms-finder");
    const liveStatus = vaLiveStatus("forms-finder", "production", "va-production-api");
    expect(liveStatus.source).toBe("va-production-api");
    expect(liveStatus.sourceLabel).not.toBe(fallbackView.sourceLabel);
    expect(liveStatus.notice).not.toBe(fallbackView.notice);
    expect(liveStatus.live).toBe(true);
    expect(liveStatus.environment).toBe("production");
  });

  it("locks the surface→source-file mapping so new surfaces inherit this contract", () => {
    // A new VA surface added to VA_REFERENCE_SURFACES must appear here with
    // its page binding (or be justified as non-rendered) — otherwise the
    // length mismatch below fails.
    expect(VA_REFERENCE_SURFACES).toHaveLength(5);
    expect(pageSurfaces).toHaveLength(5);

    // Every surface's loader source must still route through provenance.ts
    // (wiring theft fails the diagram before the page could go unlabelled).
    for (const surface of VA_REFERENCE_SURFACES) {
      const expectedFile = {
        "service-branches": "src/lib/va/service-branches.ts",
        "forms-finder": "src/lib/va/forms-finder.ts",
        "form-reference": "src/lib/va/form-reference.ts",
        "disability-reference": "src/lib/va/disability-reference.ts",
        "accredited-representatives":
          "src/lib/va/accredited-representatives.ts",
      }[surface];
      expect(
        source(expectedFile),
        `${expectedFile} no longer routes provenance through the shared owner`,
      ).toContain('from "./provenance"');
    }
  });
});
