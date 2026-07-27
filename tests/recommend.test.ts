import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { recommend } from "@/lib/engine/recommend";
import { intakeSchema, type Intake } from "@/lib/engine/types";

const catalog = loadConditionCatalog();
const kb = loadKnowledgeBase();

function intake(partial: Partial<Intake> & Pick<Intake, "primaryConditions">): Intake {
  return intakeSchema.parse(partial);
}

describe("recommend", () => {
  it("ports the original prototype ordering for PTSD", () => {
    const { recommendations } = recommend(
      catalog,
      kb,
      intake({ primaryConditions: [" PTSD "] }),
    );
    // Display names come from the catalog, not the mapping file.
    expect(recommendations.map((r) => r.conditionId)).toEqual([
      "sleep-apnea",
      "depressive-disorder",
      "migraine-headaches",
      "gerd",
    ]);
    expect(recommendations[0].condition).toBe(
      "Sleep Apnea (Obstructive, Central, Mixed)",
    );
  });

  it("returns rationale, evidence gaps, and citations for every suggestion", () => {
    const { recommendations } = recommend(
      catalog,
      kb,
      intake({ primaryConditions: ["ptsd"] }),
    );
    for (const recommendation of recommendations) {
      expect(recommendation.contributingPrimaries.length).toBeGreaterThan(0);
      expect(recommendation.contributingPrimaries[0].rationale).toBeTruthy();
      expect(recommendation.evidenceGaps.length).toBeGreaterThan(0);
      expect(recommendation.sourceReferences.length).toBeGreaterThan(0);
    }
  });

  it("returns nothing for an unknown primary and reports it as unrecognized", () => {
    const result = recommend(
      catalog,
      kb,
      intake({ primaryConditions: ["unknown condition"] }),
    );
    expect(result.recommendations).toEqual([]);
    expect(result.unrecognizedPrimaries).toEqual(["unknown condition"]);
    expect(result.unmappedPrimaries).toEqual([]);
    expect(result.recognizedPrimaries).toEqual([]);
  });

  it("carries the body system through from the catalog", () => {
    const { recommendations } = recommend(
      catalog,
      kb,
      intake({ primaryConditions: ["ptsd"] }),
    );
    for (const recommendation of recommendations) {
      expect(recommendation.bodySystem.length).toBeGreaterThan(0);
    }
  });

  it("resolves a primary by alias as well as by name", () => {
    const byId = recommend(catalog, kb, intake({ primaryConditions: ["ptsd"] }));
    const byName = recommend(
      catalog,
      kb,
      intake({ primaryConditions: ["Post-Traumatic Stress Disorder (PTSD)"] }),
    );
    expect(byName.recommendations).toEqual(byId.recommendations);
  });

  it("separates mapped, unmapped, and unrecognized primaries", () => {
    const result = recommend(
      catalog,
      kb,
      intake({
        primaryConditions: ["Tinnitus", "Plantar Fasciitis", "not a condition"],
      }),
    );
    // Plantar fasciitis is a real catalog condition with no authored mappings.
    // That is different from input we could not resolve at all, and the user
    // deserves to be told which is which.
    expect(result.recognizedPrimaries).toEqual(["Tinnitus"]);
    expect(result.unmappedPrimaries).toEqual(["Plantar Fasciitis"]);
    expect(result.unrecognizedPrimaries).toEqual(["not a condition"]);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("merges a suggestion shared by two primaries and ranks it above single-source peers", () => {
    const result = recommend(
      catalog,
      kb,
      intake({ primaryConditions: ["Tinnitus", "Lumbar strain"] }),
    );
    const depression = result.recommendations.find(
      (r) => r.conditionId === "depressive-disorder",
    );

    // Tinnitus rank 3 (0.333) + lumbar strain rank 3 (0.333) = 0.667, which is
    // above either contribution alone.
    expect(depression).toBeDefined();
    expect(depression!.contributingPrimaries).toHaveLength(2);
    expect(depression!.contributingPrimaries.map((p) => p.name)).toEqual([
      "Lumbar Strain",
      "Tinnitus",
    ]);
    expect(depression!.score).toBeGreaterThan(1 / 3);
  });

  it("does not suggest a condition the user already listed as a primary", () => {
    // Knee injury lists lumbar strain as a compensatory secondary. If the user
    // is already service connected for lumbar strain, suggesting it is noise.
    const kneeOnly = recommend(catalog, kb, intake({ primaryConditions: ["Knee injury"] }));
    expect(kneeOnly.recommendations.map((r) => r.conditionId)).toContain(
      "lumbar-strain",
    );

    const both = recommend(
      catalog,
      kb,
      intake({ primaryConditions: ["Knee injury", "Lumbar strain"] }),
    );
    expect(both.recommendations.map((r) => r.conditionId)).not.toContain(
      "lumbar-strain",
    );
  });

  it("deduplicates repeated primary conditions", () => {
    const single = recommend(catalog, kb, intake({ primaryConditions: ["PTSD"] }));
    const doubled = recommend(
      catalog,
      kb,
      intake({ primaryConditions: ["PTSD", "ptsd", " PTSD "] }),
    );
    expect(doubled.recognizedPrimaries).toEqual([
      "Post-Traumatic Stress Disorder (PTSD)",
    ]);
    expect(doubled.recommendations).toEqual(single.recommendations);
  });

  it("sorts strictly by descending score", () => {
    const { recommendations } = recommend(
      catalog,
      kb,
      intake({ primaryConditions: ["Knee injury", "Lumbar strain"] }),
    );
    const scores = recommendations.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("surfaces matching intake context without changing the ranking", () => {
    const base = recommend(catalog, kb, intake({ primaryConditions: ["Tinnitus"] }));
    const withContext = recommend(
      catalog,
      kb,
      intake({ primaryConditions: ["Tinnitus"], symptoms: ["anxiety"] }),
    );

    expect(withContext.recommendations.map((r) => r.condition)).toEqual(
      base.recommendations.map((r) => r.condition),
    );
    expect(withContext.recommendations.map((r) => r.score)).toEqual(
      base.recommendations.map((r) => r.score),
    );

    const anxiety = withContext.recommendations.find(
      (r) => r.conditionId === "anxiety-disorder",
    );
    expect(anxiety?.matchedIntakeContext).toContain("anxiety");
  });

  it("never emits a numeric confidence, only a qualitative prevalence band", () => {
    const { recommendations } = recommend(
      catalog,
      kb,
      intake({ primaryConditions: ["Diabetes mellitus type II"] }),
    );
    for (const recommendation of recommendations) {
      expect([
        "commonly-explored",
        "sometimes-explored",
        "occasionally-explored",
      ]).toContain(recommendation.prevalence);
    }
  });
});

describe("intakeSchema", () => {
  it("requires at least one primary condition", () => {
    expect(() => intakeSchema.parse({ primaryConditions: [] })).toThrow();
  });

  it("defaults the optional intake fields", () => {
    const parsed = intakeSchema.parse({ primaryConditions: ["PTSD"] });
    expect(parsed.symptoms).toEqual([]);
    expect(parsed.medications).toEqual([]);
    expect(parsed.exposures).toEqual([]);
    expect(parsed.notes).toBe("");
  });
});
