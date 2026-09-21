import fs from "node:fs";
import { describe, expect, it } from "vitest";

import {
  getSpicerAggravationGuidance,
  SPICER_PATHWAY_HEADING,
  SPICER_PATHWAY_TYPES,
} from "../src/lib/secondary-workflow/spicer-aggravation";

/**
 * Contracts for the Spicer treatment-interference aggravation presentation
 * variant (May 2026 M21-1 update implementing Spicer v. McDonough).
 *
 * The core safety property: the Spicer card may appear ONLY on a mapping
 * that is BOTH authored AGGRAVATION and marked with a Spicer pathway type
 * (care-obstacle / treatment-complication). An ordinary aggravation theory
 * must never render the card (veterans would gather the wrong records), and
 * a Spicer pathway type on a non-aggravation classification must never claim
 * § 3.310(b) treatment-interference semantics.
 *
 * Copy contracts mirror the repo-wide FORBIDDEN_PHRASES posture: no
 * eligibility/approval/guarantee language anywhere in the guidance.
 */

describe("Spicer pathway detection", () => {
  it("activates only for AGGRAVATION with a Spicer pathway type", () => {
    for (const pathwayTypes of [["care-obstacle"], ["treatment-complication"], ["aggravation", "care-obstacle", "treatment-complication"]]) {
      const guidance = getSpicerAggravationGuidance({
        nexusClassification: "AGGRAVATION",
        pathwayTypes,
        conditionName: "Sleep Apnea",
      });
      expect(guidance.active, pathwayTypes.join(",")).toBe(true);
    }
  });

  it("never activates for an ordinary aggravation theory without Spicer pathway types", () => {
    const guidance = getSpicerAggravationGuidance({
      nexusClassification: "AGGRAVATION",
      pathwayTypes: ["aggravation", "biomechanical"],
      conditionName: "Sleep Apnea",
    });
    expect(guidance.active).toBe(false);
  });

  it("never activates for non-aggravation classifications even with Spicer pathway types", () => {
    for (const nexusClassification of ["DIRECT_CAUSATION", "ASSOCIATION_ONLY", null, undefined]) {
      const guidance = getSpicerAggravationGuidance({
        nexusClassification,
        pathwayTypes: ["care-obstacle", "treatment-complication"],
        conditionName: "Sleep Apnea",
      });
      expect(guidance.active, String(nexusClassification)).toBe(false);
    }
  });

  it("handles missing pathway types and classifications without crashing", () => {
    expect(
      getSpicerAggravationGuidance({ conditionName: "Sleep Apnea" }).active,
    ).toBe(false);
    expect(
      getSpicerAggravationGuidance({
        nexusClassification: "AGGRAVATION",
        conditionName: "Sleep Apnea",
      }).active,
    ).toBe(false);
  });
});

describe("Spicer guidance copy contracts", () => {
  const guidance = getSpicerAggravationGuidance({
    nexusClassification: "AGGRAVATION",
    pathwayTypes: ["care-obstacle", "treatment-complication"],
    conditionName: "Sleep Apnea",
  });

  it("names the legal authority and the Spicer case", () => {
    expect(guidance.explanation).toContain("38 CFR § 3.310(b)");
    expect(guidance.explanation).toContain("Spicer v. McDonough");
    expect(guidance.explanation).toContain("M21-1");
  });

  it("differentiates the proof path from ordinary aggravation", () => {
    expect(guidance.burdenLine).toContain("at least as likely as not");
    expect(guidance.burdenLine).toMatch(/treatment-interference records/i);
    expect(guidance.burdenLine).toMatch(/before-and-after severity comparison/i);
    expect(guidance.burdenLine).toContain("not a determination");
  });

  it("tailors the explanation to the secondary condition", () => {
    expect(guidance.explanation).toContain("Sleep Apnea");
    const other = getSpicerAggravationGuidance({
      nexusClassification: "AGGRAVATION",
      pathwayTypes: ["care-obstacle"],
      conditionName: "Knee Osteoarthritis",
    });
    expect(other.explanation).toContain("Knee Osteoarthritis");
  });

  it("supplies treatment-record kinds for each authored Spicer pathway", () => {
    expect(guidance.recordKinds.length).toBeGreaterThanOrEqual(3);
    const joined = guidance.recordKinds.join(" ");
    // care-obstacle records
    expect(joined).toMatch(/missed, delayed, or cancelled appointments/i);
    expect(joined).toMatch(/halted or interrupted treatment/i);
    // treatment-complication records
    expect(joined).toMatch(/pharmacy fill history/i);
    expect(joined).toMatch(/medication interactions or treatment conflicts/i);
  });

  it("dedupes record kinds when both Spicer pathway types are authored", () => {
    const both = getSpicerAggravationGuidance({
      nexusClassification: "AGGRAVATION",
      pathwayTypes: ["care-obstacle", "treatment-complication"],
      conditionName: "X",
    });
    expect(new Set(both.recordKinds).size).toBe(both.recordKinds.length);
  });

  it("uses no forbidden eligibility/approval language", () => {
    const haystack = [
      guidance.heading,
      guidance.explanation,
      guidance.burdenLine,
      ...guidance.recordKinds,
    ]
      .join(" ")
      .toLowerCase();
    expect(haystack).not.toContain("eligible");
    expect(haystack).not.toContain("approval");
    expect(haystack).not.toContain("approved");
    expect(haystack).not.toContain("guarantee");
    expect(haystack).not.toContain("entitlement");
  });

  it("keeps the inactive guidance empty so no partial card can render", () => {
    const inactive = getSpicerAggravationGuidance({
      nexusClassification: "AGGRAVATION",
      pathwayTypes: ["biomechanical"],
      conditionName: "Sleep Apnea",
    });
    expect(inactive.heading).toBe("");
    expect(inactive.explanation).toBe("");
    expect(inactive.burdenLine).toBe("");
    expect(inactive.recordKinds).toEqual([]);
  });
});

describe("Step 5 result card wiring (structural)", () => {
  const component = fs.readFileSync(
    "src/components/NonServiceConnectedConditionResult.tsx",
    "utf8",
  );

  it("renders the Spicer card from authored mapping data in the per-primary card loop", () => {
    expect(component).toContain("getSpicerAggravationGuidance");
    expect(component).toContain("spicerGuidance.active && (");
    expect(component).toContain("role=\"note\"");
    expect(component).toContain("Treatment-interference records this theory is carried by");
  });

  it("keeps the card browser-local (no network primitives in the guidance module)", () => {
    const guidanceModule = fs.readFileSync(
      "src/lib/secondary-workflow/spicer-aggravation.ts",
      "utf8",
    );
    expect(guidanceModule).not.toMatch(/\bfetch\s*\(/);
    expect(guidanceModule).not.toMatch(/\bXMLHttpRequest\b/);
    expect(guidanceModule).not.toMatch(/\bsendBeacon\b/);
  });
});

describe("Spicer constants", () => {
  it("binds exactly the two authored Spicer pathway types", () => {
    expect(SPICER_PATHWAY_TYPES).toEqual(["care-obstacle", "treatment-complication"]);
    expect(SPICER_PATHWAY_HEADING).toMatch(/Spicer/i);
  });
});
