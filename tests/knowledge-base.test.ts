import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { indexById } from "@/lib/catalog/lookup";
import { conditionCatalogSchema } from "@/lib/catalog/schema";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { draftMappings, mappedConditionIds } from "@/lib/kb/lookup";
import { knowledgeBaseSchema } from "@/lib/kb/schema";
import { validateKnowledgeBaseAgainstCatalog } from "@/lib/kb/validate";
import {
  buildCausalMechanism,
  buildEvidentiaryProfile,
  buildNexusClaim,
} from "./helpers/crg-fixtures";

const catalog = loadConditionCatalog();
const kb = loadKnowledgeBase();
const byId = indexById(catalog);

describe("referential integrity between mappings and the catalog", () => {
  it("resolves every mapping id to a catalog condition", () => {
    for (const mapping of kb) {
      expect(byId.has(mapping.id), `mapping "${mapping.id}" has no catalog entry`).toBe(true);
    }
  });

  it("resolves every suggestion to a catalog condition", () => {
    for (const mapping of kb) {
      for (const suggestion of mapping.suggestions) {
        expect(
          byId.has(suggestion.conditionId),
          `"${mapping.id}" suggests unknown condition "${suggestion.conditionId}"`,
        ).toBe(true);
      }
    }
  });
});

describe("mapping integrity", () => {
  it("uses unique mapping ids", () => {
    const ids = kb.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every suggestion a rationale, an evidence gap, and a citation", () => {
    for (const mapping of kb) {
      for (const suggestion of mapping.suggestions) {
        expect(suggestion.rationale.length).toBeGreaterThan(0);
        expect(suggestion.evidenceGaps.length).toBeGreaterThan(0);
        expect(suggestion.sourceReferences.length).toBeGreaterThan(0);
        for (const reference of suggestion.sourceReferences) {
          expect(reference.citation.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("uses unique, gapless ranks within each mapping", () => {
    for (const mapping of kb) {
      const ranks = mapping.suggestions.map((s) => s.rank).sort((a, b) => a - b);
      expect(ranks).toEqual(ranks.map((_, index) => index + 1));
    }
  });

  it("never suggests a condition as a secondary of itself", () => {
    for (const mapping of kb) {
      expect(mapping.suggestions.map((s) => s.conditionId)).not.toContain(mapping.id);
    }
  });

  it("never duplicates a conditionId within one mapping", () => {
    for (const mapping of kb) {
      const ids = mapping.suggestions.map((s) => s.conditionId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("requires complete verification metadata for verified citations", () => {
    const verified = kb.flatMap((mapping) =>
      mapping.suggestions.flatMap((suggestion) =>
        suggestion.sourceReferences.filter((reference) => reference.verified),
      ),
    );
    for (const reference of verified) {
      expect(reference.sourceUrl?.trim().length).toBeGreaterThan(0);
      expect(reference.sourceCheckedOn?.trim().length).toBeGreaterThan(0);
      expect(reference.sourceLocator?.trim().length).toBeGreaterThan(0);
      expect(reference.verificationScope?.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps published mappings free of placeholder text", () => {
    const authored = kb
      .filter((m) => !m.draft)
      .flatMap((mapping) =>
        mapping.suggestions.flatMap((suggestion) => [
          suggestion.rationale,
          ...suggestion.evidenceGaps,
          ...suggestion.sourceReferences.flatMap((r) => [r.citation, r.note]),
        ]),
      );
    for (const text of authored) {
      expect(text).not.toMatch(/TODO|FIXME|placeholder|lorem ipsum|TBD/i);
    }
  });
});

describe("draft mappings", () => {
  it("gives every draft a todo checklist and keeps it out of the published set", () => {
    const published = mappedConditionIds(kb);
    for (const draft of draftMappings(kb)) {
      expect(draft.todo.length).toBeGreaterThan(0);
      expect(published.has(draft.id)).toBe(false);
    }
  });
});

describe("coverage", () => {
  it("keeps catalog conditions in exactly one published-or-draft mapping", () => {
    const published = mappedConditionIds(kb);
    const drafts = new Set(draftMappings(kb).map((mapping) => mapping.id));
    const catalogIds = new Set(catalog.map((condition) => condition.id));

    expect(published.size + drafts.size).toBe(catalogIds.size);
    expect(new Set([...published, ...drafts])).toEqual(catalogIds);
    expect([...published].some((id) => drafts.has(id))).toBe(false);
  });
});

describe("validateKnowledgeBaseAgainstCatalog", () => {
  it("throws when a mapping id is not in the catalog", () => {
    const catalog = conditionCatalogSchema.parse([
      {
        id: "known-primary",
        name: "Known Primary",
        aliases: [],
        bodySystem: "Test",
        ratingSchedule: [],
        reviewNotes: ["test fixture"],
      },
      {
        id: "known-secondary",
        name: "Known Secondary",
        aliases: [],
        bodySystem: "Test",
        ratingSchedule: [],
        reviewNotes: ["test fixture"],
      },
    ]);
    const kb = knowledgeBaseSchema.parse([
      {
        id: "missing-primary",
        draft: false,
        todo: [],
        suggestions: [
          {
            conditionId: "known-secondary",
            rank: 1,
            nexusClaim: buildNexusClaim(),
            causalMechanism: buildCausalMechanism(),
            evidentiaryProfile: buildEvidentiaryProfile(),
            rationale: "test",
            evidenceGaps: ["test"],
            sourceReferences: [{ citation: "test", note: "test", verified: false }],
          },
        ],
      },
    ]);

    expect(() => validateKnowledgeBaseAgainstCatalog(catalog, kb)).toThrow(
      'Mapping "missing-primary" has no matching condition in data/conditions.',
    );
  });

  it("throws when a suggestion id is not in the catalog", () => {
    const catalog = conditionCatalogSchema.parse([
      {
        id: "known-primary",
        name: "Known Primary",
        aliases: [],
        bodySystem: "Test",
        ratingSchedule: [],
        reviewNotes: ["test fixture"],
      },
    ]);
    const kb = knowledgeBaseSchema.parse([
      {
        id: "known-primary",
        draft: false,
        todo: [],
        suggestions: [
          {
            conditionId: "missing-secondary",
            rank: 1,
            nexusClaim: buildNexusClaim(),
            causalMechanism: buildCausalMechanism(),
            evidentiaryProfile: buildEvidentiaryProfile(),
            rationale: "test",
            evidenceGaps: ["test"],
            sourceReferences: [{ citation: "test", note: "test", verified: false }],
          },
        ],
      },
    ]);

    expect(() => validateKnowledgeBaseAgainstCatalog(catalog, kb)).toThrow(
      'Mapping "known-primary" suggests unknown condition "missing-secondary".',
    );
  });
});
