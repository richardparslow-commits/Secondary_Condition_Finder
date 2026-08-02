import { describe, it, expect } from "vitest";
import { evaluateEvidence } from "../src/lib/engine/evaluation";
import type { Recommendation } from "../src/lib/engine/types";

describe("P2 Ticket 9: Evidence Evaluation Output Model", () => {
  const mockRecs: Recommendation[] = [
    {
      conditionId: "radiculopathy",
      condition: "Radiculopathy",
      bodySystem: "Neurological",
      prevalence: "commonly-explored",
      score: 1.0,
      contributingPrimaries: [],
      evidenceGaps: ["Current diagnosis records", "Nexus letter from treating clinician"],
      sourceReferences: [],
      matchedIntakeContext: []
    }
  ];

  it("does not treat format-only indicators as completed evidence", () => {
    const evaluations = evaluateEvidence(mockRecs, ["format-pdf"]);

    expect(evaluations).toHaveLength(1);
    expect(evaluations[0].conditionId).toBe("radiculopathy");
    expect(evaluations[0].satisfiedGaps).toEqual([]);
    expect(evaluations[0].remainingGaps).toEqual([
      "Current diagnosis records",
      "Nexus letter from treating clinician",
    ]);
  });

  it("requires an explicit matching indicator for a diagnosis-record gap", () => {
    const evaluations = evaluateEvidence(mockRecs, ["medical-records"]);

    expect(evaluations[0].satisfiedGaps).toEqual([]);
    expect(evaluations[0].remainingGaps).toContain("Current diagnosis records");
  });

  it("satisfies only gaps with supported semantic indicators", () => {
    const evaluations = evaluateEvidence(mockRecs, [
      "current-diagnosis-records",
      "nexus-letter",
    ]);

    expect(evaluations[0].satisfiedGaps).toEqual([
      "Current diagnosis records",
      "Nexus letter from treating clinician",
    ]);
    expect(evaluations[0].remainingGaps).toEqual([]);
  });

  it("leaves unrelated gaps unmatched when only one indicator applies", () => {
    const mockRecs: Recommendation[] = [
      {
        conditionId: "radiculopathy",
        condition: "Radiculopathy",
        bodySystem: "Neurological",
        prevalence: "commonly-explored",
        score: 1.0,
        contributingPrimaries: [],
        evidenceGaps: ["Current diagnosis", "Treatment records"],
        sourceReferences: [],
        matchedIntakeContext: []
      }
    ];

    const evaluations = evaluateEvidence(mockRecs, ["current-diagnosis"]);

    expect(evaluations[0].satisfiedGaps).toEqual(["Current diagnosis"]);
    expect(evaluations[0].remainingGaps).toEqual(["Treatment records"]);
  });
});
