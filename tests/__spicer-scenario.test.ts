/**
 * ME-40 Spicer scenario test.
 *
 * Exercises the PTSD(SC) + REM Sleep Disorder(non-SC) wizard flow through
 * the engine and Step-5 SSR rendering, verifying that:
 * 1. PTSD has 19 published suggestions including REM
 * 2. The evidence classifier recognizes Spicer-standard phrases
 * 3. The export output includes the Spicer legal note
 * 4. The consensus explanation references the Spicer but-for standard
 */
import { describe, expect, it } from "vitest";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { analyzeEvidenceText } from "@/lib/evidence/extract";
import { formatClaimSummary } from "@/lib/engine/export";
import { CONSENSUS_EXPLANATION } from "@/lib/recommendation-prevalence";
import type { EvidenceSourceMetadata } from "@/lib/evidence/extract";

const PTSD_ID = "ptsd";
const REM_ID = "rem-sleep-disorder";

function getKb() {
  return loadKnowledgeBase();
}

const dummyMetadata: EvidenceSourceMetadata = {
  sourceName: "nexus-letter.txt",
  credential: "physician",
};

describe("ME-40 Spicer regulatory scenario", () => {
  it("PTSD has 20 published suggestions including REM Sleep Disorder", () => {
    const kb = getKb();
    const ptsd = kb.find((m) => m.id === PTSD_ID)!;
    expect(ptsd).toBeDefined();
    expect(ptsd.draft).toBe(false);
    expect(ptsd.suggestions.length).toBe(20);
    const rem = ptsd.suggestions.find((s) => s.conditionId === REM_ID)!;
    expect(rem).toBeDefined();
    expect(rem.nexusClaim.nexusClassification).toBe("ASSOCIATION_ONLY");
    expect(rem.causalMechanism.hypothesizedOnly).toBe(true);
  });

  it("evidence classifier detects Spicer 'but for' causation phrases", () => {
    const spicerText =
      "It is at least as likely as not that the veteran's REM sleep disorder would be less severe today but for the service-connected PTSD, including where PTSD has interfered with or impeded treatment for the REM sleep disorder.";
    const result = analyzeEvidenceText(spicerText, dummyMetadata, ["ptsd", "rem-sleep-disorder"]);
    expect(result.excerpts.length).toBeGreaterThan(0);
    // Should detect at least one keyword in any excerpt
    // Excerpts should be classified as nexus-relevant (causation or aggravation)
    const categories = result.excerpts.map((e) => e.category);
    expect(categories.some((c) => c === "causation" || c === "aggravation")).toBe(true);
  });

  it("evidence classifier detects treatment-interference phrases", () => {
    const treatmentText =
      "PTSD caused missed appointments and worsened the veteran's sleep disorder by preventing timely polysomnography and interfering with treatment adherence.";
    const result = analyzeEvidenceText(treatmentText, dummyMetadata, ["ptsd", "sleep"]);
    expect(result.excerpts.length).toBeGreaterThan(0);
    // Excerpts should be classified as aggravation ("worsened" / "interfering with treatment" matches AGGRAVATION_PATTERNS)
    const categories = result.excerpts.map((e) => e.category);
    expect(categories).toContain("aggravation");
  });

  it("export output includes Spicer legal note", () => {
    const kb = getKb();
    const ptsd = kb.find((m) => m.id === PTSD_ID)!;
    const rem = ptsd.suggestions.find((s) => s.conditionId === REM_ID)!;
    const output = formatClaimSummary(
      [
        {
          conditionId: REM_ID,
          condition: "REM Sleep Disorder",
          bodySystem: "Neurological",
          etiologicalConsensus: "NOT_ESTABLISHED" as const,
          score: 1,
          contributingPrimaries: [{ id: "ptsd", name: "PTSD", rank: 1, rationale: "test" }],
          sourceReferences: rem.sourceReferences,
          evidenceGaps: rem.evidenceGaps,
          matchedIntakeContext: [],
        },
      ],
      [],
    );
    expect(output).toContain("Spicer");
    expect(output).toContain("but for");
    expect(output).toContain("38 CFR");
  });

  it("NOT_ESTABLISHED consensus explanation references Spicer but-for standard", () => {
    expect(CONSENSUS_EXPLANATION.NOT_ESTABLISHED).toContain("but for");
    expect(CONSENSUS_EXPLANATION.NOT_ESTABLISHED).toContain("treatment");
  });

  it("all PTSD suggestions carry hypothesizedOnly for ASSOCIATION_ONLY edges", () => {
    const kb = getKb();
    const ptsd = kb.find((m) => m.id === PTSD_ID)!;
    for (const s of ptsd.suggestions) {
      if (s.nexusClaim.nexusClassification === "ASSOCIATION_ONLY") {
        expect(s.causalMechanism.hypothesizedOnly).toBe(true);
      }
    }
  });
});
