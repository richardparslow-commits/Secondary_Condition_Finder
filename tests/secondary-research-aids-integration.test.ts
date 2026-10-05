import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { NonServiceConnectedConditionResult } from "@/lib/secondary-workflow/suggestions";
import type { Recommendation } from "@/lib/engine/types";
import type { EvidentiaryProfile } from "@/lib/kb/schema";
import type { CatalogCondition } from "@/lib/catalog/schema";
import type { EvidenceAnalysis, EvidenceExcerpt } from "@/lib/evidence/extract";

import {
  buildActionPlan,
  formatActionPlan,
  actionPlanSteps,
} from "@/lib/secondary-workflow/action-plan";
import {
  buildComparisonRows,
  formatConditionComparison,
} from "@/lib/secondary-workflow/condition-comparison";
import {
  analyzeCombinationInsights,
  formatCombinationInsights,
} from "@/lib/secondary-workflow/combination-insights";
import {
  buildPathwayRecordChecklist,
  combineChecklistWithSummary,
  formatPathwayRecordChecklist,
} from "@/lib/secondary-workflow/pathway-record-checklist";
import {
  buildRatingGuide,
  formatRatingGuide,
} from "@/lib/secondary-workflow/rating-guide";
import {
  buildMedicalRecordChecklist,
  formatMedicalRecordChecklist,
} from "@/lib/secondary-workflow/medical-record-checklist";
import {
  combineMappingWithClaimSummary,
  formatPathwayEvidenceMapping,
  mapEvidenceToPathways,
} from "@/lib/evidence/pathway-mapper";
import { formatClaimSummary } from "@/lib/engine/export";
import {
  pathwayRecordChecklistStorageKey,
  secondaryWorkflowLocalStorageKeys,
} from "@/lib/secondary-workflow/local-state";

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function excerpt(overrides: Partial<EvidenceExcerpt>): EvidenceExcerpt {
  return {
    sourceName: "Treatment Records",
    locator: "line 4",
    quote: "Clinician statement",
    category: "diagnosis",
    strength: "supporting",
    clinicianAuthored: true,
    matchedTerms: [],
    ...overrides,
  };
}

function analysis(excerpts: EvidenceExcerpt[]): EvidenceAnalysis {
  return {
    version: 1,
    sourceName: excerpts[0]?.sourceName ?? "Records",
    excerpts,
    nexusRelevantCount: excerpts.filter((e) => e.strength === "nexus-relevant").length,
    supportingCount: excerpts.filter((e) => e.strength === "supporting").length,
  };
}

const evidentiaryProfile: EvidentiaryProfile = {
  etiologicalConsensus: "PROBABLE",
  vaNexusProbabilityAlignment: "AT_LEAST_AS_LIKELY_AS_NOT",
  conservativeRationale:
    "Authored conservative rationale describing the basis for the nexus claim in medically conservative terms.",
  evidenceGaps: "Authored evidence gaps sentence.",
  alternativeEtiologiesToRuleOut: ["Alternative etiology one"],
  requiresSpecificDbqEvidence: false,
};

function recommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    conditionId: "sleep-apnea",
    condition: "Sleep Apnea",
    bodySystem: "Respiratory",
    etiologicalConsensus: "PROBABLE",
    score: 2,
    contributingPrimaries: [
      {
        id: "ptsd",
        name: "Posttraumatic Stress Disorder",
        rank: 1,
        rationale: "Authored rationale.",
        nexusClaim: {
          nexusClassification: "AGGRAVATION",
          baselineProgression:
            "Authored baseline progression description of the natural non-service-connected course of the condition.",
          aggravatingFactor:
            "Authored aggravating factor description of how the service-connected condition worsens the condition.",
        },
        causalMechanism: {
          mechanismCategory: "PSYCHOPHYSIOLOGICAL",
          primaryVector:
            "Authored primary vector describing the psychophysiological cascade between the conditions.",
          hypothesizedOnly: false,
        },
        evidentiaryProfile,
      },
    ],
    evidenceGaps: ["Baseline severity records", "Nexus opinion"],
    sourceReferences: [],
    matchedIntakeContext: [],
    ...overrides,
  };
}

const results = (recommendations: (Recommendation | null)[]): NonServiceConnectedConditionResult[] =>
  recommendations.map((rec, index) => ({
    conditionId: rec?.conditionId ?? `unmapped-${index}`,
    conditionName: rec?.condition ?? "Unmapped Condition",
    bodySystem: "Respiratory",
    recommendation: rec,
  }));

const catalogEntry: CatalogCondition = {
  id: "sleep-apnea",
  name: "Sleep Apnea",
  aliases: ["sleep apnea"],
  bodySystem: "Respiratory",
  ratingSchedule: [],
  reviewNotes: [],
};

const catalogById = new Map([[catalogEntry.id, catalogEntry]]);

describe("secondary research aids — shared-fixture integration", () => {
  it("one fixture flows through every Step 5/6 aid builder", () => {
    const fixture = results([recommendation()]);

    const plan = buildActionPlan(fixture);
    expect(plan).toHaveLength(1);
    expect(plan[0].conditionId).toBe("sleep-apnea");
    expect(plan[0].rank).toBe(1);

    const comparison = buildComparisonRows(fixture, ["sleep-apnea"], catalogById);
    expect(comparison).toHaveLength(1);
    expect(comparison[0].evidenceGapCount).toBe(2);

    const insights = analyzeCombinationInsights(fixture);
    expect(insights).toHaveLength(0);

    const rating = buildRatingGuide(fixture, catalogById);
    expect(rating).toHaveLength(1);
    expect(rating[0].ratingSchedule).toEqual([]);

    const checklist = buildPathwayRecordChecklist(fixture);
    expect(checklist).toHaveLength(1);
    expect(checklist[0].pathways.length).toBeGreaterThanOrEqual(1);

    const medical = buildMedicalRecordChecklist(fixture);
    expect(medical).toHaveLength(1);
    expect(medical[0].items.length).toBe(2);
  });

  it("every aid export renders from the same fixture with its boundary copy intact", () => {
    const fixture = results([recommendation()]);
    const analyses = [
      analysis([
        excerpt({
          category: "aggravation",
          strength: "nexus-relevant",
          clinicianAuthored: true,
          matchedTerms: ["ptsd"],
          quote: "PTSD symptoms worsened the sleep disturbance beyond its natural progression.",
        }),
      ]),
    ];

    const claimSummary = formatClaimSummary(recommendation().contributingPrimaries ? [recommendation()] : [], []);
    const pathwayRows = mapEvidenceToPathways(fixture, analyses);
    const mappingText = formatPathwayEvidenceMapping(pathwayRows);
    const checklistText = formatPathwayRecordChecklist(buildPathwayRecordChecklist(fixture));
    const medicalText = formatMedicalRecordChecklist(buildMedicalRecordChecklist(fixture));
    const ratingText = formatRatingGuide(buildRatingGuide(fixture, catalogById));
    const planText = formatActionPlan(buildActionPlan(fixture));
    const comparisonText = formatConditionComparison(
      buildComparisonRows(fixture, ["sleep-apnea"], catalogById),
    );
    const insightsText = formatCombinationInsights(analyzeCombinationInsights(fixture));
    expect(insightsText.toLowerCase()).toContain("disclaimer: combination analysis is informational");

    for (const text of [checklistText, medicalText, ratingText, planText, comparisonText, mappingText]) {
      expect(text.length).toBeGreaterThan(0);
    }
    expect(claimSummary).toContain("SECONDARY CLAIM RESEARCH & EVIDENCE CHECKLIST");
    expect(mappingText).toContain("Aggravation");
    expect(checklistText).toContain("Sleep Apnea");
    expect(planText).toContain("not VA guidance");
    expect(ratingText).toContain("not a VA rating determination");
  });

  it("combined exports join summaries without inventing content and keep research-cue boundaries", () => {
    const fixture = results([recommendation()]);
    const summaryText = formatClaimSummary([recommendation()], []);
    const checklistText = formatPathwayRecordChecklist(buildPathwayRecordChecklist(fixture));
    const combinedChecklist = combineChecklistWithSummary(checklistText, summaryText);
    expect(combinedChecklist).toContain(checklistText);
    expect(combinedChecklist).toContain("SECONDARY CLAIM RESEARCH & EVIDENCE CHECKLIST");

    const pathwayRows = mapEvidenceToPathways(
      fixture,
      [
        analysis([
          excerpt({
            category: "aggravation",
            strength: "nexus-relevant",
            clinicianAuthored: false,
          }),
        ]),
      ],
    );
    const mappingText = formatPathwayEvidenceMapping(pathwayRows);
    const combinedMapping = combineMappingWithClaimSummary(mappingText, summaryText);
    expect(combinedMapping).toContain(mappingText);
    expect(combinedMapping).toContain(summaryText);
    expect(combinedMapping.toLowerCase()).not.toContain("you qualify for");
  });

  it("the plan renders four steps per entry and the action-card print scope is wired", () => {
    const entries = buildActionPlan(results([recommendation()]));
    const steps = actionPlanSteps(entries[0]);
    expect(steps).toHaveLength(4);

    const css = readRepoFile("src/app/globals.css");
    expect(css).toContain("body.print-action-card main > *:not(.print-action-plan-scope)");
    expect(css).toContain("research-generated, not VA guidance");
    const actionPlan = readRepoFile("src/components/secondary/ActionPlan.tsx");
    expect(actionPlan).toContain('printScopeClass="print-action-card"');
    expect(actionPlan).toContain("print-action-plan-scope");
  });

  it("browser-local store registry includes OCR and preferences in the tab-scoped boundary", () => {
    expect(secondaryWorkflowLocalStorageKeys).toEqual([
      expect.stringContaining("evidence-analysis"),
      expect.stringContaining("evidence-gap-review"),
      pathwayRecordChecklistStorageKey,
      expect.stringContaining("va-gov-record-walkthrough"),
      expect.stringContaining("ocr-checkpoint"),
      expect.stringContaining("evidence-depth"),
    ]);
    const page = readRepoFile("src/app/secondary/evidence/page.tsx");
    expect(page).toContain("PathwayEvidenceMapper");
    expect(page).toContain("PathwayRecordChecklist");
    expect(page).toContain("LocalEvidenceReview");
    const localState = readRepoFile("src/lib/secondary-workflow/local-state.ts");
    expect(localState).toContain("evidenceAnalysisStorageKey");
    expect(localState).toContain("evidenceGapReviewStorageKey");
    expect(localState).toContain("pathwayRecordChecklistStorageKey");
    const completion = readRepoFile("src/components/secondary/SecondaryWorkflowCompletionActions.tsx");
    expect(completion).toContain("clearSecondaryWorkflowLocalState");
  });

  it("no aid module performs egress: source scan for network primitives", () => {
    const modules = [
      "src/lib/secondary-workflow/action-plan.ts",
      "src/lib/secondary-workflow/condition-comparison.ts",
      "src/lib/secondary-workflow/combination-insights.ts",
      "src/lib/secondary-workflow/pathway-record-checklist.ts",
      "src/lib/secondary-workflow/rating-guide.ts",
      "src/lib/secondary-workflow/medical-record-checklist.ts",
      "src/lib/evidence/pathway-mapper.ts",
    ];
    for (const file of modules) {
      const source = readRepoFile(file);
      expect(source, file).not.toMatch(/\bfetch\s*\(/);
      expect(source, file).not.toMatch(/\bXMLHttpRequest\b/);
      expect(source, file).not.toMatch(/\bsendBeacon\b/);
      expect(source, file).not.toMatch(/\bWebSocket\b/);
    }
  });
});
