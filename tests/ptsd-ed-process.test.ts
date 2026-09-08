/**
 * 100-case harness: does the app follow the same process when determining its
 * "opinion" for a specific scenario?
 *
 * Scenario under test:
 *   - Service-connected primary:  PTSD (catalog id "ptsd")
 *   - Non-service-connected:      Erectile Dysfunction (catalog id "erectile-dysfunction")
 *
 * Built against the current mainline schema: etiological consensus replaces
 * prevalence, and each edge carries a nexus claim, causal mechanism, and
 * evidentiary profile. The harness verifies that the engine renders the same
 * ED opinion across:
 *   A. Determinism: 25 identical runs produce byte-identical output.
 *   B. Canonical opinion contract for PTSD -> ED (20 assertions).
 *   C. Spelling/format variants of the PTSD input resolve to the same opinion (16).
 *   D. Unrecognized inputs are consistently refused (4).
 *   E. Exclusion and merge rules (15).
 *   F. Workflow-path integration, using the same calls the pages make (10).
 *   G. File-evaluation process for PTSD -> ED (10).
 */
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { evaluateEvidence } from "@/lib/engine/evaluation";
import { processEvidenceFiles } from "@/lib/engine/ingestion";
import { recommend } from "@/lib/engine/recommend";
import type { Recommendation } from "@/lib/engine/types";
import { intakeSchema, type Intake } from "@/lib/engine/types";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { buildSecondaryRecommendationIntake } from "@/lib/secondary-workflow/recommendation-intake";
import { buildNonServiceConnectedConditionResults } from "@/lib/secondary-workflow/suggestions";
import {
  parseDiagnosedSelection,
  parseRatingsSelection,
  parseServiceConnectedSelection,
  parseWorkflowState,
  ratingFieldName,
} from "@/lib/secondary-workflow/state";

const catalog = loadConditionCatalog();
const kb = loadKnowledgeBase();

const PTSD_ID = "ptsd";
const ED_ID = "erectile-dysfunction";
const PTSD_NAME = "Post-Traumatic Stress Disorder (PTSD)";
const ED_NAME = "Erectile Dysfunction";

function intake(partial: Partial<Intake> & Pick<Intake, "primaryConditions">): Intake {
  return intakeSchema.parse(partial);
}

/** Engine-only run: no diagnosed boundary, no intake context. */
function runEngine(primaryConditions: string[]): ReturnType<typeof recommend> {
  return recommend(catalog, kb, intake({ primaryConditions }));
}

/** The ED recommendation produced by a fresh PTSD run, or null. */
function edRecommendation(primaryConditions: string[] = [PTSD_ID]): Recommendation | null {
  const { recommendations } = runEngine(primaryConditions);
  return recommendations.find((r) => r.conditionId === ED_ID) ?? null;
}

describe("A. Determinism: the PTSD -> ED opinion is identical across 25 runs", () => {
  const canonical = runEngine([PTSD_ID]);
  const runs = Array.from({ length: 25 }, () => runEngine([PTSD_ID]));

  runs.forEach((result, index) => {
    it(`run ${index + 1} produces byte-identical output to run 1`, () => {
      expect(result).toEqual(canonical);
    });
  });
});

describe("B. Canonical opinion contract for PTSD -> ED", () => {
  const ed = edRecommendation();

  it("1. ED is present in the recommendations", () => {
    expect(ed).not.toBeNull();
  });

  it("2. ED recommendation uses catalog id erectile-dysfunction", () => {
    expect(ed?.conditionId).toBe(ED_ID);
  });

  it("3. ED display name comes from the catalog, not the mapping file", () => {
    expect(ed?.condition).toBe(ED_NAME);
  });

  it("4. ED body system is carried from the catalog", () => {
    expect(ed?.bodySystem).toBe("Genitourinary & Gynecological Systems");
  });

  it("5. ED etiological consensus is IATROGENIC_TREATMENT_EFFECT", () => {
    expect(ed?.etiologicalConsensus).toBe("IATROGENIC_TREATMENT_EFFECT");
  });

  it("6. ED score is exactly 1/rank = 0.3333", () => {
    expect(ed?.score).toBe(0.3333);
  });

  it("7. ED is contributed by exactly one primary", () => {
    expect(ed?.contributingPrimaries).toHaveLength(1);
  });

  it("8. The contributing primary id is ptsd", () => {
    expect(ed?.contributingPrimaries[0].id).toBe(PTSD_ID);
  });

  it("9. The contributing primary display name is the full PTSD name", () => {
    expect(ed?.contributingPrimaries[0].name).toBe(PTSD_NAME);
  });

  it("10. The contributing primary rank is 3", () => {
    expect(ed?.contributingPrimaries[0].rank).toBe(3);
  });

  it("11. The rationale names the SSRI medication-aggravation theory", () => {
    expect(ed?.contributingPrimaries[0].rationale.toLowerCase()).toContain("ssri");
  });

  it("12. The nexus claim is classified AGGRAVATION, not DIRECT_CAUSATION", () => {
    expect(ed?.contributingPrimaries[0].nexusClaim?.nexusClassification).toBe(
      "AGGRAVATION",
    );
  });

  it("13. The causal mechanism is PHARMACOLOGICAL_IATROGENIC and not hypothesized-only", () => {
    expect(ed?.contributingPrimaries[0].causalMechanism?.mechanismCategory).toBe(
      "PHARMACOLOGICAL_IATROGENIC",
    );
    expect(ed?.contributingPrimaries[0].causalMechanism?.hypothesizedOnly).toBe(false);
  });

  it("14. Pathway intelligence lists the medication-related pathway", () => {
    expect(ed?.contributingPrimaries[0].pathwayIntelligence?.pathways).toContain(
      "medication-related",
    );
  });

  it("15. Evidence gap 1: SSRI exposure and timing prescription records", () => {
    expect(ed?.evidenceGaps).toContain(
      "Prescription records showing the relevant SSRI exposure and timing",
    );
  });

  it("16. Evidence gap 2: urology or primary care diagnosis of ED", () => {
    expect(ed?.evidenceGaps).toContain(
      "Urology or primary care diagnosis of erectile dysfunction",
    );
  });

  it("17. The source reference cites the Corona 2009 SSRI study by PMID", () => {
    expect(
      ed?.sourceReferences.some((ref) => ref.citation.includes("PMID 19473282")),
    ).toBe(true);
  });

  it("18. Every source reference is verified with a source URL", () => {
    expect(ed?.sourceReferences.every((ref) => ref.verified === true)).toBe(true);
    expect(
      ed?.sourceReferences.every(
        (ref) => typeof ref.sourceUrl === "string" && ref.sourceUrl.length > 0,
      ),
    ).toBe(true);
  });

  it("19. No intake-context terms are matched for an empty intake", () => {
    expect(ed?.matchedIntakeContext).toEqual([]);
  });

  it("20. PTSD suggestions keep the authored order: sleep apnea, migraine, ED", () => {
    const { recommendations } = runEngine([PTSD_ID]);
    expect(recommendations.slice(0, 3).map((r) => r.conditionId)).toEqual([
      "sleep-apnea",
      "migraine-headaches",
      ED_ID,
    ]);
  });
});

describe("C. Spelling and format variants of the PTSD input resolve to the same opinion", () => {
  const variants = [
    "PTSD",
    "ptsd",
    "Ptsd",
    "pTsD",
    " PTSD ",
    "  PTSD  ",
    "ptsd ",
    "ptsd\t",
    "PTSD\n",
    "Post-Traumatic Stress Disorder (PTSD)",
    "post-traumatic stress disorder",
    "POST-TRAUMATIC STRESS DISORDER",
    "post-traumatic stress disorder (ptsd)",
    "  post-traumatic   stress   disorder  ",
    "Post-Traumatic Stress Disorder (PTSd)",
    "Post Traumatic Stress Disorder",
  ];

  variants.forEach((variant, index) => {
    it(`variant ${index + 1}: "${JSON.stringify(variant)}" yields the identical ED opinion`, () => {
      const ed = edRecommendation([variant]);
      expect(ed).not.toBeNull();
      expect(ed?.conditionId).toBe(ED_ID);
      expect(ed?.score).toBe(0.3333);
      expect(ed?.contributingPrimaries[0].rank).toBe(3);
      expect(ed?.contributingPrimaries[0].id).toBe(PTSD_ID);
      expect(ed?.etiologicalConsensus).toBe("IATROGENIC_TREATMENT_EFFECT");
    });
  });
});

describe("D. Unrecognized inputs are consistently refused, not guessed", () => {
  const variants = [
    "P.T.S.D.",
    "posttraumaticstressdisorder",
    "PTSD, ED",
    "PostTraumaticStressDisorder",
  ];

  variants.forEach((variant, index) => {
    it(`variant ${index + 1}: "${variant}" is reported unrecognized with no ED opinion`, () => {
      const result = runEngine([variant]);
      expect(result.recognizedPrimaries).toEqual([]);
      expect(result.unrecognizedPrimaries).toEqual([variant]);
      expect(result.recommendations.map((r) => r.conditionId)).not.toContain(ED_ID);
    });
  });
});

describe("E. Exclusion and merge rules", () => {
  it("1. ED is not suggested when PTSD is not service connected", () => {
    const ed = edRecommendation(["tinnitus"]);
    expect(ed).toBeNull();
  });

  it("2. ED is not suggested when ED is itself service connected", () => {
    const { recommendations } = runEngine([PTSD_ID, ED_ID]);
    expect(recommendations.map((r) => r.conditionId)).not.toContain(ED_ID);
    expect(recommendations.map((r) => r.conditionId)).toContain("sleep-apnea");
  });

  it("3. Focus filter: with diagnosed=[ED], only ED survives", () => {
    const result = recommend(
      catalog,
      kb,
      intake({
        primaryConditions: [PTSD_ID],
        diagnosedConditionIds: [ED_ID],
      }),
    );
    expect(result.recommendations.map((r) => r.conditionId)).toEqual([ED_ID]);
  });

  it("4. Focus filter: with diagnosed=[Migraine Headaches], ED is dropped", () => {
    const result = recommend(
      catalog,
      kb,
      intake({
        primaryConditions: [PTSD_ID],
        diagnosedConditionIds: ["migraine-headaches"],
      }),
    );
    expect(result.recommendations.map((r) => r.conditionId)).toEqual([
      "migraine-headaches",
    ]);
  });

  it("5. Repeated PTSD inputs dedupe to one recognized primary and one ED suggestion", () => {
    const result = runEngine(["PTSD", "ptsd", " PTSD "]);
    expect(result.recognizedPrimaries).toEqual([PTSD_NAME]);
    const edCount = result.recommendations.filter((r) => r.conditionId === ED_ID).length;
    expect(edCount).toBe(1);
  });

  it("6. PTSD + depressive disorder merge: ED score 0.3333 + 0.5 = 0.8333", () => {
    const ed = edRecommendation([PTSD_ID, "depressive-disorder"]);
    expect(ed?.score).toBe(0.8333);
    expect(ed?.contributingPrimaries.map((p) => p.rank).sort()).toEqual([2, 3]);
  });

  it("7. PTSD + hypogonadism merge: ED score 0.3333 + 0.5 = 0.8333", () => {
    const ed = edRecommendation([PTSD_ID, "hypogonadism"]);
    expect(ed?.score).toBe(0.8333);
    expect(ed?.contributingPrimaries).toHaveLength(2);
  });

  it("8. PTSD + hypertension merge: ED score 0.3333 + 0.25 = 0.5833", () => {
    const ed = edRecommendation([PTSD_ID, "hypertension"]);
    expect(ed?.score).toBe(0.5833);
    expect(ed?.contributingPrimaries.map((p) => p.rank).sort()).toEqual([3, 4]);
  });

  it("9. PTSD + hypogonadism + depressive disorder: ED score 0.3333 + 0.5 + 0.5 = 1.3333", () => {
    const ed = edRecommendation([PTSD_ID, "hypogonadism", "depressive-disorder"]);
    expect(ed?.score).toBe(1.3333);
    expect(ed?.contributingPrimaries).toHaveLength(3);
  });

  it("10. A condition absent from the catalog yields no opinion at all", () => {
    const result = runEngine(["Unknown condition"]);
    expect(result.recommendations).toEqual([]);
    expect(result.unrecognizedPrimaries).toEqual(["Unknown condition"]);
  });

  it("11. Zero primary conditions is rejected by the intake schema", () => {
    expect(() => intake({ primaryConditions: [] })).toThrow();
  });

  it("12. Depressive disorder alone produces a DIFFERENT ED opinion (rank 2, 0.5)", () => {
    const ed = edRecommendation(["depressive-disorder"]);
    expect(ed?.score).toBe(0.5);
    expect(ed?.contributingPrimaries[0].rank).toBe(2);
    expect(ed?.contributingPrimaries[0].id).toBe("depressive-disorder");
  });

  it("13. Hypogonadism alone produces ED at rank 2 with NOT_ESTABLISHED consensus", () => {
    const ed = edRecommendation(["hypogonadism"]);
    expect(ed?.score).toBe(0.5);
    expect(ed?.contributingPrimaries[0].rank).toBe(2);
    expect(ed?.etiologicalConsensus).toBe("NOT_ESTABLISHED");
  });

  it("14. Hypertension alone produces ED at rank 4, NOT_ESTABLISHED, 0.25", () => {
    const ed = edRecommendation(["hypertension"]);
    expect(ed?.score).toBe(0.25);
    expect(ed?.etiologicalConsensus).toBe("NOT_ESTABLISHED");
    expect(ed?.contributingPrimaries[0].rank).toBe(4);
  });

  it("15. ED as the only primary is recognized and mapped, but never suggests itself", () => {
    const result = runEngine([ED_NAME]);
    expect(result.recognizedPrimaries).toEqual([ED_NAME]);
    expect(result.unmappedPrimaries).toEqual([]);
    expect(result.recommendations.map((r) => r.conditionId)).not.toContain(ED_ID);
    expect(result.recommendations.map((r) => r.conditionId)).toContain(
      "depressive-disorder",
    );
  });
});

describe("F. Workflow-path integration (same calls the wizard pages make)", () => {
  it("1. parseWorkflowState carries PTSD as the service-connected primary", () => {
    const state = parseWorkflowState(
      {
        diagnosed: [PTSD_ID, ED_ID],
        serviceConnected: [PTSD_ID],
        "rating-ptsd": "70",
        documentsShared: "no",
      },
      catalog,
    );
    expect(state.diagnosedConditionIds).toEqual([PTSD_ID, ED_ID]);
    expect(state.serviceConnectedConditionIds).toEqual([PTSD_ID]);
    expect(state.ratingsByConditionId[PTSD_ID]).toBe(70);
    expect(state.documentsShared).toBe(false);
  });

  it("2. documentsShared=yes parses to true in workflow state", () => {
    const state = parseWorkflowState(
      {
        diagnosed: [PTSD_ID],
        serviceConnected: [PTSD_ID],
        "rating-ptsd": "70",
        documentsShared: "yes",
      },
      catalog,
    );
    expect(state.documentsShared).toBe(true);
  });

  it("3. buildSecondaryRecommendationIntake maps the state to the engine boundary", () => {
    const state = parseWorkflowState(
      {
        diagnosed: [PTSD_ID, ED_ID],
        serviceConnected: [PTSD_ID],
        "rating-ptsd": "70",
        documentsShared: "no",
      },
      catalog,
    );
    const intakeValue = buildSecondaryRecommendationIntake(state);
    expect(intakeValue.diagnosedConditionIds).toEqual([PTSD_ID, ED_ID]);
    expect(intakeValue.primaryConditions).toEqual([PTSD_ID]);
  });

  it("4. The exact suggestions-page engine call still surfaces ED", () => {
    const state = parseWorkflowState(
      {
        diagnosed: [PTSD_ID, ED_ID],
        serviceConnected: [PTSD_ID],
        "rating-ptsd": "70",
        documentsShared: "no",
      },
      catalog,
    );
    const result = recommend(catalog, kb, buildSecondaryRecommendationIntake(state));
    expect(result.recommendations.map((r) => r.conditionId)).toContain(ED_ID);
  });

  it("5. buildNonServiceConnectedConditionResults surfaces ED under the non-SC diagnosis", () => {
    const state = parseWorkflowState(
      {
        diagnosed: [PTSD_ID, ED_ID],
        serviceConnected: [PTSD_ID],
        "rating-ptsd": "70",
        documentsShared: "no",
      },
      catalog,
    );
    const result = recommend(catalog, kb, buildSecondaryRecommendationIntake(state));
    const rows = buildNonServiceConnectedConditionResults(
      catalog,
      state.diagnosedConditionIds,
      state.serviceConnectedConditionIds,
      result.recommendations,
    );
    const edRow = rows.find((row) => row.conditionId === ED_ID);
    expect(edRow).toBeDefined();
    expect(edRow?.recommendation?.contributingPrimaries.map((p) => p.id)).toContain(
      PTSD_ID,
    );
  });

  it("6. A diagnosed non-SC condition without a relationship still appears, with null recommendation", () => {
    const state = parseWorkflowState(
      {
        diagnosed: [PTSD_ID, ED_ID, "tinnitus"],
        serviceConnected: [PTSD_ID],
        "rating-ptsd": "70",
        documentsShared: "no",
      },
      catalog,
    );
    const result = recommend(catalog, kb, buildSecondaryRecommendationIntake(state));
    const rows = buildNonServiceConnectedConditionResults(
      catalog,
      state.diagnosedConditionIds,
      state.serviceConnectedConditionIds,
      result.recommendations,
    );
    const tinnitusRow = rows.find((row) => row.conditionId === "tinnitus");
    expect(tinnitusRow).toBeDefined();
    expect(tinnitusRow?.recommendation).toBeNull();
  });

  it("7. Ratings outside 0-100 are rejected by parseRatingsSelection", () => {
    expect(() =>
      parseRatingsSelection(
        {
          diagnosed: [PTSD_ID],
          serviceConnected: [PTSD_ID],
          "rating-ptsd": "120",
        },
        catalog,
      ),
    ).toThrow();
  });

  it("8. parseServiceConnectedSelection rejects a primary not in the diagnosed list", () => {
    expect(() =>
      parseServiceConnectedSelection(
        {
          diagnosed: [ED_ID],
          serviceConnected: [PTSD_ID],
        },
        catalog,
      ),
    ).toThrow();
  });

  it("9. parseDiagnosedSelection requires at least one diagnosed condition", () => {
    expect(() => parseDiagnosedSelection({}, catalog)).toThrow();
  });

  it("10. ratingFieldName generates the rating query key used by the wizard", () => {
    expect(ratingFieldName(PTSD_ID)).toBe("rating-ptsd");
  });
});

describe("G. File-evaluation process for PTSD -> ED", () => {
  function edWithIndicators(indicators: string[]) {
    const rec = edRecommendation();
    if (!rec) throw new Error("ED recommendation missing");
    return evaluateEvidence([rec], indicators)[0];
  }

  it("1. With no file indicators, all three ED evidence gaps remain open", () => {
    const evaluation = edWithIndicators([]);
    expect(evaluation.satisfiedGaps).toEqual([]);
    expect(evaluation.remainingGaps).toHaveLength(3);
  });

  it("2. A current-diagnosis indicator satisfies the diagnosis gap", () => {
    const evaluation = edWithIndicators(["current-diagnosis"]);
    expect(evaluation.satisfiedGaps).toContain(
      "Urology or primary care diagnosis of erectile dysfunction",
    );
  });

  it("3. A medical-records indicator satisfies the SSRI records gap", () => {
    const evaluation = edWithIndicators(["medical-records"]);
    expect(evaluation.satisfiedGaps).toContain(
      "Prescription records showing the relevant SSRI exposure and timing",
    );
  });

  it("4. A medical-opinion indicator satisfies the aggravation-opinion gap", () => {
    const evaluation = edWithIndicators(["medical-opinion"]);
    expect(evaluation.satisfiedGaps).toContain(
      "Medical opinion addressing medication exposure, SSRI-related sexual side effects, alternative causes, and aggravation beyond the established baseline",
    );
  });

  it("5. A nexus-letter indicator also satisfies the aggravation-opinion gap", () => {
    const evaluation = edWithIndicators(["nexus-letter"]);
    expect(evaluation.satisfiedGaps).toHaveLength(1);
  });

  it("6. All three semantic indicators satisfy every ED gap", () => {
    const evaluation = edWithIndicators([
      "current-diagnosis",
      "medical-records",
      "medical-opinion",
    ]);
    expect(evaluation.satisfiedGaps).toHaveLength(3);
    expect(evaluation.remainingGaps).toEqual([]);
  });

  it("7. A format-pdf indicator satisfies nothing (formats are decoupled from semantics)", () => {
    const evaluation = edWithIndicators(["format-pdf"]);
    expect(evaluation.satisfiedGaps).toEqual([]);
    expect(evaluation.remainingGaps).toHaveLength(3);
  });

  it("8. processEvidenceFiles derives only format-pdf from a single ED record file", () => {
    const result = processEvidenceFiles(["ed_records.pdf"]);
    expect(result.success).toBe(true);
    expect(result.fileCount).toBe(1);
    expect(result.derivedIndicators).toEqual(["format-pdf"]);
  });

  it("9. Filename PII never leaks into derived indicators", () => {
    const result = processEvidenceFiles(["smith_ssn_1234_ptsd_records.pdf"]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("smith");
    expect(serialized).not.toContain("1234");
    expect(result.derivedIndicators).toEqual(["format-pdf"]);
  });

  it("10. Malformed ingestion input fails safely with an error message", () => {
    // @ts-expect-error testing the invalid-input boundary
    const result = processEvidenceFiles(null);
    expect(result.success).toBe(false);
    expect(result.fileCount).toBe(0);
    expect(result.error).toBeDefined();
  });
});