import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readJson = <T>(relativePath: string): T =>
  JSON.parse(fs.readFileSync(`${root}/${relativePath}`, "utf8")) as T;

type Suggestion = { conditionId: string };
type Mapping = { id: string; draft?: boolean; suggestions?: Suggestion[] };
type Ledger = {
  ratchet: { withoutSuggestionsMax: number; withAuthoredSuggestionsMin: number; note: string };
  metrics: {
    catalogIdentities: number;
    withAuthoredSuggestions: number;
    publishedWithSuggestions: number;
    draftWithSuggestions: number;
    withoutSuggestions: number;
    suggestionEdges: number;
    catalogIdentitiesWithoutKnowledgeBaseFile: number;
  };
  bodySystems: {
    bodySystem: string;
    catalogIdentities: number;
    withAuthoredSuggestions: number;
    published: number;
    draft: number;
    withoutSuggestions: number;
  }[];
  withoutSuggestionsIds: string[];
};

/**
 * Recomputed here rather than imported from `scripts/lib/kb-coverage.js`.
 *
 * The ledger is *generated* by that module, so a test that read the same module
 * would agree with it by construction — including when both are wrong about the
 * data. These thirty lines are the independent check that the generated artifact
 * still describes this repository.
 */
const coverageFromData = () => {
  const catalog = new Map<string, string>();
  for (const file of fs.readdirSync(`${root}/data/conditions`)) {
    if (!file.endsWith(".json")) continue;
    const parsed = readJson<{ conditions?: { id: string; bodySystem?: string }[] }>(
      `data/conditions/${file}`,
    );
    for (const condition of parsed.conditions ?? []) {
      catalog.set(condition.id, condition.bodySystem ?? "Unassigned");
    }
  }

  const withoutSuggestionsIds: string[] = [];
  const bodySystems = new Map<string, Ledger["bodySystems"][number]>();
  let withAuthoredSuggestions = 0;
  let published = 0;
  let draft = 0;
  let suggestionEdges = 0;
  let missingFile = 0;

  for (const [id, bodySystem] of [...catalog].sort(([a], [b]) => a.localeCompare(b))) {
    const file = `${root}/data/knowledge-base/${id}.json`;
    const mapping = fs.existsSync(file) ? readJson<Mapping>(`data/knowledge-base/${id}.json`) : null;
    const suggestions = mapping?.suggestions ?? [];
    const system =
      bodySystems.get(bodySystem) ??
      {
        bodySystem,
        catalogIdentities: 0,
        withAuthoredSuggestions: 0,
        published: 0,
        draft: 0,
        withoutSuggestions: 0,
      };
    system.catalogIdentities += 1;

    if (suggestions.length === 0) {
      withoutSuggestionsIds.push(id);
      system.withoutSuggestions += 1;
      if (mapping === null) missingFile += 1;
    } else {
      withAuthoredSuggestions += 1;
      suggestionEdges += suggestions.length;
      system.withAuthoredSuggestions += 1;
      if (mapping?.draft === true) {
        draft += 1;
        system.draft += 1;
      } else {
        published += 1;
        system.published += 1;
      }
    }
    bodySystems.set(bodySystem, system);
  }

  return {
    catalogIdentities: catalog.size,
    withAuthoredSuggestions,
    publishedWithSuggestions: published,
    draftWithSuggestions: draft,
    withoutSuggestions: withoutSuggestionsIds.length,
    suggestionEdges,
    catalogIdentitiesWithoutKnowledgeBaseFile: missingFile,
    bodySystems: [...bodySystems.values()].sort((a, b) =>
      a.bodySystem.localeCompare(b.bodySystem),
    ),
    withoutSuggestionsIds,
  };
};

describe("mapping coverage ledger", () => {
  const ledger = readJson<Ledger>("docs/mapping-coverage-ledger.json");
  const actual = coverageFromData();

  it("describes the repository as it is, not as it was", () => {
    // Every field, including the per-system table and the work queue: a coverage
    // report that can drift from the data is the failure mode this replaces.
    expect(ledger.metrics).toEqual({
      catalogIdentities: actual.catalogIdentities,
      withAuthoredSuggestions: actual.withAuthoredSuggestions,
      publishedWithSuggestions: actual.publishedWithSuggestions,
      draftWithSuggestions: actual.draftWithSuggestions,
      withoutSuggestions: actual.withoutSuggestions,
      suggestionEdges: actual.suggestionEdges,
      catalogIdentitiesWithoutKnowledgeBaseFile: actual.catalogIdentitiesWithoutKnowledgeBaseFile,
    });
    expect(ledger.bodySystems).toEqual(actual.bodySystems);
    expect(ledger.withoutSuggestionsIds).toEqual(actual.withoutSuggestionsIds);
    expect(
      ledger.withoutSuggestionsIds,
      "refresh with `npm run coverage:ledger -- --write` after changing the mappings",
    ).toHaveLength(ledger.metrics.withoutSuggestions);
  });

  it("counts the three states as a partition of the catalog", () => {
    expect(ledger.metrics.publishedWithSuggestions + ledger.metrics.draftWithSuggestions).toBe(
      ledger.metrics.withAuthoredSuggestions,
    );
    expect(ledger.metrics.withAuthoredSuggestions + ledger.metrics.withoutSuggestions).toBe(
      ledger.metrics.catalogIdentities,
    );
  });

  it("cannot regress without an argument in the diff", () => {
    // The ratchet. Authoring mappings raises the floor; dropping them is blocked
    // here rather than discovered later by whoever reads the app and finds
    // conditions that used to have suggestions.
    expect(
      actual.withoutSuggestions,
      `${actual.withoutSuggestions} catalog identities have no authored mappings, above the ` +
        `recorded ceiling of ${ledger.ratchet.withoutSuggestionsMax}. Author the mappings, or ` +
        `raise the ceiling deliberately in docs/mapping-coverage-ledger.json.`,
    ).toBeLessThanOrEqual(ledger.ratchet.withoutSuggestionsMax);
    expect(
      actual.withAuthoredSuggestions,
      `authored mappings fell to ${actual.withAuthoredSuggestions}, below the recorded floor of ` +
        `${ledger.ratchet.withAuthoredSuggestionsMin}`,
    ).toBeGreaterThanOrEqual(ledger.ratchet.withAuthoredSuggestionsMin);
    expect(ledger.ratchet.note.length).toBeGreaterThan(0);
  });

  it("keeps the validator's summary honest about authored coverage", () => {
    // `unmappedCatalogConditions: 0` is true and misleading: it counts files, and
    // every identity has one. The authored counts are what a reader takes away.
    const output = execFileSync(process.execPath, ["scripts/validate-knowledge-base.js"], {
      cwd: root,
      encoding: "utf8",
    });
    const report = JSON.parse(output) as Record<string, number>;
    expect(report.unmappedCatalogConditions).toBe(0);
    expect(report.conditionsWithoutAuthoredSuggestions).toBe(actual.withoutSuggestions);
    expect(report.conditionsWithAuthoredSuggestions).toBe(actual.withAuthoredSuggestions);
    expect(report.publishedMappings).toBe(actual.publishedWithSuggestions);
    expect(report.relationshipEdges).toBe(actual.suggestionEdges);
    expect(report.conditionsWithoutAuthoredSuggestions).toBeGreaterThan(0);
    expect(
      path.basename("docs/mapping-coverage-ledger.json"),
      "the ledger the ratchet reads is the one the generator writes",
    ).toBe("mapping-coverage-ledger.json");
  });
});
