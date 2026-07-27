import { describe, expect, it } from "vitest";

import { conditionCatalogSchema } from "@/lib/catalog/schema";
import type { Recommendation } from "@/lib/engine/types";
import { groupSuggestionsByPrimary } from "@/lib/secondary-workflow/suggestions";
import {
  parseDiagnosedSelection,
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

describe("secondary workflow state parsing", () => {
  it("requires at least one diagnosed condition", () => {
    expect(() => parseDiagnosedSelection({}, catalog)).toThrow();
  });

  it("keeps diagnosed selections limited to catalog ids", () => {
    const parsed = parseDiagnosedSelection(
      { diagnosed: ["ptsd", "unknown", "tinnitus"] },
      catalog,
    );
    expect(parsed.diagnosedConditionIds).toEqual(["ptsd", "tinnitus"]);
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
        sourceReferences: [{ citation: "38 CFR 3.310", note: "test", verified: false }],
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
