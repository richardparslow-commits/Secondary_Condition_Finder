import { describe, it, expect } from "vitest";
import { recommend } from "../src/lib/engine/recommend";
import type { ConditionCatalog } from "../src/lib/catalog/schema";
import type { KnowledgeBase } from "../src/lib/kb/schema";
import type { Recommendation } from "../src/lib/engine/types";

describe("P1 Ticket 5: Suggestion Constraints to Diagnosed Set", () => {
  const mockCatalog: ConditionCatalog = [
    { id: "lumbar-strain", name: "Lumbar Strain", bodySystem: "Musculoskeletal", aliases: [], ratingSchedule: [], reviewNotes: ["Verified"] },
    { id: "radiculopathy", name: "Radiculopathy", bodySystem: "Neurological", aliases: [], ratingSchedule: [], reviewNotes: ["Verified"] },
    { id: "depression", name: "Major Depressive Disorder", bodySystem: "Mental Health", aliases: [], ratingSchedule: [], reviewNotes: ["Verified"] }
  ];

  const mockKb: KnowledgeBase = [
    {
      id: "lumbar-strain",
      draft: false,
      todo: [],
      suggestions: [
        {
          conditionId: "radiculopathy",
          rank: 1,
          prevalence: "commonly-explored",
          rationale: "Nerve root compression due to lumbar spine pathology.",
          evidenceGaps: ["Current diagnosis"],
          sourceReferences: [{ citation: "38 CFR 3.310", note: "Direct secondary", verificationScope: "legal-framework", verified: false }]
        },
        {
          conditionId: "depression",
          rank: 2,
          prevalence: "sometimes-explored",
          rationale: "Chronic pain leading to depressive symptoms.",
          evidenceGaps: ["Mental health diagnosis"],
          sourceReferences: [{ citation: "38 CFR 3.310", note: "Secondary pain effect", verificationScope: "legal-framework", verified: false }]
        }
      ]
    }
  ];

  it("restricts recommendations strictly to user-selected diagnosed condition ids", () => {
    const intake = {
      primaryConditions: ["Lumbar Strain"],
      diagnosedConditionIds: ["radiculopathy"], // Depression is mapped, but NOT diagnosed by user
      symptoms: [],
      medications: [],
      exposures: [],
      notes: ""
    };

    const result = recommend(mockCatalog, mockKb, intake);

    // Should contain Radiculopathy, but filter out Depression.
    expect(result.recommendations.map((r: Recommendation) => r.conditionId)).toContain("radiculopathy");
    expect(result.recommendations.map((r: Recommendation) => r.conditionId)).not.toContain("depression");
  });

  it("treats an explicitly empty diagnosed id set as an empty recommendation boundary", () => {
    const result = recommend(mockCatalog, mockKb, {
      primaryConditions: ["Lumbar Strain"],
      diagnosedConditionIds: [],
      symptoms: [],
      medications: [],
      exposures: [],
      notes: "",
    });

    expect(result.recommendations).toEqual([]);
  });
});
