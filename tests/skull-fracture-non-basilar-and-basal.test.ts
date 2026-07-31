import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { findCondition, indexById } from "@/lib/catalog/lookup";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { conditionMappingSchema } from "@/lib/kb/schema";
import { validateKnowledgeBaseAgainstCatalog } from "@/lib/kb/validate";

/**
 * Focused regression tests for the "skull-fracture-non-basilar-and-basal"
 * condition and mapping, which were substantially fleshed out from
 * placeholder content (empty arrays, "Pending manual review") to fully
 * authored entries.
 */

const CONDITION_ID = "skull-fracture-non-basilar-and-basal";

const catalog = loadConditionCatalog();
const kb = loadKnowledgeBase();

const condition = catalog.find((c) => c.id === CONDITION_ID);
const mapping = kb.find((m) => m.id === CONDITION_ID);

describe("catalog entry: skull-fracture-non-basilar-and-basal", () => {
  it("exists in the neurological catalog file", () => {
    expect(condition).toBeDefined();
  });

  it("uses the fully authored display name rather than the old lowercase placeholder", () => {
    expect(condition?.name).toBe("Skull Fracture (Non-basilar and Basal)");
    // The old value was the lowercase, unformatted "skull fracture non
    // basilar and basal" -- guard against regressing to that placeholder.
    expect(condition?.name).not.toBe("skull fracture non basilar and basal");
  });

  it("is assigned to the Neurological body system", () => {
    expect(condition?.bodySystem).toBe("Neurological");
  });

  it("declares the expected aliases and no longer ships an empty array", () => {
    expect(condition?.aliases).toEqual([
      "Basal Skull Fracture",
      "Non-basilar Skull Fracture",
    ]);
  });

  it("has a non-empty rating schedule with unverified, well-formed citations", () => {
    expect(condition?.ratingSchedule.length).toBeGreaterThan(0);
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
    for (const reference of condition?.ratingSchedule ?? []) {
      expect(reference.verified).toBe(false);
      expect(reference.citation).toMatch(/^38 CFR 4\.\d+[a-z]?$/);
    }
  });

  it("carries an updated review note that is not the generic 'Pending manual review' placeholder", () => {
    expect(condition?.reviewNotes).toEqual([
      "Diagnostic code selection and fracture variant details still require human review.",
    ]);
    expect(condition?.reviewNotes).not.toContain("Pending manual review");
  });

  it("resolves through findCondition by id and by each declared alias", () => {
    expect(findCondition(catalog, CONDITION_ID)?.id).toBe(CONDITION_ID);
    expect(findCondition(catalog, "Basal Skull Fracture")?.id).toBe(CONDITION_ID);
    expect(findCondition(catalog, "Non-basilar Skull Fracture")?.id).toBe(
      CONDITION_ID,
    );
    // Case-insensitive, whitespace-tolerant lookup, matching normalizeConditionName.
    expect(findCondition(catalog, "  basal skull fracture  ")?.id).toBe(
      CONDITION_ID,
    );
  });

  it("does not collide with any other condition's id in the global index", () => {
    const byId = indexById(catalog);
    expect(byId.get(CONDITION_ID)?.id).toBe(CONDITION_ID);
  });
});

describe("catalog entry: raw JSON fields not covered by the zod schema", () => {
  // primaryDiagnosticCodes, cfrCitations, displayName, and verified are part
  // of the raw data files but are not modeled in catalogConditionSchema, so
  // they must be checked directly against the file contents.
  const rawFile = path.join(
    process.cwd(),
    "data",
    "conditions",
    "neurological.json",
  );
  const raw = JSON.parse(fs.readFileSync(rawFile, "utf8"));
  const rawCondition = raw.conditions.find(
    (c: { id: string }) => c.id === CONDITION_ID,
  );

  it("sets displayName equal to name", () => {
    expect(rawCondition.displayName).toBe("Skull Fracture (Non-basilar and Basal)");
    expect(rawCondition.displayName).toBe(rawCondition.name);
  });

  it("lists the expected primary diagnostic codes", () => {
    expect(rawCondition.primaryDiagnosticCodes).toEqual(["5296", "8045"]);
  });

  it("lists the expected CFR citations", () => {
    expect(rawCondition.cfrCitations).toEqual([
      "38 CFR § 4.71a",
      "38 CFR § 4.124a",
      "38 CFR § 3.310",
    ]);
  });

  it("remains unverified and non-draft pending human review", () => {
    expect(rawCondition.draft).toBe(false);
    expect(rawCondition.verified).toBe(false);
  });
});

describe("knowledge-base mapping: skull-fracture-non-basilar-and-basal", () => {
  it("exists and is published (not a draft) with an empty todo list", () => {
    expect(mapping).toBeDefined();
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
  });

  it("expanded from two placeholder suggestions to six fully authored suggestions", () => {
    expect(mapping?.suggestions).toHaveLength(6);
  });

  it("orders suggestions with unique, gapless ranks starting at 1", () => {
    const ranks = mapping?.suggestions.map((s) => s.rank) ?? [];
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("suggests the expected conditions in the expected rank order", () => {
    const ids = mapping?.suggestions.map((s) => s.conditionId) ?? [];
    expect(ids).toEqual([
      "migraine-headaches",
      "post-concussion-syndrome",
      "tinnitus",
      "vestibular-disorder",
      "depressive-disorder",
      "anosmia",
    ]);
  });

  it("assigns the expected prevalence tier to each suggestion", () => {
    const byId = new Map(
      mapping?.suggestions.map((s) => [s.conditionId, s.prevalence]) ?? [],
    );
    expect(byId.get("migraine-headaches")).toBe("commonly-explored");
    expect(byId.get("post-concussion-syndrome")).toBe("commonly-explored");
    expect(byId.get("tinnitus")).toBe("sometimes-explored");
    expect(byId.get("vestibular-disorder")).toBe("sometimes-explored");
    expect(byId.get("depressive-disorder")).toBe("sometimes-explored");
    expect(byId.get("anosmia")).toBe("occasionally-explored");
  });

  it("never suggests the condition as a secondary of itself", () => {
    const ids = mapping?.suggestions.map((s) => s.conditionId) ?? [];
    expect(ids).not.toContain(CONDITION_ID);
  });

  it("never duplicates a conditionId within the mapping", () => {
    const ids = mapping?.suggestions.map((s) => s.conditionId) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every suggestion a rationale, at least one evidence gap, and 1-3 source references", () => {
    for (const suggestion of mapping?.suggestions ?? []) {
      expect(suggestion.rationale.length).toBeGreaterThan(0);
      expect(suggestion.evidenceGaps.length).toBeGreaterThanOrEqual(1);
      expect(suggestion.sourceReferences.length).toBeGreaterThanOrEqual(1);
      expect(suggestion.sourceReferences.length).toBeLessThanOrEqual(3);
    }
  });

  it("provides three evidence gaps for every newly authored suggestion", () => {
    for (const suggestion of mapping?.suggestions ?? []) {
      expect(suggestion.evidenceGaps).toHaveLength(3);
    }
  });

  it("never marks a source reference as verified without human review", () => {
    const verified = (mapping?.suggestions ?? []).flatMap((s) =>
      s.sourceReferences.filter((r) => r.verified),
    );
    expect(verified).toEqual([]);
  });

  it("keeps every source reference citation and note non-empty", () => {
    for (const suggestion of mapping?.suggestions ?? []) {
      for (const reference of suggestion.sourceReferences) {
        expect(reference.citation.trim().length).toBeGreaterThan(0);
        expect(reference.note.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("includes a secondary service connection citation (38 CFR 3.310) for every suggestion", () => {
    for (const suggestion of mapping?.suggestions ?? []) {
      const citations = suggestion.sourceReferences.map((r) => r.citation);
      expect(citations).toContain("38 CFR 3.310");
    }
  });

  it("resolves every suggested conditionId to an existing catalog entry", () => {
    const byId = indexById(catalog);
    for (const suggestion of mapping?.suggestions ?? []) {
      expect(
        byId.has(suggestion.conditionId),
        `"${CONDITION_ID}" suggests unknown condition "${suggestion.conditionId}"`,
      ).toBe(true);
    }
  });

  it("contains no placeholder text now that the mapping is published", () => {
    const authored = (mapping?.suggestions ?? []).flatMap((suggestion) => [
      suggestion.rationale,
      ...suggestion.evidenceGaps,
      ...suggestion.sourceReferences.flatMap((r) => [r.citation, r.note]),
    ]);
    for (const text of authored) {
      expect(text).not.toMatch(/TODO|FIXME|placeholder|lorem ipsum|TBD/i);
    }
  });
});

describe("knowledge-base mapping: negative / boundary validation", () => {
  it("fails conditionMappingSchema validation when a suggestion self-references the mapping id", () => {
    const rawFile = path.join(
      process.cwd(),
      "data",
      "knowledge-base",
      `${CONDITION_ID}.json`,
    );
    const raw = JSON.parse(fs.readFileSync(rawFile, "utf8"));

    const broken = {
      ...raw,
      suggestions: [
        { ...raw.suggestions[0], conditionId: CONDITION_ID },
        ...raw.suggestions.slice(1),
      ],
    };

    expect(() => conditionMappingSchema.parse(broken)).toThrow();
  });

  it("fails conditionMappingSchema validation when ranks are no longer gapless", () => {
    const rawFile = path.join(
      process.cwd(),
      "data",
      "knowledge-base",
      `${CONDITION_ID}.json`,
    );
    const raw = JSON.parse(fs.readFileSync(rawFile, "utf8"));

    const broken = {
      ...raw,
      suggestions: raw.suggestions.map(
        (s: { rank: number }, index: number) =>
          index === 0 ? { ...raw.suggestions[0], rank: 99 } : s,
      ),
    };

    expect(() => conditionMappingSchema.parse(broken)).toThrow();
  });

  it("fails validateKnowledgeBaseAgainstCatalog when a suggestion points at an unknown condition", () => {
    const rawFile = path.join(
      process.cwd(),
      "data",
      "knowledge-base",
      `${CONDITION_ID}.json`,
    );
    const raw = JSON.parse(fs.readFileSync(rawFile, "utf8"));

    const broken = conditionMappingSchema.parse({
      ...raw,
      suggestions: [
        { ...raw.suggestions[0], conditionId: "condition-that-does-not-exist" },
        ...raw.suggestions.slice(1),
      ],
    });

    expect(() =>
      validateKnowledgeBaseAgainstCatalog(catalog, [broken]),
    ).toThrow(
      `Mapping "${CONDITION_ID}" suggests unknown condition "condition-that-does-not-exist".`,
    );
  });

  it("stays internally consistent: real published mapping data passes schema and catalog validation", () => {
    expect(() => conditionMappingSchema.parse(mapping)).not.toThrow();
    expect(() =>
      validateKnowledgeBaseAgainstCatalog(catalog, [mapping!]),
    ).not.toThrow();
  });
});