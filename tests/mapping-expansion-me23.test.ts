import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type SourceReference = { citation?: string; verified: boolean; verificationScope?: string };
type Suggestion = {
  conditionId: string;
  rank: number;
  nexusClaim?: { nexusClassification: string };
  evidentiaryProfile?: { etiologicalConsensus: string; vaNexusProbabilityAlignment?: string };
  causalMechanism?: { hypothesizedOnly?: boolean };
  pathwayIntelligence?: unknown;
  sourceReferences: SourceReference[];
};
type Mapping = { id: string; draft: boolean; suggestions: Suggestion[] };
type RelationshipRecord = {
  relationshipId: string;
  primaryPublicationState: string;
  rank: number;
  publicationGuard: { status: string; structuredGuardText: string };
};
type RelationshipRegistry = {
  baselineCommit: string;
  currentState: string;
  counts: { relationships: number; explicitPublicationGuards: number; legacyRationaleBoundaries: number };
  relationships: RelationshipRecord[];
};
type SourceRecord = { sourceId: string; status: string; verified: boolean };
type SourceRegistry = {
  baselineCommit: string;
  currentState: string;
  counts: { liveSourceReferenceUses: number; pendingVerificationSourceEntities: number; totalSourceEntitiesIncludingLineage: number };
  sources: SourceRecord[];
};

const ROOT = process.cwd();
const rows = [
  {
    primaryId: "cholesteatoma",
    targetId: "conductive-hearing-loss",
    pmid: "22410730",
    guard: "Require documented cholesteatoma, objective conductive loss, compatible ear/chronology, and ossicular review; do not infer loss from cholesteatoma alone.",
  },
  {
    primaryId: "otitis-media",
    targetId: "hearing-loss",
    pmid: "22558393",
    guard: "Require documented otitis media, objective hearing loss, compatible ear/chronology, and competing-cause review.",
  },
  {
    primaryId: "acoustic-neuroma",
    targetId: "hearing-loss",
    pmid: "37024333",
    guard: "Require documented vestibular schwannoma, objective hearing loss, compatible laterality/chronology, and tumor/treatment review; do not infer loss from tumor history alone.",
  },
  {
    primaryId: "actinic-keratosis",
    targetId: "squamous-cell-carcinoma",
    pmid: "23647091",
    guard: "Require documented actinic keratosis and cutaneous SCC with compatible site/chronology and pathology review; do not infer carcinoma from a lesion or treatment history alone.",
  },
  {
    primaryId: "abdominal-migraine",
    targetId: "migraine-headaches",
    pmid: "29459383",
    guard: "Require documented abdominal migraine, separate migraine-headache diagnosis, compatible chronology/phenotype, and competing-cause review; do not infer headache migraine from abdominal pain alone.",
  },
] as const;
const load = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

describe("Mapping Expansion ME-23 local implementation", () => {
  it("adds five bounded draft relationships with pending clinical citations", () => {
    for (const row of rows) {
      const mapping = load<Mapping>(path.join(ROOT, "data/knowledge-base", `${row.primaryId}.json`));
      expect(mapping.draft).toBe(true);
      const hits = mapping.suggestions.filter((suggestion) => suggestion.conditionId === row.targetId);
      expect(hits).toHaveLength(1);
      expect(hits[0]!.rank).toBe(1);
      expect(hits[0]!.nexusClaim?.nexusClassification).toBe("ASSOCIATION_ONLY");
      expect(hits[0]!.causalMechanism?.hypothesizedOnly).toBe(true);
      expect(hits[0]!.evidentiaryProfile?.etiologicalConsensus).toBe("NOT_ESTABLISHED");
      expect(hits[0]!.evidentiaryProfile?.vaNexusProbabilityAlignment).toBe("NOT_ASSERTED");
      expect(hits[0]!.pathwayIntelligence).toBeUndefined();
      expect(hits[0]!.sourceReferences).toHaveLength(1);
      expect(hits[0]!.sourceReferences[0]!.citation).toContain(`PMID ${row.pmid}`);
      expect(hits[0]!.sourceReferences[0]!.verified).toBe(true);
      expect(hits[0]!.sourceReferences[0]!.verificationScope).toBe("clinical-evidence");
    }
  });

  it("records the five explicit guards and pending source entities", () => {
    const relationships = load<RelationshipRegistry>(path.join(ROOT, "data/evidence/master-relationships.json"));
    const sources = load<SourceRegistry>(path.join(ROOT, "data/evidence/master-sources.json"));
    expect(relationships.baselineCommit).toBe("ea005e50ccbc30800dd46f3872f764f98e977c1f");
    expect(relationships.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(relationships.counts).toEqual({ relationships: 863, explicitPublicationGuards: 789, legacyRationaleBoundaries: 74 });
    expect(sources.baselineCommit).toBe("ea005e50ccbc30800dd46f3872f764f98e977c1f");
    expect(sources.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(sources.counts).toMatchObject({ liveSourceReferenceUses: 1672, pendingVerificationSourceEntities: 1110, totalSourceEntitiesIncludingLineage: 1465, });
    for (const row of rows) {
      const relationship = relationships.relationships.find((item) => item.relationshipId === `rel-${row.primaryId}-to-${row.targetId}`);
      expect(relationship?.primaryPublicationState).toBe("draft");
      expect(relationship?.rank).toBe(1);
      expect(relationship?.publicationGuard).toMatchObject({ status: "explicit", structuredGuardText: row.guard });
      const source = sources.sources.find((item) => item.sourceId === `pmid-${row.pmid}`);
      expect(source).toMatchObject({ status: "active", verified: true });
    }
  });

  it("pins the ME-23 pre-citation-verification aggregate state", () => {
    const files = fs.readdirSync(path.join(ROOT, "data/knowledge-base")).filter((file) => file.endsWith(".json"));
    const mappings = files.map((file) => load<Mapping>(path.join(ROOT, "data/knowledge-base", file)));
    const references = mappings.flatMap((mapping) => mapping.suggestions.flatMap((suggestion) => suggestion.sourceReferences));
    expect(files).toHaveLength(814);
    expect(mappings.reduce((total, mapping) => total + mapping.suggestions.length, 0)).toBe(863);
    expect(mappings.filter((mapping) => mapping.draft === false)).toHaveLength(140);
    expect(mappings.filter((mapping) => mapping.draft === true && mapping.suggestions.length === 1)).toHaveLength(305);
expect(references).toHaveLength(1672);
    expect(references.filter((reference) => reference.verified === true)).toHaveLength(384);
expect(references.filter((r) => r.verified === false)).toHaveLength(1288);
  });
});
