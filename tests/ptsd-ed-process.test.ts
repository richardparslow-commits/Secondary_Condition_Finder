/**
 * 100-case harness: does the app follow the same process when determining its
 * "opinion" for a specific scenario?
 *
 * Scenario under test:
 *   - Service-connected primary:  PTSD (catalog id "ptsd")
 *   - Non-service-connected:      Erectile Dysfunction (catalog id "erectile-dysfunction")
 *
 * The app's opinion pipeline is:
 *   1. Resolve the service-connected primary through the catalog (exact match).
 *   2. Look up its published knowledge-base mapping (data/knowledge-base/ptsd.json).
 *   3. Score each authored suggestion as 1/rank and emit the recommendation.
 *   4. Apply exclusions (already-service-connected) and the optional
 *      diagnosed-only focus filter.
 *   5. Surface through the workflow state and grouping helpers exactly as the
 *      wizard pages call them.
 *   6. Optionally correlate file-format indicators against evidence gaps.
 *
 * The 100 cases are organized into seven groups:
 *   A. Determinism: 25 identical runs must produce byte-identical opinions.
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
import { groupSuggestionsByPrimary } from "@/lib/secondary-workflow/suggestions";
import {
  parseDiagnosedSelection,
  parseRatingsSelection,
  parseServiceConnectedSelection,
  parseWorkflowState,
  ratingFieldName,
  workflowStateToSearchParams,
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

/** Runs the engine exactly as the suggestions/evidence pages do. */
function runEngine(primaryConditions: string[]): ReturnType<typeof recommend> {
  return recommend(catalog, kb, {
    primaryConditions,
    symptoms: [],
    medications: [],
    exposures: [],
    notes: "",
  });
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

  it("5. ED prevalence band is sometimes-explored (qualitative, never a percentage)", () => {
    expect(ed?.prevalence).toBe("sometimes-explored");
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

  it("11. The rationale names the medication side-effect theory (SSRI)", () => {
    expect(ed?.contributingPrimaries[0].rationale.toLowerCase()).toContain("ssri");
  });

  it("12. Evidence gap 1: prescription records showing SSRI usage", () => {
    expect(ed?.evidenceGaps).toContain("Prescription records showing SSRI usage");
  });

  it("13. Evidence gap 2: urology or primary care diagnosis of ED", () => {
    expect(ed?.evidenceGaps).toContain("Urology or primary care diagnosis of ED");
  });

  it("14. The citation is 38 CFR 3.310 (secondary service connection)", () => {
    expect(ed?.sourceReferences.some((ref) => ref.citation === "38 CFR 3.310")).toBe(true);
  });

  it("15. The citation note explains medication side effects", () => {
    expect(
      ed?.sourceReferences.some((ref) =>
        ref.note.toLowerCase().includes("medication side effects"),
      ),
    ).toBe(true);
  });

  it("16. Every source reference ships verified: false", () => {
    expect(ed?.sourceReferences.every((ref) => ref.verified === false)).toBe(true);
  });

  it("17. No intake-context terms are matched for an empty intake", () => {
    expect(ed?.matchedIntakeContext).toEqual([]);
  });

  it("18. PTSD suggestions keep the authored order: sleep apnea, migraine, ED", () => {
    const { recommendations } = runEngine([PTSD_ID]);
    expect(recommendations.map((r) => r.conditionId)).toEqual([
      "sleep-apnea",
      "migraine-headaches",
      ED_ID,
    ]);
  });

  it("19. Scores sort strictly descending (1.0, 0.5, 0.3333)", () => {
    const { recommendations } = runEngine([PTSD_ID]);
    expect(recommendations.map((r) => r.score)).toEqual([1, 0.5, 0.3333]);
  });

  it("20. PTSD is recognized and neither unmapped nor unrecognized", () => {
    const result = runEngine([PTSD_ID]);
    expect(result.recognizedPrimaries).toEqual([PTSD_NAME]);
    expect(result.unmappedPrimaries).toEqual([]);
    expect(result.unrecognizedPrimaries).toEqual([]);
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
      expect(ed?.prevalence).toBe("sometimes-explored");
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
    const ed = edRecommendation(["knee-injury"]);
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
      intake({ primaryConditions: [PTSD_ID], diagnosedConditions: [ED_NAME] }),
    );
    expect(result.recommendations.map((r) => r.conditionId)).toEqual([ED_ID]);
  });

  it("4. Focus filter: with diagnosed=[Migraine Headaches], ED is dropped", () => {
    const result = recommend(
      catalog,
      kb,
      intake({
        primaryConditions: [PTSD_ID],
        diagnosedConditions: ["Migraine Headaches"],
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

  it("13. Hypogonadism alone produces ED at rank 2 with score 0.5", () => {
    const ed = edRecommendation(["hypogonadism"]);
    expect(ed?.score).toBe(0.5);
    expect(ed?.contributingPrimaries[0].rank).toBe(2);
  });

  it("14. Hypertension alone produces ED at rank 4, occasionally-explored, 0.25", () => {
    const ed = edRecommendation(["hypertension"]);
    expect(ed?.score).toBe(0.25);
    expect(ed?.prevalence).toBe("occasionally-explored");
    expect(ed?.contributingPrimaries[0].rank).toBe(4);
  });

  it("15. ED as the only primary is recognized and mapped, but never suggests itself", () => {
    const result = runEngine([ED_NAME]);
    expect(result.recognizedPrimaries).toEqual([ED_NAME]);
    expect(result.unmappedPrimaries).toEqual([]);
    expect(result.recommendations.map((r) => r.conditionId)).not.toContain(ED_ID);
    // ED's own published mapping points outward (depressive disorder, GERD).
    expect(result.recommendations.map((r) => r.conditionId)).toEqual([
      "depressive-disorder",
      "gerd",
    ]);
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

  it("3. The exact suggestions-page engine call still surfaces ED", () => {
    const state = parseWorkflowState(
      {
        diagnosed: [PTSD_ID, ED_ID],
        serviceConnected: [PTSD_ID],
        "rating-ptsd": "70",
        documentsShared: "no",
      },
      catalog,
    );
    const result = recommend(catalog, kb, {
      primaryConditions: state.serviceConnectedConditionIds,
      symptoms: [],
      medications: [],
      exposures: [],
      notes: "",
    });
    expect(result.recommendations.map((r) => r.conditionId)).toContain(ED_ID);
  });

  it("4. groupSuggestionsByPrimary nests ED under the PTSD primary group", () => {
    const { recommendations } = runEngine([PTSD_ID]);
    const grouped = groupSuggestionsByPrimary(catalog, [PTSD_ID], recommendations);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].primaryName).toBe(PTSD_NAME);
    expect(grouped[0].recommendations.map((r) => r.conditionId)).toContain(ED_ID);
  });

  it("5. Without PTSD, no group contains ED", () => {
    const { recommendations } = runEngine(["knee-injury"]);
    const grouped = groupSuggestionsByPrimary(catalog, ["knee-injury"], recommendations);
    const allIds = grouped.flatMap((g) => g.recommendations.map((r) => r.conditionId));
    expect(allIds).not.toContain(ED_ID);
  });

  it("6. workflowStateToSearchParams round-trips through parseWorkflowState", () => {
    const state = parseWorkflowState(
      {
        diagnosed: [PTSD_ID, ED_ID],
        serviceConnected: [PTSD_ID],
        "rating-ptsd": "70",
        documentsShared: "no",
      },
      catalog,
    );
    const params = workflowStateToSearchParams(state);
    // Group duplicate query keys back into arrays (Object.fromEntries would
    // collapse them, which is not how the pages receive searchParams).
    const queryParams: Record<string, string | string[]> = {};
    for (const key of new Set(params.keys())) {
      const values = params.getAll(key);
      queryParams[key] = values.length === 1 ? values[0] : values;
    }
    const roundTrip = parseWorkflowState(queryParams, catalog);
    expect(roundTrip).toEqual(state);
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

  it("1. With no file indicators, both ED evidence gaps remain open", () => {
    const evaluation = edWithIndicators([]);
    expect(evaluation.satisfiedGaps).toEqual([]);
    expect(evaluation.remainingGaps).toEqual([
      "Prescription records showing SSRI usage",
      "Urology or primary care diagnosis of ED",
    ]);
  });

  it("2. A PDF indicator satisfies the diagnosis gap via keyword match", () => {
    const evaluation = edWithIndicators(["format-pdf"]);
    expect(evaluation.satisfiedGaps).toContain("Urology or primary care diagnosis of ED");
  });

  it("3. A PDF indicator satisfies the records gap via keyword match", () => {
    const evaluation = edWithIndicators(["format-pdf"]);
    expect(evaluation.satisfiedGaps).toContain("Prescription records showing SSRI usage");
  });

  it("4. A DOCX indicator satisfies both gaps identically", () => {
    const evaluation = edWithIndicators(["format-docx"]);
    expect(evaluation.satisfiedGaps).toHaveLength(2);
  });

  it("5. Even format-unknown satisfies both gaps (any indicator counts)", () => {
    const evaluation = edWithIndicators(["format-unknown"]);
    expect(evaluation.satisfiedGaps).toHaveLength(2);
  });

  it("6. An empty indicator array never satisfies a gap", () => {
    const evaluation = edWithIndicators([]);
    expect(evaluation.satisfiedGaps).toHaveLength(0);
  });

  it("7. When every gap is satisfied, remainingGaps falls back to the original list", () => {
    const evaluation = edWithIndicators(["format-pdf"]);
    expect(evaluation.remainingGaps).toEqual([
      "Prescription records showing SSRI usage",
      "Urology or primary care diagnosis of ED",
    ]);
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