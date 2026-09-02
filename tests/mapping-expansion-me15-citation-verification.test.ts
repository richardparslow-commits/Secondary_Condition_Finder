import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type SourceReference = { citation?: string; verified: boolean; verificationScope?: string };
type Suggestion = { conditionId: string; rank: number; nexusClaim: { nexusClassification: string; } | undefined;
  evidentiaryProfile: { etiologicalConsensus: string; } | undefined; pathwayIntelligence?: unknown; sourceReferences: SourceReference[] };
type Mapping = { draft: boolean; suggestions: Suggestion[] };
type MasterSource = { sourceId: string; status: string; verified: boolean; verificationState?: { qualifiedHumanCitationReviewDecision?: string; qualifiedHumanCitationReviewRequired?: boolean } };
type MasterSourceRegistry = { baselineCommit: string; currentState: string; sources: MasterSource[] };
type MasterRelationship = { relationshipId: string; primaryPublicationState: string; rank: number; publicationGuard: { structuredGuardText: string }; sourceIds: string[] };
type MasterRelationshipRegistry = { baselineCommit: string; currentState: string; relationships: MasterRelationship[] };
const ROOT = process.cwd();
const rows = [
  {
    "primaryId": "anxiety-disorder",
    "targetId": "depressive-disorder",
    "pmid": "17548747",
    "rank": 1,
    "guard": "Require independently established generalized anxiety disorder and separately established major depressive disorder. The cited prospective birth cohort found cumulative and roughly symmetric sequential comorbidity, with depression onset first, anxiety onset first, and concurrent onset each occurring in about one third of comorbid cases; do not treat either disorder as reliably primary in onset order. Preserve other psychiatric illness, substance use, medical illness, medications, psychosocial stressors, and shared vulnerability as competing explanations. Treat this only as population-level comorbidity association, not proof that generalized anxiety disorder caused an individual's depressive disorder."
  },
  {
    "primaryId": "panic-disorder",
    "targetId": "agoraphobia",
    "pmid": "16585471",
    "rank": 1,
    "guard": "Require independently documented panic disorder and separately established agoraphobia; under DSM-5 these are distinct diagnoses and agoraphobia must not be inferred from panic attacks or panic disorder alone. The cited nationally representative survey found that most lifetime panic disorder cases did not carry agoraphobia; do not present co-occurrence as inevitable progression. Preserve other anxiety disorders, depressive disorders, substance use, medical causes of episodic symptoms, and avoidance attributable to other conditions as competing explanations. Treat this only as population-level co-occurrence risk, not proof that panic disorder caused an individual's agoraphobia."
  },
  {
    "primaryId": "ocd",
    "targetId": "depressive-disorder",
    "pmid": "18725912",
    "rank": 2,
    "guard": "Require independently established obsessive-compulsive disorder and separately established depressive disorder; the cited nationally representative survey reported substantial comorbidity of OCD with mood disorders as a class and does not establish onset order or direction. Preserve other anxiety disorders, substance use, medical illness, medications, and shared vulnerability as competing explanations. Do not infer a depressive disorder from OCD symptoms or distress alone, and do not treat this population-level association as proof that OCD caused an individual's depressive disorder."
  },
  {
    "primaryId": "binge-eating-disorder",
    "targetId": "depressive-disorder",
    "pmid": "16815322",
    "rank": 1,
    "guard": "Require independently established binge eating disorder and separately established depressive disorder; the cited nationally representative survey found eating disorders significantly comorbid with many other DSM-IV disorders without establishing direction of onset. Preserve obesity and metabolic disease, other eating pathology, substance use, medications, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from binge eating symptoms, weight change, or role impairment alone, and do not treat this population-level association as proof that binge eating disorder caused an individual's depressive disorder."
  },
  {
    "primaryId": "bipolar-disorder",
    "targetId": "anxiety-disorder",
    "pmid": "17485606",
    "rank": 1,
    "guard": "Require independently established bipolar disorder and a separately established anxiety disorder diagnosis; the cited nationally representative survey reported lifetime comorbidity of bipolar spectrum disorder with other Axis I disorders, particularly anxiety disorders as a class, and does not specify onset order or direction. Distinguish an independent anxiety disorder from anxiety symptoms occurring within manic, hypomanic, or depressive episodes. Preserve substance use, medical illness, medications, and other psychiatric illness as competing explanations. Treat this only as population-level comorbidity association, not proof that bipolar disorder caused an individual's anxiety disorder."
  }
];
const load = <T,>(file: string) => JSON.parse(fs.readFileSync(file, "utf8")) as T;

describe("Mapping Expansion ME-15 qualified-human citation verification", () => {
  it("promotes exactly the five approved ME-15 references to verified without changing mapping semantics", () => {
    for (const row of rows) {
      const mapping = load<Mapping>(path.join(ROOT, "data", "knowledge-base", `${row.primaryId}.json`));
      expect(mapping.draft).toBe(true);
      const suggestions = mapping.suggestions.filter((s) => s.conditionId === row.targetId);
      expect(suggestions).toHaveLength(1); expect(suggestions[0]!.rank).toBe(row.rank); expect(suggestions[0]!.nexusClaim?.nexusClassification).toBeDefined(); expect(suggestions[0]!.evidentiaryProfile?.etiologicalConsensus).toBeDefined(); expect(suggestions[0]!.pathwayIntelligence).toBeUndefined();
      const refs = suggestions[0]!.sourceReferences.filter((r) => r.citation?.includes(`PMID ${row.pmid}`));
      expect(refs).toHaveLength(1); expect(refs[0]!.verified).toBe(true); expect(refs[0]!.verificationScope).toBe("clinical-evidence");
    }
  });
  it("promotes exactly the five matching master sources to active qualified-human-verified state", () => {
    const registry = load<MasterSourceRegistry>(path.join(ROOT, "data", "evidence", "master-sources.json"));
    expect(registry.baselineCommit).toBe("f4537b5014297c8e1c783a1b38291367636c418a"); expect(registry.currentState).toBe("ME19-PRE-QUALIFIED-HUMAN-CITATION-VERIFICATION");
    for (const row of rows) {
      const sources = registry.sources.filter((s) => s.sourceId === `pmid-${row.pmid}`);
      expect(sources).toHaveLength(1); expect(sources[0]!.status).toBe("active"); expect(sources[0]!.verified).toBe(true);
      expect(sources[0]!.verificationState?.qualifiedHumanCitationReviewDecision).toBe("approve-as-implemented"); expect(sources[0]!.verificationState?.qualifiedHumanCitationReviewRequired).toBe(false);
    }
  });
  it("preserves relationship identities, exact ranks, draft publication state, exact guards, and source linkage", () => {
    const registry = load<MasterRelationshipRegistry>(path.join(ROOT, "data", "evidence", "master-relationships.json"));
    expect(registry.baselineCommit).toBe("f4537b5014297c8e1c783a1b38291367636c418a"); expect(registry.currentState).toBe("ME19-PRE-QUALIFIED-HUMAN-CITATION-VERIFICATION");
    for (const row of rows) {
      const rels = registry.relationships.filter((r) => r.relationshipId === `rel-${row.primaryId}-to-${row.targetId}`);
      expect(rels).toHaveLength(1); expect(rels[0]!.primaryPublicationState).toBe("draft"); expect(rels[0]!.rank).toBe(row.rank); expect(rels[0]!.publicationGuard.structuredGuardText).toBe(row.guard); expect(rels[0]!.sourceIds).toContain(`pmid-${row.pmid}`);
    }
  });
});