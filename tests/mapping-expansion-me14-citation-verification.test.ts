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
    "primaryId": "hidradenitis-suppurativa",
    "targetId": "depressive-disorder",
    "pmid": "40737006",
    "rank": 1,
    "guard": "Require independently established hidradenitis suppurativa before first-onset depressive disorder; do not use this proposition for depression predating hidradenitis suppurativa. Preserve obesity, smoking, substance use, socioeconomic factors, other psychiatric illness, chronic-pain burden, treatment effects, and other competing explanations. Treat this only as population-level temporal risk, not proof that hidradenitis suppurativa caused an individual depressive disorder."
  },
  {
    "primaryId": "varicose-veins",
    "targetId": "deep-vein-thrombosis",
    "pmid": "29486040",
    "rank": 1,
    "guard": "Require varicose veins preceding a newly established deep-vein thrombosis and exclude preexisting deep-vein thrombosis. Explicitly assess recent venous surgery or endovenous procedures, prior venous thromboembolism, thrombophilia, malignancy, immobilization, pregnancy or estrogen exposure, trauma or surgery, age, obesity, and other thrombotic risks. Do not publish or present this relationship as proof that varicose veins caused the deep-vein thrombosis."
  },
  {
    "primaryId": "maxillofacial-fracture",
    "targetId": "mandibular-nonunion",
    "pmid": "34314633",
    "rank": 1,
    "guard": "Apply the broader maxillofacial-fracture identity only when the documented fracture specifically involves the mandible. Require separately established mandibular nonunion after that fracture. Do not infer mandibular nonunion from another facial fracture or from uncomplicated fracture healing. Preserve open-fracture status, infection, diabetes, alcohol use, treatment delay or fixation problems, osteonecrosis, metabolic bone disease, and other causes as competing explanations."
  },
  {
    "primaryId": "nontoxic-thyroid-enlargement",
    "targetId": "hypoparathyroidism",
    "pmid": "27256349",
    "rank": 1,
    "guard": "Require multinodular nontoxic thyroid enlargement plus documented total or near-total thyroid surgery followed by separately documented postoperative hypoparathyroidism. The supported proposition is transient postoperative hypoparathyroidism; do not infer permanent hypoparathyroidism, and do not infer hypoparathyroidism from the thyroid enlargement itself. Preserve other neck surgery, autoimmune or genetic parathyroid disease, magnesium disorders, and other etiologies as competing explanations."
  },
  {
    "primaryId": "rem-sleep-disorder",
    "targetId": "parkinsons-disease",
    "pmid": "20083800",
    "rank": 1,
    "guard": "Require polysomnography-confirmed isolated or idiopathic REM sleep behavior disorder before Parkinson disease, with no Parkinsonism or dementia at the REM sleep behavior disorder baseline and a later independently established Parkinson disease diagnosis. State explicitly that REM sleep behavior disorder is a prodromal marker or risk state, not a cause of Parkinson disease, that many patients do not convert during observed follow-up, and that dementia with Lewy bodies and multiple system atrophy are alternative phenoconversion outcomes."
  }
];
const load = <T,>(file: string) => JSON.parse(fs.readFileSync(file, "utf8")) as T;

describe("Mapping Expansion ME-14 qualified-human citation verification", () => {
  it("promotes exactly the five approved ME-14 references to verified without changing mapping semantics", () => {
    for (const row of rows) {
      const mapping = load<Mapping>(path.join(ROOT, "data", "knowledge-base", `${row.primaryId}.json`));
      expect(mapping.draft).toBe(true);
      const suggestions = mapping.suggestions.filter((s) => s.conditionId === row.targetId);
      expect(suggestions).toHaveLength(1); expect(suggestions[0]!.rank).toBe(1); expect(suggestions[0]!.nexusClaim?.nexusClassification).toBeDefined(); expect(suggestions[0]!.evidentiaryProfile?.etiologicalConsensus).toBeDefined(); expect(suggestions[0]!.pathwayIntelligence).toBeUndefined();
      const refs = suggestions[0]!.sourceReferences.filter((r) => r.citation?.includes(`PMID ${row.pmid}`));
      expect(refs).toHaveLength(1); expect(refs[0]!.verified).toBe(true); expect(refs[0]!.verificationScope).toBe("clinical-evidence");
    }
  });
  it("promotes exactly the five matching master sources to active qualified-human-verified state", () => {
    const registry = load<MasterSourceRegistry>(path.join(ROOT, "data", "evidence", "master-sources.json"));
    expect(registry.baselineCommit).toBe("ea005e50ccbc30800dd46f3872f764f98e977c1f"); expect(registry.currentState).toBe("ME32-PRE-QUALIFIED-HUMAN-CITATION-VERIFICATION");
    for (const row of rows) {
      const sources = registry.sources.filter((s) => s.sourceId === `pmid-${row.pmid}`);
      expect(sources).toHaveLength(1); expect(sources[0]!.status).toBe("active"); expect(sources[0]!.verified).toBe(true);
      expect(sources[0]!.verificationState?.qualifiedHumanCitationReviewDecision).toBe("approve-as-implemented"); expect(sources[0]!.verificationState?.qualifiedHumanCitationReviewRequired).toBe(false);
    }
  });
  it("preserves relationship identities, rank 1, draft publication state, exact guards, and source linkage", () => {
    const registry = load<MasterRelationshipRegistry>(path.join(ROOT, "data", "evidence", "master-relationships.json"));
    expect(registry.baselineCommit).toBe("ea005e50ccbc30800dd46f3872f764f98e977c1f"); expect(registry.currentState).toBe("ME32-PRE-QUALIFIED-HUMAN-CITATION-VERIFICATION");
    for (const row of rows) {
      const rels = registry.relationships.filter((r) => r.relationshipId === `rel-${row.primaryId}-to-${row.targetId}`);
      expect(rels).toHaveLength(1); expect(rels[0]!.primaryPublicationState).toBe("draft"); expect(rels[0]!.rank).toBe(1); expect(rels[0]!.publicationGuard.structuredGuardText).toBe(row.guard); expect(rels[0]!.sourceIds).toContain(`pmid-${row.pmid}`);
    }
  });
});
