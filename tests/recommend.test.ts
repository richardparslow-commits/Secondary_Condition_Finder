import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";
import { recommend } from "@/lib/engine/recommend";
import { intakeSchema, type Intake } from "@/lib/engine/types";

const kb = loadKnowledgeBase();

function intake(partial: Partial<Intake> & Pick<Intake, "primaryConditions">): Intake {
  return intakeSchema.parse(partial);
}

describe("recommend", () => {
  it("ports the original prototype ordering for PTSD", () => {
    const { recommendations } = recommend(
      kb,
      intake({ primaryConditions: [" PTSD "] }),
    );
    expect(recommendations.map((r) => r.condition)).toEqual([
      "Sleep apnea",
      "Depressive disorder",
      "Migraine headaches",
      "Gastroesophageal reflux disease (GERD)",
    ]);
  });

  it("returns rationale, evidence gaps, and citations for every suggestion", () => {
    const { recommendations } = recommend(
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
      kb,
      intake({ primaryConditions: ["unknown condition"] }),
    );
    expect(result.recommendations).toEqual([]);
    expect(result.unrecognizedPrimaries).toEqual(["unknown condition"]);
    expect(result.recognizedPrimaries).toEqual([]);
  });

  it("separates recognized from unrecognized primaries in a mixed intake", () => {
    const result = recommend(
      kb,
      intake({ primaryConditions: ["Tinnitus", "Plantar fasciitis"] }),
    );
    expect(result.recognizedPrimaries).toEqual(["Tinnitus"]);
    expect(result.unrecognizedPrimaries).toEqual(["Plantar fasciitis"]);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("merges a suggestion shared by two primaries and ranks it above single-source peers", () => {
    const result = recommend(
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
      "Lumbar strain",
      "Tinnitus",
    ]);
    expect(depression!.score).toBeGreaterThan(1 / 3);
  });

  it("does not suggest a condition the user already listed as a primary", () => {
    // Knee injury lists lumbar strain as a compensatory secondary. If the user
    // is already service connected for lumbar strain, suggesting it is noise.
    const kneeOnly = recommend(kb, intake({ primaryConditions: ["Knee injury"] }));
    expect(kneeOnly.recommendations.map((r) => r.conditionId)).toContain(
      "lumbar-strain",
    );

    const both = recommend(
      kb,
      intake({ primaryConditions: ["Knee injury", "Lumbar strain"] }),
    );
    expect(both.recommendations.map((r) => r.conditionId)).not.toContain(
      "lumbar-strain",
    );
  });

  it("deduplicates repeated primary conditions", () => {
    const single = recommend(kb, intake({ primaryConditions: ["PTSD"] }));
    const doubled = recommend(
      kb,
      intake({ primaryConditions: ["PTSD", "ptsd", " PTSD "] }),
    );
    expect(doubled.recognizedPrimaries).toEqual(["PTSD"]);
    expect(doubled.recommendations).toEqual(single.recommendations);
  });

  it("sorts strictly by descending score", () => {
    const { recommendations } = recommend(
      kb,
      intake({ primaryConditions: ["Knee injury", "Lumbar strain"] }),
    );
    const scores = recommendations.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("surfaces matching intake context without changing the ranking", () => {
    const base = recommend(kb, intake({ primaryConditions: ["Tinnitus"] }));
    const withContext = recommend(
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
