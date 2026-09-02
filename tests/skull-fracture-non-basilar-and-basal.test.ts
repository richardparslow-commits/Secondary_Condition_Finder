import { assertMasterResolution2026CurrentState, isMasterResolution2026Active } from "./helpers/master-resolution-2026-current";
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { findCondition, indexById } from "@/lib/catalog/lookup";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { conditionMappingSchema } from "@/lib/kb/schema";
import { validateKnowledgeBaseAgainstCatalog } from "@/lib/kb/validate";
import {
  buildCausalMechanism,
  buildEvidentiaryProfile,
  buildNexusClaim,
} from "./helpers/crg-fixtures";

const CONDITION_ID = "skull-fracture-non-basilar-and-basal";
const catalog = loadConditionCatalog();
const kb = loadKnowledgeBase();
const condition = catalog.find((c) => c.id === CONDITION_ID);
const mapping = kb.find((m) => m.id === CONDITION_ID);

const syntheticSuggestion = (conditionId: string, rank: number) => ({
  conditionId,
  rank,
  nexusClaim: buildNexusClaim(),
  causalMechanism: buildCausalMechanism(),
  evidentiaryProfile: buildEvidentiaryProfile(),
  rationale: "Synthetic schema-validation fixture; not published medical content.",
  evidenceGaps: ["Synthetic evidence gap for schema-validation coverage."],
  sourceReferences: [
    {
      citation: "Synthetic clinical source",
      note: "Synthetic source used only by the regression test.",
      verified: false as const,
      verificationScope: "clinical-evidence" as const,
      sourceUrl: "https://example.com/synthetic-clinical-source",
      sourceCheckedOn: "2026-08-14",
      sourceLocator: "Synthetic fixture",
    },
  ],
});

describe("catalog entry: skull-fracture-non-basilar-and-basal", () => {
  it("preserves the authored stable catalog identity and aliases", () => {
    expect(condition).toBeDefined();
    expect(condition?.name).toBe("Skull Fracture (Non-basilar and Basal)");
    expect(condition?.bodySystem).toBe("Neurological");
    expect(condition?.aliases).toEqual(["Basal Skull Fracture", "Non-basilar Skull Fracture"]);
    expect(findCondition(catalog, CONDITION_ID)?.id).toBe(CONDITION_ID);
    expect(findCondition(catalog, "Basal Skull Fracture")?.id).toBe(CONDITION_ID);
    expect(indexById(catalog).get(CONDITION_ID)?.id).toBe(CONDITION_ID);
  });

  it("preserves the rating frameworks as unverified rating context", () => {
    expect(condition?.ratingSchedule).toEqual([
      {
        citation: "38 CFR 4.71a",
        note: "Schedule of ratings, musculoskeletal system, including skull loss.",
        verified: false,
      },
      {
        citation: "38 CFR 4.124a",
        note: "Schedule of ratings, neurological conditions and residuals of brain trauma.",
        verified: false,
      },
    ]);
    expect(condition?.reviewNotes).toEqual([
      "Diagnostic code selection and fracture variant details still require human review.",
    ]);
  });

  it("keeps canonical schema-only catalog JSON", () => {
    const rawFile = path.join(process.cwd(), "data", "conditions", "neurological.json");
    const raw = JSON.parse(fs.readFileSync(rawFile, "utf8"));
    const rawCondition = raw.conditions.find((c: { id: string }) => c.id === CONDITION_ID);
    expect(rawCondition).not.toHaveProperty("displayName");
    expect(rawCondition).not.toHaveProperty("primaryDiagnosticCodes");
    expect(rawCondition).not.toHaveProperty("cfrCitations");
    expect(rawCondition).not.toHaveProperty("draft");
  });
});

describe("knowledge-base mapping: Batch 22 safety withdrawal", () => {
  it("exists as a reviewed draft with no published suggestions", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    expect(mapping).toBeDefined();
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.length).toBeGreaterThan(0);
    expect(mapping?.todo.join(" ")).toMatch(/six|subtype|heterogeneous|clinical evidence/i);
  });

  it("does not publish the former six diagnosis-specific residual claims", () => {
    const ids = mapping?.suggestions.map((s) => s.conditionId) ?? [];
    for (const formerId of [
      "migraine-headaches",
      "post-concussion-syndrome",
      "tinnitus",
      "vestibular-disorder",
      "depressive-disorder",
      "anosmia",
    ]) expect(ids).not.toContain(formerId);
  });

  it("the real draft mapping still passes schema and catalog validation", () => {
    expect(() => conditionMappingSchema.parse(mapping)).not.toThrow();
    expect(() => validateKnowledgeBaseAgainstCatalog(catalog, [mapping!])).not.toThrow();
  });
});

describe("knowledge-base schema negative/boundary validation", () => {
  const syntheticPublished = {
    id: CONDITION_ID,
    draft: false,
    todo: [],
    suggestions: [
      syntheticSuggestion("migraine-headaches", 1),
      syntheticSuggestion("tinnitus", 2),
    ],
  };

  it("rejects self-reference", () => {
    const broken = {
      ...syntheticPublished,
      suggestions: [syntheticSuggestion(CONDITION_ID, 1), syntheticSuggestion("tinnitus", 2)],
    };
    expect(() => conditionMappingSchema.parse(broken)).toThrow();
  });

  it("rejects non-gapless ranks", () => {
    const broken = {
      ...syntheticPublished,
      suggestions: [syntheticSuggestion("migraine-headaches", 99), syntheticSuggestion("tinnitus", 2)],
    };
    expect(() => conditionMappingSchema.parse(broken)).toThrow();
  });

  it("catalog validation rejects an unknown suggestion target", () => {
    const broken = conditionMappingSchema.parse({
      ...syntheticPublished,
      suggestions: [
        syntheticSuggestion("condition-that-does-not-exist", 1),
        syntheticSuggestion("tinnitus", 2),
      ],
    });
    expect(() => validateKnowledgeBaseAgainstCatalog(catalog, [broken])).toThrow(
      `Mapping "${CONDITION_ID}" suggests unknown condition "condition-that-does-not-exist".`,
    );
  });
});
