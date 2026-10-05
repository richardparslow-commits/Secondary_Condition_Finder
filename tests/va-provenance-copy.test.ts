import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { loadClaimFormReference } from "@/lib/va/form-reference";
import {
  resolveVaResultEnvironment,
  VA_REFERENCE_SURFACES,
  vaFallbackCopy,
  vaFallbackStatus,
  vaLiveStatus,
  vaProvenanceCopy,
  type VaReferenceSurface,
} from "@/lib/va/provenance";
import type { VaApiEnvironment, VaApiSource } from "@/lib/va/sandbox";

/**
 * Guards the single owner of VA reference provenance copy.
 *
 * The five reference modules previously carried 25 distinct label/notice
 * strings between them plus three separate implementations of "which
 * environment produced this?" — so wording and trust semantics were enforced by
 * discipline across five files, and no test noticed when `forms-finder` and
 * `form-reference` drifted onto different resolution rules from their siblings.
 *
 * These tests read `src/lib/va/provenance.ts` through its public API rather
 * than restating the copy, so adding a surface or re-wording a notice cannot
 * leave the assertions behind.
 */

const SURFACE_SOURCES: Record<VaReferenceSurface, string> = {
  "service-branches": "src/lib/va/service-branches.ts",
  "forms-finder": "src/lib/va/forms-finder.ts",
  "form-reference": "src/lib/va/form-reference.ts",
  "disability-reference": "src/lib/va/disability-reference.ts",
  "accredited-representatives":
    "src/lib/va/accredited-representatives.ts",
};

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

/** Every provenance string the table owns, for drift checks. */
function allCopyStrings(): string[] {
  const strings = new Set<string>();
  for (const surface of VA_REFERENCE_SURFACES) {
    for (const environment of ["production", "sandbox"] as const) {
      const live = vaProvenanceCopy(surface, environment);
      strings.add(live.sourceLabel);
      strings.add(live.notice);
    }
    const fallback = vaFallbackCopy(surface);
    strings.add(fallback.sourceLabel);
    strings.add(fallback.notice);
  }
  return [...strings];
}

describe("VA reference provenance copy", () => {
  it("owns copy for every reference surface with no empty field", () => {
    expect(VA_REFERENCE_SURFACES).toHaveLength(5);

    for (const surface of VA_REFERENCE_SURFACES) {
      for (const environment of ["production", "sandbox"] as const) {
        const { sourceLabel, notice } = vaProvenanceCopy(surface, environment);
        expect(sourceLabel, `${surface}/${environment} label`).toBeTruthy();
        expect(notice, `${surface}/${environment} notice`).toBeTruthy();
      }
      const fallback = vaFallbackCopy(surface);
      expect(fallback.sourceLabel, `${surface} fallback label`).toBeTruthy();
      expect(fallback.notice, `${surface} fallback notice`).toBeTruthy();
    }
  });

  it("keeps production and sandbox copy visually distinct per surface", () => {
    // If these ever matched, a mis-set environment would be invisible to the
    // reader — which is the failure the copy exists to prevent.
    for (const surface of VA_REFERENCE_SURFACES) {
      const production = vaProvenanceCopy(surface, "production");
      const sandbox = vaProvenanceCopy(surface, "sandbox");
      expect(production.sourceLabel).not.toBe(sandbox.sourceLabel);
      expect(production.notice).not.toBe(sandbox.notice);
    }
  });

  it("keeps the trust signals that make each notice actionable", () => {
    const fallbackLabels = new Set<string>();

    for (const surface of VA_REFERENCE_SURFACES) {
      // Sandbox data must always warn that it may be stale.
      expect(vaProvenanceCopy(surface, "sandbox").notice).toContain(
        "may not be current",
      );

      const fallback = vaFallbackCopy(surface);
      // A fallback must say the upstream failed and that it is local data.
      expect(fallback.notice).toContain("unavailable or disabled");
      expect(fallback.sourceLabel).toContain("Local");
      fallbackLabels.add(fallback.sourceLabel);
    }

    // Distinguishable, so a user can tell which surface degraded.
    expect(fallbackLabels.size).toBe(VA_REFERENCE_SURFACES.length);
  });

  it("resolves the result environment before falling back to configuration", () => {
    const result = (
      environment?: VaApiEnvironment,
      s: VaApiSource = "va-sandbox-api",
    ) => ({ environment, source: s });

    // What the result reports wins — including when it under-claims, so a
    // sandbox result is never relabelled production by configuration.
    expect(
      resolveVaResultEnvironment(result("production"), "sandbox"),
    ).toBe("production");
    expect(
      resolveVaResultEnvironment(result("sandbox"), "production"),
    ).toBe("sandbox");

    // No reported environment: the source it came from decides.
    expect(
      resolveVaResultEnvironment(result(undefined, "va-production-api"), "sandbox"),
    ).toBe("production");

    // Sandbox and local sources fall back to configuration, never production.
    expect(
      resolveVaResultEnvironment(result(undefined, "va-sandbox-api"), "sandbox"),
    ).toBe("sandbox");
    expect(
      resolveVaResultEnvironment(result(undefined, "local-fallback"), "sandbox"),
    ).toBe("sandbox");
    expect(
      resolveVaResultEnvironment(result(undefined, "local-fallback"), "production"),
    ).toBe("production");
  });

  it("builds live provenance carrying the environment that produced it", () => {
    const status = vaLiveStatus(
      "service-branches",
      "production",
      "va-production-api",
    );

    expect(status).toMatchObject({
      source: "va-production-api",
      live: true,
      environment: "production",
      cacheStatus: "miss",
      ...vaProvenanceCopy("service-branches", "production"),
    });
    expect(new Date(status.retrievedAt as string).toISOString()).toBe(
      status.retrievedAt,
    );

    // The same call in sandbox must not reuse the production wording.
    const sandbox = vaLiveStatus(
      "service-branches",
      "sandbox",
      "va-sandbox-api",
    );
    expect(sandbox.notice).not.toBe(status.notice);
    expect(sandbox.sourceLabel).not.toBe(status.sourceLabel);
  });

  it("builds degraded provenance that cannot be mistaken for VA data", () => {
    for (const surface of VA_REFERENCE_SURFACES) {
      expect(vaFallbackStatus(surface)).toEqual({
        source: "local-fallback",
        ...vaFallbackCopy(surface),
        live: false,
        environment: null,
        retrievedAt: null,
        cacheStatus: "miss",
      });
    }
  });

  it("keeps every provenance string in exactly one module", () => {
    const strings = allCopyStrings();
    expect(strings.length).toBeGreaterThan(20);

    for (const [surface, path] of Object.entries(SURFACE_SOURCES)) {
      const text = source(path);
      for (const value of strings) {
        // Byte-identical copy may live only in provenance.ts.
        expect(text, `${surface} still inlines copy`).not.toContain(value);
      }
    }
  });

  it("routes each loader through the shared owner for its own surface", () => {
    const builders: Record<
      VaReferenceSurface,
      { live: string; fallback: string }
    > = {
      "service-branches": {
        live: "vaLiveStatus",
        fallback: "vaFallbackStatus",
      },
      "forms-finder": { live: "vaLiveStatus", fallback: "vaFallbackStatus" },
      // `ClaimFormReference` carries no `live`/`cacheStatus`, so copy only.
      "form-reference": {
        live: "vaProvenanceCopy",
        fallback: "vaFallbackCopy",
      },
      "disability-reference": {
        live: "vaLiveStatus",
        fallback: "vaFallbackStatus",
      },
      "accredited-representatives": {
        live: "vaLiveStatus",
        fallback: "vaFallbackStatus",
      },
    };

    for (const [surface, path] of Object.entries(SURFACE_SOURCES) as Array<
      [VaReferenceSurface, string]
    >) {
      const text = source(path);
      const { live, fallback } = builders[surface];

      // Match a *call* naming this loader's own surface. Matching the bare
      // identifier would pass on the import alone, which is exactly how a
      // loader could keep the import while no longer using it.
      expect(text, `${surface} live copy`).toMatch(
        new RegExp(`${live}\\(\\s*"${surface}"`),
      );
      expect(text, `${surface} fallback copy`).toMatch(
        new RegExp(`${fallback}\\(\\s*"${surface}"`),
      );

      // Resolution is shared too, and must be driven by the result — this is
      // the rule `forms-finder` used to skip by labelling from configuration.
      expect(text, `${surface} environment resolution`).toMatch(
        /resolveVaResultEnvironment\(\s*result,/,
      );
    }
  });

  it("labels production metadata from the result, not from configuration", async () => {
    const attributes = {
      form_name: "21-526EZ",
      title: "Application for Disability Compensation",
      url: "https://www.va.gov/vaforms/21-526EZ.pdf",
      last_revision_on: "2026-01-01",
      deleted_at: null,
    };

    // An injected fetcher disables both cache tiers, so these calls cannot
    // observe each other's entries.
    const production = await loadClaimFormReference(async () => ({
      success: true,
      source: "va-production-api",
      environment: "production",
      data: { data: [{ attributes }] },
    }));

    expect(production.source).toBe("va-production-api");
    expect(production.sourceLabel).toBe(
      vaProvenanceCopy("form-reference", "production").sourceLabel,
    );
    expect(production.notice).toBe(
      vaProvenanceCopy("form-reference", "production").notice,
    );

    // A sandbox result must never be promoted to production wording.
    const sandbox = await loadClaimFormReference(async () => ({
      success: true,
      source: "va-sandbox-api",
      environment: "sandbox",
      data: { data: [{ attributes }] },
    }));

    expect(sandbox.sourceLabel).toBe(
      vaProvenanceCopy("form-reference", "sandbox").sourceLabel,
    );
    expect(sandbox.notice).toContain("may not be current");

    // A degraded result must explain itself as local.
    const fallback = await loadClaimFormReference(async () => ({
      success: false,
      source: "local-fallback",
      data: null,
      error: "disabled",
    }));

    expect(fallback.sourceLabel).toBe(
      vaFallbackCopy("form-reference").sourceLabel,
    );
    expect(fallback.notice).toBe(vaFallbackCopy("form-reference").notice);
  });
});
