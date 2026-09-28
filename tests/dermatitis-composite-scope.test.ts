import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const readJson = <T>(...segments: string[]): T =>
  JSON.parse(
    fs.readFileSync(path.join(process.cwd(), ...segments), "utf8"),
  ) as T;

type CatalogEntry = {
  id: string;
  name: string;
  aliases: string[];
  reviewNotes: string[];
};

type Suggestion = {
  conditionId: string;
  rank: number;
  sourceReferences: { citation: string }[];
};

type Mapping = {
  id: string;
  draft?: boolean;
  todo?: string[];
  governanceNotes?: string[];
  suggestions: Suggestion[];
};

/**
 * Regression coverage for the exact identity change of 2026-09-28: the
 * composite `dermatitis` identity is audited against the eczema scope split
 * (docs/modeling-debt-dispositions.md) — its three atopic-evidence edges are
 * superseded as claim windows and preserved as registered records, its two
 * infection edges are retained as subtype-agnostic windows, and the bare
 * `atopic`/`contact` scope-capture aliases are gone.
 */
describe("dermatitis composite scope (2026-09-28 scope-split audit)", () => {
  const skin = readJson<{ conditions: CatalogEntry[] }>(
    "data",
    "conditions",
    "skin.json",
  ).conditions;
  const wave6 = readJson<{ conditions: CatalogEntry[] }>(
    "data",
    "conditions",
    "skin-expansion-wave-6.json",
  ).conditions;
  const entry = (id: string): CatalogEntry | undefined =>
    [...skin, ...wave6].find((candidate) => candidate.id === id);
  const kb = (id: string): Mapping =>
    readJson<Mapping>("data", "knowledge-base", `${id}.json`);

  it("removes the bare scope-capture aliases and keeps the generic self-alias", () => {
    const dermatitis = entry("dermatitis");
    expect(dermatitis).toBeDefined();
    expect(dermatitis?.aliases).not.toContain("atopic");
    expect(dermatitis?.aliases).not.toContain("contact");
    expect(dermatitis?.aliases).toContain("dermatitis");
    // The sibling-owned scope words resolve to the siblings that own them.
    expect(entry("atopic-dermatitis-eczema")?.aliases).toContain(
      "atopic dermatitis",
    );
    expect(entry("contact-dermatitis")?.name).toBe("Contact dermatitis");
  });

  it("records the composite-scope discipline on the catalog entry", () => {
    const notes = entry("dermatitis")?.reviewNotes.join(" ") ?? "";
    expect(notes).toMatch(/composite/i);
    expect(notes).toContain("atopic-dermatitis-eczema");
    expect(notes).toContain("contact-dermatitis");
    expect(notes).toMatch(/subtype-agnostic/i);
    expect(notes).toMatch(/neither shared etiology nor secondary causation/i);
  });

  it("keeps the five registered suggestions in place with registered text untouched", () => {
    const record = kb("dermatitis");
    expect(record.draft).toBe(true);
    expect(record.suggestions.map((s) => [s.rank, s.conditionId])).toEqual([
      [1, "insomnia"],
      [2, "cellulitis"],
      [3, "impetigo"],
      [4, "depressive-disorder"],
      [5, "anxiety-disorder"],
    ]);
  });

  it("marks the three atopic-evidence edges superseded as claim windows", () => {
    const record = kb("dermatitis");
    const notes = [
      ...(record.todo ?? []),
      ...(record.governanceNotes ?? []),
    ].join(" ");
    expect(notes).toMatch(/composite-scope adjudication/i);
    expect(notes).toMatch(/superseded as claim windows/i);
    expect(notes).toContain("atopic-dermatitis-eczema");
    expect(notes).toMatch(/superseded as to atopic-evidence scope only/i);

    // The evidence-class audit the disposition rests on: the superseded trio
    // is anchored entirely on atopic-titled evidence...
    for (const conditionId of [
      "insomnia",
      "depressive-disorder",
      "anxiety-disorder",
    ]) {
      const suggestion = record.suggestions.find(
        (candidate) => candidate.conditionId === conditionId,
      );
      expect(suggestion?.sourceReferences.length).toBeGreaterThan(0);
      for (const reference of suggestion?.sourceReferences ?? []) {
        expect(reference.citation).toMatch(/atopic dermatitis|urticaria/i);
      }
    }

    // ...while the retained infection windows are anchored on
    // subtype-agnostic barrier, pruritus and impetigo reviews.
    for (const conditionId of ["cellulitis", "impetigo"]) {
      const suggestion = record.suggestions.find(
        (candidate) => candidate.conditionId === conditionId,
      );
      expect(suggestion?.sourceReferences.length).toBeGreaterThan(0);
      for (const reference of suggestion?.sourceReferences ?? []) {
        expect(reference.citation).toMatch(/cellulitis|pruritus|impetigo/i);
      }
    }
  });

  it("records the one-window-per-claim duplicate-scope tension on cellulitis", () => {
    const notes = kb("dermatitis").governanceNotes?.join(" ") ?? "";
    expect(notes).toContain("rel-contact-dermatitis-to-cellulitis");
    expect(notes).toMatch(/exactly one/i);
    expect(notes).toMatch(/one evidence set/i);
  });

  it("preserves the five registered relationships and their registered source uses", () => {
    const { relationships } = readJson<{
      relationships: { relationshipId: string }[];
    }>("data", "evidence", "master-relationships.json");
    const ids = relationships.map((relationship) => relationship.relationshipId);
    const sourcesText = fs.readFileSync(
      path.join(process.cwd(), "data", "evidence", "master-sources.json"),
      "utf8",
    );
    const expectedUses: ReadonlyArray<readonly [string, number]> = [
      ["rel-dermatitis-to-insomnia", 3],
      ["rel-dermatitis-to-cellulitis", 2],
      ["rel-dermatitis-to-impetigo", 3],
      ["rel-dermatitis-to-depressive-disorder", 3],
      ["rel-dermatitis-to-anxiety-disorder", 2],
    ];
    for (const [relationshipId, uses] of expectedUses) {
      expect(ids).toContain(relationshipId);
      expect(sourcesText.split(relationshipId).length - 1).toBe(uses);
    }
  });

  it("annotates the superseded window-ownership statements at the siblings", () => {
    const eczemaNotes = kb("eczema").governanceNotes?.join(" ") ?? "";
    expect(eczemaNotes).toMatch(/superseded as to window ownership only/i);
    expect(eczemaNotes).toMatch(/not reopened/i);

    const atopicNotes =
      kb("atopic-dermatitis-eczema").governanceNotes?.join(" ") ?? "";
    expect(atopicNotes).toMatch(
      /owns the atopic psychiatric-morbidity and sleep window/i,
    );
    expect(atopicNotes).toMatch(
      /superseded as to the insomnia and mood targets only/i,
    );
  });
});
