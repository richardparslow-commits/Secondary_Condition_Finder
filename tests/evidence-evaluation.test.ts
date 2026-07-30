import { describe, it, expect } from "vitest";
import { evaluateEvidence } from "../src/lib/engine/evaluation";
import type { Recommendation } from "../src/lib/engine/types";

describe("P2 Ticket 9: Evidence Evaluation Output Model", () => {
  it("correctly correlates derived indicators with evidence gaps", () => {
    const mockRecs: Recommendation[] = [
      {
        conditionId: "radiculopathy",
        condition: "Radiculopathy",
        bodySystem: "Neurological",
        prevalence: "commonly-explored",
        score: 1.0,
        contributingPrimaries: [],
        evidenceGaps: ["Current diagnosis records"],
        sourceReferences: [],
        matchedIntakeContext: []
      }
    ];

    const evaluations = evaluateEvidence(mockRecs, ["format-pdf"]);
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0].conditionId).toBe("radiculopathy");
    expect(evaluations[0].satisfiedGaps).toContain("Current diagnosis records");
  });
});
