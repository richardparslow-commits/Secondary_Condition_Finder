import fs from "node:fs";
import path from "node:path";

import { describe, it, expect } from "vitest";
import { evaluateEvidence } from "../src/lib/engine/evaluation";
import type { Recommendation } from "../src/lib/engine/types";

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("P2 Ticket 9: Evidence Evaluation Output Model", () => {
  const mockRecs: Recommendation[] = [
    {
      conditionId: "radiculopathy",
      condition: "Radiculopathy",
      bodySystem: "Neurological",
      score: 1.0,
      contributingPrimaries: [],
      evidenceGaps: ["Current diagnosis records", "Nexus letter from treating clinician"],
      sourceReferences: [],
      matchedIntakeContext: [],
      etiologicalConsensus: "PROBABLE"
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
        score: 1.0,
        contributingPrimaries: [],
        evidenceGaps: ["Current diagnosis", "Treatment records"],
        sourceReferences: [],
        matchedIntakeContext: [],
        etiologicalConsensus: "PROBABLE"
      }
    ];

    const evaluations = evaluateEvidence(mockRecs, ["current-diagnosis"]);

    expect(evaluations[0].satisfiedGaps).toEqual(["Current diagnosis"]);
    expect(evaluations[0].remainingGaps).toEqual(["Treatment records"]);
  });

  it("wires a user-controlled, browser-local evidence-gap review into Step 6", () => {
    const page = readRepoFile("src/components/secondary/steps/EvidenceStep.tsx");
    const component = readRepoFile("src/components/evidence/EvidenceGapReview.tsx");
    const localState = readRepoFile("src/lib/secondary-workflow/local-state.ts");

    expect(page).toContain("<EvidenceGapReview recommendations={evidenceGapRecommendations} />");
    expect(page).toContain("conditionId: recommendation.conditionId");
    expect(page).toContain("condition: recommendation.condition");
    expect(page).toContain("evidenceGaps: recommendation.evidenceGaps");
    expect(component).toContain("evidenceGapReviewStorageKey");
    expect(localState).toContain('"secondary-condition-finder:evidence-gap-review:v1"');
    expect(component).toContain("window.sessionStorage.setItem");
    expect(component).toContain("User-controlled research aid");
    expect(component).toContain("does not automatically mark gaps from extracted text");
    expect(component).toContain("Material found for review");
    expect(component).not.toContain("evaluateEvidence(");
    expect(component).not.toContain("fetch(");
    expect(component).not.toContain("sendBeacon");
    expect(component).not.toContain("EvidenceExcerpt");
    expect(component).not.toContain("matchedIntakeContext");
  });

  it("keeps checklist state out of server workflow and export channels by contract", () => {
    const component = readRepoFile("src/components/evidence/EvidenceGapReview.tsx");

    expect(component).toContain("not added to workflow cookies, URLs, telemetry, recommendation logs, VA API requests, or the consultation-summary export");
    expect(component).not.toContain("cookies(");
    expect(component).not.toContain("workflowSession");
  });
});
