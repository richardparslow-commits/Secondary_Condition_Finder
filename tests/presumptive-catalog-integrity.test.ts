import { describe, expect, it } from "vitest";

import { indexById } from "@/lib/catalog/lookup";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadExposureCatalog } from "@/lib/presumptive/load";
import { NON_CATALOG_PRESUMPTIVE_IDS } from "@/lib/presumptive/nonCatalogConditionIds";

/**
 * The presumptive lists restate VA's exposure lists, which group conditions
 * differently from the rating-style condition catalog. Ids that legitimately
 * exist only in the presumptive data are allowlisted with a reason in
 * src/lib/presumptive/nonCatalogConditionIds.ts; everything else must use the
 * exact catalog id so the two data spaces cannot drift apart silently.
 */
describe("presumptive catalog identity integrity", () => {
  const catalogIds = new Set(indexById(loadConditionCatalog()).keys());
  const presumptiveIds = new Set(
    loadExposureCatalog().flatMap((category) =>
      category.conditions.map((condition) => condition.conditionId),
    ),
  );

  it("resolves every presumptive conditionId to the catalog or the allowlist", () => {
    const allowlisted = new Set(Object.keys(NON_CATALOG_PRESUMPTIVE_IDS));
    const unresolved = [...presumptiveIds].filter(
      (id) => !catalogIds.has(id) && !allowlisted.has(id),
    );
    expect(unresolved).toEqual([]);
  });

  it("keeps no stale entries in the allowlist", () => {
    const stale = Object.keys(NON_CATALOG_PRESUMPTIVE_IDS).filter(
      (id) => !presumptiveIds.has(id),
    );
    expect(stale).toEqual([]);
  });

  it("documents a reason for every allowlisted id", () => {
    for (const [id, reason] of Object.entries(NON_CATALOG_PRESUMPTIVE_IDS)) {
      expect(reason.trim().length, `missing reason for ${id}`).toBeGreaterThan(0);
    }
  });
});
