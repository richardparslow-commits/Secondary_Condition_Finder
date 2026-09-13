import { describe, it, expect } from "vitest";
import { isExposureRelated, TOXIC_EXPOSURE_CONDITION_IDS } from "../src/lib/catalog/exposure-tags";
import { loadConditionCatalog } from "../src/lib/catalog/load";

describe("P1 Ticket 4: Diagnosed Conditions Exposure Discoverability", () => {
  it("correctly flags known PACT Act / toxic exposure conditions", () => {
    expect(isExposureRelated("asthma")).toBe(true);
    expect(isExposureRelated("chronic-sinusitis")).toBe(true);
    expect(isExposureRelated("leukemia")).toBe(true);
    expect(isExposureRelated("hodgkins-lymphoma")).toBe(true);
    expect(isExposureRelated("non-hodgkins-lymphoma")).toBe(true);
    expect(isExposureRelated("skin-cancer")).toBe(true);
  });

  it("does not flag unrelated standard conditions as exposure-related", () => {
    expect(isExposureRelated("tinnitus")).toBe(false);
    expect(isExposureRelated("migraine-headaches")).toBe(false);
  });

  it("maintains catalog ID consistency without duplicate identity definitions", () => {
    const catalogIds = new Set(loadConditionCatalog().map((c) => c.id));
    TOXIC_EXPOSURE_CONDITION_IDS.forEach(id => {
      expect(
        catalogIds.has(id),
        `Exposure-tagged id "${id}" does not resolve to a catalog condition`,
      ).toBe(true);
    });
  });
});
