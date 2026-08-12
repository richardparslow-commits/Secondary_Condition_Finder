import fs from "node:fs";
import path from "node:path";

import { describe, it, expect } from "vitest";
import { formatClaimSummary } from "../src/lib/engine/export";
import type { Recommendation } from "../src/lib/engine/types";
import type { EvidenceEvaluation } from "../src/lib/engine/evaluation";

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
    matchedIntakeContext: ["SSRI"]
  }
];

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("P2 Ticket 10: Text Export for Representative Meetings", () => {
  it("generates a clean formatted text summary adhering to non-diagnostic standards", () => {
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
    expect(summary).not.toContain("SSRI");
  });

  it("includes authored evidence gaps without pretending they were evaluated", () => {
    const summary = formatClaimSummary(mockRecs, []);

    expect(summary).toContain("Evidence Gaps to Review: Current diagnosis records");
    expect(summary).not.toContain("Satisfied Gaps:");
    expect(summary).not.toContain("SSRI");
  });

  it("wires Step 6 to a browser-only download with explicit privacy exclusions", () => {
    const evidencePage = readRepoFile("src/app/secondary/evidence/page.tsx");
    const downloadComponent = readRepoFile("src/components/ConsultationSummaryDownload.tsx");

    expect(evidencePage).toContain("<ConsultationSummaryDownload recommendations={consultationRecommendations} />");
    expect(evidencePage).toContain("matchedIntakeContext: []");
    expect(downloadComponent).toContain("formatClaimSummary(recommendations, [])");
    expect(downloadComponent).toContain("new Blob([content]");
    expect(downloadComponent).toContain("URL.createObjectURL(blob)");
    expect(downloadComponent).not.toContain("fetch(");
    expect(downloadComponent).not.toContain("sendBeacon");
    expect(downloadComponent).toContain("does not include raw local-evidence");
    expect(downloadComponent).toContain("optional medication/treatment context");
  });
});
