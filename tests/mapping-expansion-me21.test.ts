import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type SourceReference = { citation?: string; verified: boolean; verificationScope?: string };
type Suggestion = { conditionId: string; rank: number; nexusClaim?: { nexusClassification: string }; evidentiaryProfile?: { etiologicalConsensus: string }; causalMechanism?: { hypothesizedOnly?: boolean }; pathwayIntelligence?: unknown; sourceReferences: SourceReference[] };
type Mapping = { draft: boolean; suggestions: Suggestion[] };
type RelationshipRecord = { relationshipId: string; primaryPublicationState: string; rank: number; publicationGuard: { structuredGuardText: string } };
type RelationshipRegistry = { baselineCommit: string; currentState: string; counts: { relationships: number; explicitPublicationGuards: number; legacyRationaleBoundaries: number }; relationships: RelationshipRecord[] };
type SourceRecord = { sourceId: string; status: string; verified: boolean };
type SourceRegistry = { baselineCommit: string; currentState: string; counts: { liveSourceReferenceUses: number; pendingVerificationSourceEntities: number; totalSourceEntitiesIncludingLineage: number }; sources: SourceRecord[] };

const ROOT = process.cwd();
const rows = [
  {
    primaryId: "peptic-ulcer-disease",
    targetId: "anemia",
    pmid: "7942718",
    guard: "Require documented peptic-ulcer disease with bleeding or other clinically relevant iron loss and separately established iron-deficiency anemia with compatible chronology; the cohort identifies an upper gastrointestinal source in selected patients but does not establish that any individual's anemia was caused by peptic-ulcer disease. Preserve gastrointestinal malignancy, other gastrointestinal bleeding, malabsorption, dietary deficiency, chronic inflammatory disease, renal disease, hemolysis, medications, and other causes of anemia. Do not infer anemia from a peptic-ulcer diagnosis without objective hematologic evidence or compatible bleeding history."
  },
  {
    primaryId: "eosinophilic-esophagitis",
    targetId: "dysphagia",
    pmid: "34609446",
    guard: "Require biopsy-confirmed eosinophilic esophagitis and separately documented dysphagia with compatible chronology; the review describes a recognized clinical manifestation but does not establish that every individual's dysphagia is attributable to eosinophilic esophagitis or exclude structural, motility, neurologic, medication-related, or functional causes. Preserve peptic stricture, malignancy, achalasia and other motility disorders, reflux-related disease, neurologic disease, medication injury, and functional dysphagia as competing explanations. Do not infer eosinophilic esophagitis from dysphagia alone or from atopy without appropriate diagnostic evaluation."
  },
  {
    primaryId: "cholelithiasis",
    targetId: "pancreatitis",
    pmid: "24679420",
    guard: "Require documented cholelithiasis or gallstone migration and separately established acute pancreatitis with compatible chronology and diagnostic findings; gallstones are a recognized cause at the population level but the review does not establish that any individual's pancreatitis was biliary in origin. Preserve alcohol, hypertriglyceridemia, medications, hypercalcemia, structural or genetic disease, trauma, autoimmune disease, malignancy, and other pancreatitis etiologies. Do not infer pancreatitis from cholelithiasis without objective pancreatic evidence or infer biliary attribution from abdominal pain alone."
  },
  {
    primaryId: "insulin-resistance-syndrome",
    targetId: "diabetes-mellitus-type-2",
    pmid: "12231073",
    guard: "Require a clinically established insulin-resistance syndrome phenotype and separately diagnosed type 2 diabetes with compatible chronology; the review addresses a central pathophysiologic component but does not establish that insulin resistance alone caused any individual's diabetes or that all insulin-resistant phenotypes progress to diabetes. Preserve beta-cell dysfunction, genetic susceptibility, obesity and adiposity, medications, endocrine disease, pancreatic disease, secondary diabetes, and other metabolic contributors. Do not infer type 2 diabetes from insulin resistance markers alone."
  },
  {
    primaryId: "metabolic-syndrome",
    targetId: "diabetes-mellitus-type-2",
    pmid: "24843675",
    guard: "Require an established metabolic-syndrome phenotype and separately diagnosed type 2 diabetes with compatible chronology; the review supports population-level risk prediction but does not establish that metabolic syndrome caused any individual's diabetes. Preserve the syndrome's component overlap with diabetes, beta-cell dysfunction, genetic susceptibility, adiposity, medications, endocrine disease, pancreatic disease, and other diabetes etiologies. Do not infer type 2 diabetes from a metabolic-syndrome label or its individual components alone."
  },
];
const load = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

describe("Mapping Expansion ME-21 local implementation", () => {
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
    expect(relationships.counts).toEqual({ relationships: 646, explicitPublicationGuards: 572, legacyRationaleBoundaries: 74 });
    expect(sources.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(sources.counts).toMatchObject({ liveSourceReferenceUses: 1101, pendingVerificationSourceEntities: 653, totalSourceEntitiesIncludingLineage: 1008, });
    for (const row of rows) {
      const relationship = relationships.relationships.find((item) => item.relationshipId === `rel-${row.primaryId}-to-${row.targetId}`);
      expect(relationship?.primaryPublicationState).toBe("draft");
      expect(relationship?.rank).toBe(1);
      expect(relationship?.publicationGuard.structuredGuardText).toBe(row.guard);
      const source = sources.sources.find((item) => item.sourceId === `pmid-${row.pmid}`);
      expect(source).toMatchObject({ status: "active", verified: true });
    }
  });

  it("pins the ME-21 pre-citation-verification aggregate state", () => {
    const files = fs.readdirSync(path.join(ROOT, "data/knowledge-base")).filter((file) => file.endsWith(".json"));
    const mappings = files.map((file) => load<Mapping>(path.join(ROOT, "data/knowledge-base", file)));
    const references = mappings.flatMap((mapping) => mapping.suggestions.flatMap((suggestion) => suggestion.sourceReferences));
    expect(files).toHaveLength(813);
    expect(mappings.reduce((total, mapping) => total + mapping.suggestions.length, 0)).toBe(646);
    expect(mappings.filter((mapping) => mapping.draft === false)).toHaveLength(140);
    expect(mappings.filter((mapping) => mapping.draft === true && mapping.suggestions.length === 1)).toHaveLength(267);
expect(references).toHaveLength(1101);
    expect(references.filter((reference) => reference.verified === true)).toHaveLength(383);
expect(references.filter((r) => r.verified === false)).toHaveLength(718);
  });
});
