import { describe, expect, it } from "vitest";

import { conditionCatalogSchema } from "@/lib/catalog/schema";
import { recommend } from "@/lib/engine/recommend";
import { intakeSchema } from "@/lib/engine/types";
import { knowledgeBaseSchema } from "@/lib/kb/schema";
import {
  buildCausalMechanism,
  buildEvidentiaryProfile,
  buildNexusClaim,
} from "./helpers/crg-fixtures";

const catalog = conditionCatalogSchema.parse([
  {
    id: "primary-a",
    name: "Primary A",
    aliases: [],
    bodySystem: "Test",
    ratingSchedule: [],
    reviewNotes: ["test fixture"],
  },
  {
    id: "primary-b",
    name: "Primary B",
    aliases: [],
    bodySystem: "Test",
    ratingSchedule: [],
    reviewNotes: ["test fixture"],
  },
  {
    id: "shared-secondary",
    name: "Shared Secondary",
    aliases: [],
    bodySystem: "Test",
    ratingSchedule: [],
    reviewNotes: ["test fixture"],
  },
]);

const sharedReference = {
  citation: "Shared authority, 2026",
  note: "Same authored note",
  verificationScope: "legal-framework" as const,
  sourceUrl: "https://example.com/shared-authority",
  verified: false,
  sourceCheckedOn: "2026-08-15",
  sourceLocator: "section A",
};

const alternateProvenance = {
  ...sharedReference,
  sourceUrl: "https://example.com/alternate-copy",
  sourceLocator: "section B",
};

const alternateNote = {
  ...sharedReference,
  note: "Different authored note for the same citation",
};

const kb = knowledgeBaseSchema.parse([
  {
    id: "primary-a",
    suggestions: [
      {
        conditionId: "shared-secondary",
        rank: 1,
        nexusClaim: buildNexusClaim(),
        causalMechanism: buildCausalMechanism(),
        evidentiaryProfile: buildEvidentiaryProfile(),
        rationale: "Primary A rationale",
        evidenceGaps: ["Primary A evidence gap"],
        sourceReferences: [sharedReference],
      },
    ],
  },
  {
    id: "primary-b",
    suggestions: [
      {
        conditionId: "shared-secondary",
        rank: 1,
        nexusClaim: buildNexusClaim(),
        causalMechanism: buildCausalMechanism(),
        evidentiaryProfile: buildEvidentiaryProfile(),
        rationale: "Primary B rationale",
        evidenceGaps: ["Primary B evidence gap"],
        sourceReferences: [
          sharedReference,
          alternateProvenance,
          alternateNote,
        ],
      },
    ],
  },
]);

describe("recommendation reference deduplication", () => {
  it("collapses exact duplicates while preserving same-citation references with distinct provenance or notes", () => {
    const result = recommend(
      catalog,
      kb,
      intakeSchema.parse({ primaryConditions: ["primary-a", "primary-b"] }),
    );

    expect(result.recommendations).toHaveLength(1);
    const references = result.recommendations[0].sourceReferences;

    expect(references).toHaveLength(3);
    expect(references).toContainEqual(sharedReference);
    expect(references).toContainEqual(alternateProvenance);
    expect(references).toContainEqual(alternateNote);
    expect(
      references.filter(
        (reference) =>
          reference.sourceUrl === sharedReference.sourceUrl &&
          reference.sourceLocator === sharedReference.sourceLocator &&
          reference.note === sharedReference.note,
      ),
    ).toHaveLength(1);
  });
});
