import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { NonServiceConnectedConditionResult } from "@/components/NonServiceConnectedConditionResult";
import type { Recommendation } from "@/lib/engine/types";
import {
  CONSENSUS_BADGE_CLASS,
  CONSENSUS_EXPLANATION,
  CONSENSUS_LABEL,
  consensusLiteratureSentence,
  consensusTone,
  type ConsensusTone,
} from "@/lib/recommendation-prevalence";

const recommendationsModule = "src/lib/recommendation-prevalence.ts";

const mappedSleepApnea: Recommendation = {
  conditionId: "sleep-apnea",
  condition: "Sleep Apnea",
  bodySystem: "Respiratory",
  etiologicalConsensus: "WELL_ESTABLISHED",
  score: 1.5,
  contributingPrimaries: [
    {
      id: "ptsd",
      name: "Post-Traumatic Stress Disorder (PTSD)",
      rank: 1,
      rationale: "Authored PTSD to sleep-apnea relationship for test purposes.",
    },
  ],
  evidenceGaps: ["chronology"],
  sourceReferences: [
    {
      citation: "test source",
      note: "test",
      verificationScope: "clinical-evidence",
      verified: false,
    },
  ],
  matchedIntakeContext: [],
};

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

describe("consensus evidence-strength indicators", () => {
  it("maps every consensus tier to a single visual tone with no unmapped label", () => {
    const expected: Record<string, ConsensusTone> = {
      WELL_ESTABLISHED: "strong",
      IATROGENIC_TREATMENT_EFFECT: "moderate",
      PROBABLE: "moderate",
      CONTESTED_REQUIRES_SPECIFIC_EVIDENCE: "contested",
      NOT_ESTABLISHED: "not-established",
    };
    for (const consensus of Object.keys(CONSENSUS_LABEL) as Array<keyof typeof CONSENSUS_LABEL>) {
      expect(consensusTone(consensus)).toBe(expected[consensus]);
    }
  });

  it("gives each tone a distinct, non-empty badge class palette (green/amber/orange/gray)", () => {
    const tones: ConsensusTone[] = ["strong", "moderate", "contested", "not-established"];
    const classes = tones.map((tone) => CONSENSUS_BADGE_CLASS[tone]);
    for (const value of classes) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
    expect(new Set(classes).size).toBe(tones.length);
    expect(CONSENSUS_BADGE_CLASS.strong).toContain("emerald");
    expect(CONSENSUS_BADGE_CLASS.moderate).toContain("amber");
    expect(CONSENSUS_BADGE_CLASS.contested).toContain("orange");
    expect(CONSENSUS_BADGE_CLASS["not-established"]).toContain("slate");
  });

  it("renders the consensus badge with tone class, label, and tooltip on the Step 5/6 card", () => {
    const html = renderToStaticMarkup(
      NonServiceConnectedConditionResult({
        result: {
          conditionId: "sleep-apnea",
          conditionName: "Sleep Apnea",
          bodySystem: "Respiratory",
          recommendation: mappedSleepApnea,
        },
        vaReference: { live: false, sourceLabel: "test fixture", environment: null, loadedCount: 0, totalAvailable: 0, match: null },
      }),
    );
    expect(html).toContain("Well established");
    expect(html).toContain("bg-emerald-50");
    expect(html).toContain(`title="${CONSENSUS_EXPLANATION.WELL_ESTABLISHED}"`);
    // Condition-specific literature sentence appears under each contributing primary.
    expect(html).toContain("is well established, which means broad clinical consensus");
  });

  it("renders no badge when no published relationship exists", () => {
    const html = renderToStaticMarkup(
      NonServiceConnectedConditionResult({
        result: {
          conditionId: "tinnitus",
          conditionName: "Tinnitus",
          bodySystem: "Auditory",
          recommendation: null,
        },
        vaReference: { live: false, sourceLabel: "test fixture", environment: null, loadedCount: 0, totalAvailable: 0, match: null },
      }),
    );
    expect(html).not.toContain("bg-emerald-50");
    expect(html).not.toContain("which means");
    expect(html).toContain("No published relationship was found");
  });

  it("produces a condition-specific literature sentence for every tier with fallbacks", () => {
    for (const consensus of Object.keys(CONSENSUS_LABEL) as Array<keyof typeof CONSENSUS_LABEL>) {
      const sentence = consensusLiteratureSentence("PTSD", "Sleep Apnea", consensus);
      expect(sentence).toContain("PTSD");
      expect(sentence).toContain("Sleep Apnea");
      expect(sentence.length).toBeGreaterThan(40);
      const fallback = consensusLiteratureSentence("  ", "", consensus);
      expect(fallback).toContain("the service-connected condition");
      expect(fallback).toContain("the secondary condition");
    }
  });

  it("keeps the four consumer surfaces on the shared primitives with no private palette copies", () => {
    const ncr = readSource("src/components/NonServiceConnectedConditionResult.tsx");
    expect(ncr).toContain("CONSENSUS_BADGE_CLASS[consensusTone(recommendation.etiologicalConsensus)]");
    expect(ncr).toContain("consensusLiteratureSentence(");

    const suggestionCard = readSource("src/components/SuggestionCard.tsx");
    expect(suggestionCard).toContain("CONSENSUS_BADGE_CLASS[consensusTone(recommendation.etiologicalConsensus)]");
    expect(suggestionCard).not.toContain("CONSENSUS_STYLE");

    const suggestionItem = readSource("src/components/SecondarySuggestionItem.tsx");
    expect(suggestionItem).toContain("CONSENSUS_BADGE_CLASS[consensusTone(recommendation.etiologicalConsensus)]");

    const comparisonTool = readSource("src/components/secondary/ConditionComparisonTool.tsx");
    expect(comparisonTool).toContain("CONSENSUS_BADGE_CLASS[tone]");
    expect(comparisonTool).not.toContain("function badgeClass");

    const comparisonModule = readSource("src/lib/secondary-workflow/condition-comparison.ts");
    expect(comparisonModule).toContain("etiologicalConsensus: EtiologicalConsensus");
    expect(comparisonModule).toContain("return consensusTone(consensus)");
  });

  it("documents that badge tones are qualitative, never a VA outcome prediction", () => {
    const source = readSource(recommendationsModule);
    expect(source).toContain("ordinal-free");
    expect(source).toContain("never a probability");
  });
});
