import fs from "node:fs";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readJson = <T>(relativePath: string): T =>
  JSON.parse(fs.readFileSync(`${root}/${relativePath}`, "utf8")) as T;

type SourceReference = { verified?: boolean };
type Suggestion = { sourceReferences?: SourceReference[] };
type Mapping = { draft: boolean; suggestions?: Suggestion[] };

describe("all-94 citation verification current state", () => {
  it("keeps the approved citation promotion separate from mapping publication", () => {
    const relationships = readJson<{
      currentState: string;
      counts: { relationships: number; explicitPublicationGuards: number; legacyRationaleBoundaries: number };
    }>("data/evidence/master-relationships.json");
    const sources = readJson<{
      currentState: string;
      counts: {
        liveSourceReferenceUses: number;
        activeSourceEntities: number;
        pendingVerificationSourceEntities: number;
        activeClinicalSourceEntities: number;
        pendingClinicalSourceEntities: number;
        totalSourceEntitiesIncludingLineage: number;
      };
    }>("data/evidence/master-sources.json");
    const mappings = fs.readdirSync(`${root}/data/knowledge-base`)
      .filter((name) => name.endsWith(".json"))
      .map((name) => readJson<Mapping>(`data/knowledge-base/${name}`));
    const references = mappings.flatMap((mapping) =>
      (mapping.suggestions ?? []).flatMap((suggestion) => suggestion.sourceReferences ?? []),
    );

    expect(relationships.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(sources.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(relationships.counts).toEqual({
      relationships: 724,
      explicitPublicationGuards: 650,
      legacyRationaleBoundaries: 74,
    });
    expect(sources.counts).toMatchObject({
      liveSourceReferenceUses: 1279,
      activeSourceEntities: 346,
      pendingVerificationSourceEntities: 794,
      activeClinicalSourceEntities: 345,
      pendingClinicalSourceEntities: 794,
      totalSourceEntitiesIncludingLineage: 1149,
    });
    expect(references).toHaveLength(1279);
    expect(references.filter((reference) => reference.verified === true)).toHaveLength(383);
    expect(references.filter((reference) => reference.verified !== true)).toHaveLength(896);
    expect(mappings).toHaveLength(813);
    expect(mappings.filter((mapping) => mapping.draft === false)).toHaveLength(140);
    expect(mappings.filter((mapping) => mapping.draft === true)).toHaveLength(673);
  });
});
