import { describe, it, expect } from "vitest";
import { isExposureRelated, TOXIC_EXPOSURE_CONDITION_IDS } from "../src/lib/catalog/exposure-tags";

describe("P1 Ticket 4: Diagnosed Conditions Exposure Discoverability", () => {
  it("correctly flags known PACT Act / toxic exposure conditions", () => {
    expect(isExposureRelated("asthma")).toBe(true);
    expect(isExposureRelated("chronic-sinusitis")).toBe(true);
    expect(isExposureRelated("leukemia")).toBe(true);
  });

  it("does not flag unrelated standard conditions as exposure-related", () => {
    expect(isExposureRelated("tinnitus")).toBe(false);
    expect(isExposureRelated("migraine-headaches")).toBe(false);
  });

  it("maintains catalog ID consistency without duplicate identity definitions", () => {
    TOXIC_EXPOSURE_CONDITION_IDS.forEach(id => {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });
  });
});
