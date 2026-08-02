import { describe, it, expect } from "vitest";
import { formatClaimSummary } from "../src/lib/engine/export";
import type { Recommendation } from "../src/lib/engine/types";
import type { EvidenceEvaluation } from "../src/lib/engine/evaluation";

describe("P2 Ticket 10: PDF/Text Export for Representative Meetings", () => {
  it("generates a clean formatted text summary adhering to non-diagnostic standards", () => {
    const mockRecs: Recommendation[] = [
      {
        conditionId: "radiculopathy",
        condition: "Radiculopathy",
        bodySystem: "Neurological",
        prevalence: "commonly-explored",
        score: 1.0,
        contributingPrimaries: [{ id: "lumbar-strain", name: "Lumbar Strain", rank: 1, rationale: "Direct nerve impact" }],
        evidenceGaps: ["Current diagnosis records"],
        sourceReferences: [{ citation: "38 CFR § 3.310", note: "Authority note", verified: false }],
        matchedIntakeContext: []
      }
    ];

    const mockEvals: EvidenceEvaluation[] = [
      {
        conditionId: "radiculopathy",
        satisfiedGaps: ["Current diagnosis records"],
        remainingGaps: []
      }
    ];

    const summary = formatClaimSummary(mockRecs, mockEvals);
    expect(summary).toContain("SECONDARY CLAIM RESEARCH & EVIDENCE CHECKLIST");
    expect(summary).toContain("Radiculopathy");
    expect(summary).toContain("38 CFR § 3.310");
    expect(summary).toContain("Remaining Gaps: None yet");
    expect(summary).toContain("educational and research preparation purposes only");
  });
});
