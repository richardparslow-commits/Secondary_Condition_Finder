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

type Mapping = {
  id: string;
  draft?: boolean;
  todo?: string[];
  governanceNotes?: string[];
  suggestions: { conditionId: string; sourceReferences: unknown[] }[];
};

type Relationship = {
  relationshipId: string;
  primaryId: string;
  targetId: string;
};

/**
 * Regression coverage for the exact identity change of 2026-09-28: the
 * rotator-cuff and thumb pairs are reconciled to canonical identities
 * (`rotator-cuff-injury`, `gamekeeper-s-thumb`) with the non-canonical
 * identities retained as quarantined pointer records, and every registered
 * edge and its sources preserved exactly — per the disposition in
 * docs/modeling-debt-dispositions.md and its bounded-change rule.
 */
describe("canonical-identity reconciliation (2026-09-28 pointer reconciliation)", () => {
  const musculoskeletal = readJson<{ conditions: CatalogEntry[] }>(
    "data",
    "conditions",
    "musculoskeletal.json",
  ).conditions;
  const wave2 = readJson<{ conditions: CatalogEntry[] }>(
    "data",
    "conditions",
    "musculoskeletal-expansion-wave-2.json",
  ).conditions;
  const entry = (id: string): CatalogEntry | undefined =>
    [...musculoskeletal, ...wave2].find((candidate) => candidate.id === id);
  const kb = (id: string): Mapping =>
    readJson<Mapping>("data", "knowledge-base", `${id}.json`);

  it("elects the edge-holding identities canonical and records the pointer linkage", () => {
    expect(entry("rotator-cuff-injury")?.reviewNotes.join(" ")).toContain("rotator-cuff-tear");
    expect(entry("gamekeeper-s-thumb")?.reviewNotes.join(" ")).toContain("skier-s-thumb");
    for (const id of ["rotator-cuff-injury", "gamekeeper-s-thumb"]) {
      expect(entry(id)?.reviewNotes.join(" ")).toMatch(/canonical/i);
    }
    // The catalog invariant (tests/catalog.test.ts) forbids an alias
    // colliding with another condition's name or id, so the variant names
    // stay on the pointer entries until a catalog-v3 retirement folds them.
    expect(entry("rotator-cuff-injury")?.aliases).not.toContain("rotator cuff tear");
    expect(entry("gamekeeper-s-thumb")?.aliases).not.toContain("skier's thumb");
  });

  it("keeps the non-canonical identities as quarantined pointer records", () => {
    const pairs: ReadonlyArray<readonly [string, string]> = [
      ["rotator-cuff-tear", "rotator-cuff-injury"],
      ["skier-s-thumb", "gamekeeper-s-thumb"],
    ];
    for (const [pointer, canonical] of pairs) {
      expect(entry(pointer)?.reviewNotes.join(" ")).toContain(canonical);
      const record = kb(pointer);
      expect(record.suggestions).toEqual([]);
      const notes = [...(record.todo ?? []), ...(record.governanceNotes ?? [])].join(" ");
      expect(notes).toContain(canonical);
      expect(notes).toMatch(/quarantined pointer/i);
    }
  });

  it("preserves every registered edge and its registered sources", () => {
    const { relationships } = readJson<{ relationships: Relationship[] }>(
      "data",
      "evidence",
      "master-relationships.json",
    );
    const ids = relationships.map((relationship) => relationship.relationshipId);
    for (const expected of [
      "rel-bicipital-tendinitis-to-rotator-cuff-injury",
      "rel-slap-tear-to-rotator-cuff-injury",
      "rel-gamekeeper-s-thumb-to-osteoarthritis",
    ]) {
      expect(ids).toContain(expected);
    }

    const sourcesText = fs.readFileSync(
      path.join(process.cwd(), "data", "evidence", "master-sources.json"),
      "utf8",
    );
    const usesOf = (relationshipId: string): number =>
      sourcesText.split(relationshipId).length - 1;
    expect(usesOf("rel-bicipital-tendinitis-to-rotator-cuff-injury")).toBeGreaterThanOrEqual(2);
    expect(usesOf("rel-slap-tear-to-rotator-cuff-injury")).toBeGreaterThanOrEqual(3);
    expect(usesOf("rel-gamekeeper-s-thumb-to-osteoarthritis")).toBeGreaterThanOrEqual(3);

    const gamekeeperEdge = kb("gamekeeper-s-thumb").suggestions.find(
      (suggestion) => suggestion.conditionId === "osteoarthritis",
    );
    expect(gamekeeperEdge?.sourceReferences).toHaveLength(3);
  });
});
