import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

const kb = loadKnowledgeBase();

describe("knowledge base integrity", () => {
  it("loads and validates every entry against the schema", () => {
    expect(kb.length).toBeGreaterThan(0);
  });

  it("uses unique ids", () => {
    const ids = kb.map((condition) => condition.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every suggestion a rationale, an evidence gap, and a citation", () => {
    for (const condition of kb) {
      for (const suggestion of condition.suggestions) {
        expect(suggestion.rationale.length).toBeGreaterThan(0);
        expect(suggestion.evidenceGaps.length).toBeGreaterThan(0);
        expect(suggestion.sourceReferences.length).toBeGreaterThan(0);
      }
    }
  });

  it("uses unique, gapless ranks within each condition", () => {
    for (const condition of kb) {
      const ranks = condition.suggestions.map((s) => s.rank).sort((a, b) => a - b);
      expect(ranks).toEqual(ranks.map((_, index) => index + 1));
    }
  });

  it("uses one display label per canonical conditionId", () => {
    // Guards the merge key: if two files label the same conditionId
    // differently, results would render inconsistently.
    const labels = new Map<string, Set<string>>();
    for (const condition of kb) {
      for (const suggestion of condition.suggestions) {
        const set = labels.get(suggestion.conditionId) ?? new Set<string>();
        set.add(suggestion.condition);
        labels.set(suggestion.conditionId, set);
      }
    }
    for (const [conditionId, set] of labels) {
      expect(
        [...set],
        `conditionId "${conditionId}" has multiple labels`,
      ).toHaveLength(1);
    }
  });

  it("does not suggest a condition as a secondary of itself", () => {
    for (const condition of kb) {
      const ids = condition.suggestions.map((s) => s.conditionId);
      expect(ids).not.toContain(condition.id);
    }
  });

  it("does not mark any citation verified without human review", () => {
    // Citations ship unverified until a qualified human signs off. This test is
    // the tripwire: flipping `verified` to true is a deliberate, reviewed act.
    const verified = kb.flatMap((condition) =>
      condition.suggestions.flatMap((suggestion) =>
        suggestion.sourceReferences.filter((reference) => reference.verified),
      ),
    );
    expect(verified).toEqual([]);
  });
});
