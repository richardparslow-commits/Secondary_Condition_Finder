import { describe, expect, it } from "vitest";

import { conditionCatalogSchema } from "@/lib/catalog/schema";
import type { Recommendation } from "@/lib/engine/types";
import {
  findLinkedNonServiceConnectedConditions,
  groupSuggestionsByPrimary,
} from "@/lib/secondary-workflow/suggestions";
import {
  parseDiagnosedPrefill,
  parseDocumentsSelection,
  parseDiagnosedSelection,
  parseServiceConnectedPrefill,
  parseRatingsSelection,
  parseServiceConnectedSelection,
  parseWorkflowState,
  workflowStateToSearchParams,
} from "@/lib/secondary-workflow/state";

function toQueryParams(searchParams: URLSearchParams): Record<string, string | string[]> {
  const keys = new Set<string>();
  for (const [key] of searchParams.entries()) {
    keys.add(key);
  }

  const params: Record<string, string | string[]> = {};
  for (const key of keys) {
    const values = searchParams.getAll(key);
    params[key] = values.length === 1 ? values[0] : values;
  }
  return params;
}

const catalog = conditionCatalogSchema.parse([
  {
    id: "ptsd",
    name: "Post-Traumatic Stress Disorder (PTSD)",
    aliases: ["post-traumatic stress disorder"],
    bodySystem: "Mental Disorders",
    ratingSchedule: [],
    reviewNotes: ["test fixture"],
  },
  {
    id: "tinnitus",
    name: "Tinnitus",
    aliases: [],
    bodySystem: "Auditory",
    ratingSchedule: [],
    reviewNotes: ["test fixture"],
  },
  {
    id: "sleep-apnea",
    name: "Sleep Apnea",
    aliases: [],
    bodySystem: "Respiratory",
    ratingSchedule: [],
    reviewNotes: ["test fixture"],
  },
]);

const unverifiedLegalReference = {
  citation: "38 CFR 3.310",
  note: "test",
  verificationScope: "legal-framework" as const,
  verified: false,
};

describe("secondary workflow state parsing", () => {
  it("requires at least one diagnosed condition", () => {
    expect(() => parseDiagnosedSelection({}, catalog)).toThrow();
  });

  it("keeps diagnosed selections limited to catalog ids", () => {
    const prefill = parseDiagnosedPrefill(
      { diagnosed: ["ptsd", "unknown", "tinnitus"] },
      catalog,
    );
    expect(prefill).toEqual(["ptsd", "tinnitus"]);
    expect(parseDiagnosedSelection({ diagnosed: prefill }, catalog).diagnosedConditionIds).toEqual([
      "ptsd",
      "tinnitus",
    ]);
  });

  it("prefills service-connected selections when present", () => {
    const parsed = parseServiceConnectedPrefill(
      {
        diagnosed: ["ptsd", "tinnitus"],
        serviceConnected: ["ptsd"],
      },
      catalog,
    );

    expect(parsed).toEqual({
      diagnosedConditionIds: ["ptsd", "tinnitus"],
      serviceConnectedConditionIds: ["ptsd"],
    });
  });

  it("accepts service-connected status only for diagnosed conditions", () => {
    const parsed = parseServiceConnectedSelection(
      {
        diagnosed: ["ptsd", "tinnitus"],
        "serviceConnected-ptsd": "yes",
        "serviceConnected-tinnitus": "no",
      },
      catalog,
    );
    expect(parsed.serviceConnectedConditionIds).toEqual(["ptsd"]);
  });

  it("requires at least one service-connected condition", () => {
    expect(() =>
      parseServiceConnectedSelection(
        {
          diagnosed: ["ptsd"],
          "serviceConnected-ptsd": "no",
        },
        catalog,
      ),
    ).toThrow();
  });

  it("parses ratings as 0-100 integers or decline", () => {
    const parsed = parseRatingsSelection(
      {
        diagnosed: ["ptsd", "tinnitus"],
        serviceConnected: ["ptsd", "tinnitus"],
        "rating-ptsd": "0",
        "rating-tinnitus": "decline",
      },
      catalog,
    );

    expect(parsed.ratingsByConditionId).toEqual({
      ptsd: 0,
      tinnitus: null,
    });
  });

  it("round-trips a 100 percent rating as a numeric value", () => {
    const initial = {
      diagnosedConditionIds: ["ptsd"],
      serviceConnectedConditionIds: ["ptsd"],
      ratingsByConditionId: { ptsd: 100 },
      documentsShared: false,
    };

    const searchParams = workflowStateToSearchParams(initial);

    expect(searchParams.get("rating-ptsd")).toBe("100");
    expect(parseWorkflowState(toQueryParams(searchParams), catalog)).toEqual(initial);
  });

  it("rejects rating values outside 0 through 100", () => {
    expect(() =>
      parseRatingsSelection(
        {
          diagnosed: ["ptsd"],
          serviceConnected: ["ptsd"],
          "rating-ptsd": "120",
        },
        catalog,
      ),
    ).toThrow();
  });

  it("round-trips full workflow state through query params", () => {
    const initial = {
      diagnosedConditionIds: ["ptsd", "tinnitus"],
      serviceConnectedConditionIds: ["ptsd"],
      ratingsByConditionId: { ptsd: 70 },
      documentsShared: true,
    };

    const parsed = parseWorkflowState(
      toQueryParams(workflowStateToSearchParams(initial)),
      catalog,
    );

    expect(parsed).toEqual(initial);
  });

  it("requires upload-step selection before suggestions/evidence", () => {
    expect(() =>
      parseDocumentsSelection(
        {
          diagnosed: ["ptsd"],
          serviceConnected: ["ptsd"],
          "rating-ptsd": "70",
        },
        catalog,
      ),
    ).toThrow();
  });
});

describe("groupSuggestionsByPrimary", () => {
  it("groups suggestions under each selected service-connected primary", () => {
    const recommendations: Recommendation[] = [
      {
        conditionId: "sleep-apnea",
        condition: "Sleep Apnea",
        bodySystem: "Respiratory",
        prevalence: "commonly-explored",
        score: 1,
        contributingPrimaries: [
          { id: "ptsd", name: "Post-Traumatic Stress Disorder (PTSD)", rank: 1, rationale: "r1" },
          { id: "tinnitus", name: "Tinnitus", rank: 2, rationale: "r2" },
        ],
        evidenceGaps: ["gap"],
        sourceReferences: [unverifiedLegalReference],
        matchedIntakeContext: [],
      },
    ];

    const grouped = groupSuggestionsByPrimary(
      catalog,
      ["ptsd", "tinnitus"],
      recommendations,
    );

    expect(grouped).toHaveLength(2);
    expect(grouped[0].recommendations).toHaveLength(1);
    expect(grouped[1].recommendations).toHaveLength(1);
  });
});

describe("findLinkedNonServiceConnectedConditions", () => {
  const baseRecommendation: Recommendation = {
    conditionId: "sleep-apnea",
    condition: "Sleep Apnea",
    bodySystem: "Respiratory",
    prevalence: "commonly-explored",
    score: 1,
    contributingPrimaries: [
      { id: "ptsd", name: "Post-Traumatic Stress Disorder (PTSD)", rank: 1, rationale: "PTSD disrupts sleep architecture." },
    ],
    evidenceGaps: ["nexus letter"],
    sourceReferences: [
      {
        ...unverifiedLegalReference,
        note: "direct service connection",
      },
    ],
    matchedIntakeContext: [],
  };

  it("returns a diagnosed non-SC condition that appears in recommendations", () => {
    const linked = findLinkedNonServiceConnectedConditions(
      ["ptsd", "sleep-apnea"],
      ["ptsd"],
      [baseRecommendation],
    );

    expect(linked).toHaveLength(1);
    expect(linked[0].conditionId).toBe("sleep-apnea");
    expect(linked[0].conditionName).toBe("Sleep Apnea");
    expect(linked[0].bodySystem).toBe("Respiratory");
    expect(linked[0].prevalence).toBe("commonly-explored");
    expect(linked[0].linkingPrimaries).toHaveLength(1);
    expect(linked[0].linkingPrimaries[0].rationale).toBe("PTSD disrupts sleep architecture.");
  });

  it("returns nothing when the non-SC condition is not in any recommendation", () => {
    const linked = findLinkedNonServiceConnectedConditions(
      ["ptsd", "tinnitus"],
      ["ptsd"],
      [baseRecommendation],
    );

    expect(linked).toHaveLength(0);
  });

  it("returns nothing when all diagnosed conditions are already service connected", () => {
    const linked = findLinkedNonServiceConnectedConditions(
      ["ptsd", "sleep-apnea"],
      ["ptsd", "sleep-apnea"],
      [baseRecommendation],
    );

    expect(linked).toHaveLength(0);
  });

  it("returns nothing when there are no diagnosed conditions", () => {
    const linked = findLinkedNonServiceConnectedConditions(
      [],
      [],
      [baseRecommendation],
    );

    expect(linked).toHaveLength(0);
  });

  it("returns multiple linked conditions when several non-SC conditions are in recommendations", () => {
    const tinnitusSC: Recommendation = {
      conditionId: "tinnitus",
      condition: "Tinnitus",
      bodySystem: "Auditory",
      prevalence: "sometimes-explored",
      score: 0.5,
      contributingPrimaries: [
        { id: "ptsd", name: "Post-Traumatic Stress Disorder (PTSD)", rank: 2, rationale: "Hypervigilance worsens tinnitus." },
      ],
      evidenceGaps: ["audiology records"],
      sourceReferences: [unverifiedLegalReference],
      matchedIntakeContext: [],
    };

    const linked = findLinkedNonServiceConnectedConditions(
      ["ptsd", "sleep-apnea", "tinnitus"],
      ["ptsd"],
      [baseRecommendation, tinnitusSC],
    );

    expect(linked).toHaveLength(2);
    expect(linked.map((l) => l.conditionId)).toContain("sleep-apnea");
    expect(linked.map((l) => l.conditionId)).toContain("tinnitus");
  });
});
