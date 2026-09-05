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

    expect(relationships.currentState).toBe("ME35-CITATION-VERIFIED");
    expect(sources.currentState).toBe("ME35-CITATION-VERIFIED");
    expect(relationships.counts).toEqual({
      relationships: 347,
      explicitPublicationGuards: 273,
      legacyRationaleBoundaries: 74,
    });
    expect(sources.counts).toMatchObject({
      liveSourceReferenceUses: 355,
      activeSourceEntities: 329,
      pendingVerificationSourceEntities: 0,
      activeClinicalSourceEntities: 328,
      pendingClinicalSourceEntities: 0,
      totalSourceEntitiesIncludingLineage: 338,
    });
    expect(references).toHaveLength(355);
    expect(references.filter((reference) => reference.verified === true)).toHaveLength(355);
    expect(references.filter((reference) => reference.verified !== true)).toHaveLength(0);
    expect(mappings).toHaveLength(813);
    expect(mappings.filter((mapping) => mapping.draft === false)).toHaveLength(139);
    expect(mappings.filter((mapping) => mapping.draft === true)).toHaveLength(674);
  });
});
