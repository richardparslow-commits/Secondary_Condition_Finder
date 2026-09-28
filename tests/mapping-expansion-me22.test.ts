import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type SourceReference = { citation?: string; verified: boolean; verificationScope?: string };
type Suggestion = {
  conditionId: string;
  rank: number;
  nexusClaim?: { nexusClassification: string };
  evidentiaryProfile?: { etiologicalConsensus: string };
  causalMechanism?: { hypothesizedOnly?: boolean };
  pathwayIntelligence?: unknown;
  sourceReferences: SourceReference[];
};
type Mapping = { draft: boolean; suggestions: Suggestion[] };
type RelationshipRecord = {
  relationshipId: string;
  primaryPublicationState: string;
  rank: number;
  publicationGuard: { structuredGuardText: string };
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
    primaryId: "transient-ischemic-attack-residuals",
    targetId: "cerebrovascular-accident-stroke-residuals",
    pmid: "18071162",
    guard: "separately established later cerebrovascular accident/stroke with objective residuals"
  },
  {
    primaryId: "testicular-torsion",
    targetId: "testicular-atrophy",
    pmid: "26509312",
    guard: "separately documented later ipsilateral testicular atrophy or objective volume loss"
  },
  {
    primaryId: "lichen-sclerosus",
    targetId: "squamous-cell-carcinoma",
    pmid: "32089333",
    guard: "biopsy-documented anogenital lichen sclerosus, separately established anogenital squamous-cell carcinoma, and compatible chronology"
  },
  {
    primaryId: "nasal-polyps",
    targetId: "asthma",
    pmid: "33065369",
    guard: "documented chronic rhinosinusitis with nasal polyps, separately established asthma by appropriate pulmonary criteria, and compatible chronology"
  },
  {
    primaryId: "diabetic-gastroparesis",
    targetId: "gastroparesis",
    pmid: "31081877",
    guard: "separately established gastroparesis using compatible objective gastric-emptying evaluation, and compatible chronology"
  },
];
const load = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

describe("Mapping Expansion ME-22 local implementation", () => {
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
    expect(relationships.counts).toEqual({ relationships: 864, explicitPublicationGuards: 790, legacyRationaleBoundaries: 74 });
    expect(sources.baselineCommit).toBe("ea005e50ccbc30800dd46f3872f764f98e977c1f");
    expect(sources.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(sources.counts).toMatchObject({ liveSourceReferenceUses: 1674, pendingVerificationSourceEntities: 1112, totalSourceEntitiesIncludingLineage: 1467, });
    for (const row of rows) {
      const relationship = relationships.relationships.find((item) => item.relationshipId === `rel-${row.primaryId}-to-${row.targetId}`);
      expect(relationship?.primaryPublicationState).toBe("draft");
      expect(relationship?.rank).toBe(1);
      expect(relationship?.publicationGuard.structuredGuardText).toContain(row.guard);
      const source = sources.sources.find((item) => item.sourceId === `pmid-${row.pmid}`);
      expect(source).toMatchObject({ status: "active", verified: true });
    }
  });

  it("pins the ME-22 pre-citation-verification aggregate state", () => {
    const files = fs.readdirSync(path.join(ROOT, "data/knowledge-base")).filter((file) => file.endsWith(".json"));
    const mappings = files.map((file) => load<Mapping>(path.join(ROOT, "data/knowledge-base", file)));
    const references = mappings.flatMap((mapping) => mapping.suggestions.flatMap((suggestion) => suggestion.sourceReferences));
    expect(files).toHaveLength(814);
    expect(mappings.reduce((total, mapping) => total + mapping.suggestions.length, 0)).toBe(864);
    expect(mappings.filter((mapping) => mapping.draft === false)).toHaveLength(140);
    expect(mappings.filter((mapping) => mapping.draft === true && mapping.suggestions.length === 1)).toHaveLength(305);
expect(references).toHaveLength(1674);
    expect(references.filter((reference) => reference.verified === true)).toHaveLength(384);
expect(references.filter((r) => r.verified === false)).toHaveLength(1290);
  });
});
