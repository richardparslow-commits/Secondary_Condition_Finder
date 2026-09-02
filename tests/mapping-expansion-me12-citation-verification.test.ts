import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type SourceReference = { citation?: string; verified: boolean; verificationScope: string };
type Suggestion = { conditionId: string; rank: number; nexusClaim: { nexusClassification: string; } | undefined;
  evidentiaryProfile: { etiologicalConsensus: string; } | undefined; pathwayIntelligence?: unknown; sourceReferences: SourceReference[] };
type Mapping = { draft: boolean; suggestions: Suggestion[] };
type MasterSource = { sourceId: string; status: string; verified: boolean; verificationState?: { qualifiedHumanCitationReviewDecision?: string; qualifiedHumanCitationReviewRequired?: boolean } };
type MasterSourceRegistry = { sources: MasterSource[] };
type MasterRelationship = { relationshipId: string; primaryPublicationState: string; rank: number; publicationGuard: { structuredGuardText: string }; sourceIds: string[] };
type MasterRelationshipRegistry = { relationships: MasterRelationship[] };
const ROOT = process.cwd();
const rows = [
  {
    "primaryId": "pulmonary-embolism",
    "targetId": "pulmonary-hypertension",
    "pmid": "35081846",
    "rank": 1,
    "guard": "Restrict the broad pulmonary-hypertension target to separately established chronic thromboembolic pulmonary hypertension after a documented pulmonary embolism. Require persistent mismatched perfusion or chronic thromboembolic/fibrotic obstruction after an appropriate post-PE anticoagulation interval and hemodynamically confirmed pulmonary hypertension under accepted criteria. Do not infer CTEPH from acute PE, persistent dyspnea, hypoxemia, or an echocardiographic estimate alone. Preserve left-heart disease, other lung disease or hypoxia, chronic thromboembolic disease without pulmonary hypertension, drugs/toxins, and other pulmonary-hypertension etiologies as competing explanations."
  },
  {
    "primaryId": "subdural-hematoma",
    "targetId": "seizure-disorder",
    "pmid": "27914224",
    "rank": 1,
    "guard": "Require objectively documented subdural hematoma and separately established epileptic seizures or a seizure disorder with compatible chronology. Do not infer a chronic seizure disorder from prophylactic antiseizure medication, transient altered mental status, or an unconfirmed spell. Distinguish an isolated acute symptomatic seizure from recurrent unprovoked seizures or epilepsy when the target diagnosis requires that distinction. Preserve pre-existing epilepsy, additional traumatic brain injury, stroke, infection, metabolic or toxic disturbance, medication or substance effects, and other seizure etiologies."
  },
  {
    "primaryId": "multiple-sclerosis",
    "targetId": "optic-neuritis",
    "pmid": "36135184",
    "rank": 1,
    "guard": "Require established multiple sclerosis and a separately diagnosed optic-neuritis phenotype compatible with inflammatory demyelinating optic neuropathy. Do not infer optic neuritis from nonspecific visual loss, eye pain, abnormal imaging, or multiple-sclerosis diagnosis alone. Preserve neuromyelitis optica spectrum disorder, MOG-antibody disease, ischemic, infectious, compressive, toxic/nutritional, hereditary, and other optic-neuropathy causes."
  },
  {
    "primaryId": "hodgkins-lymphoma",
    "targetId": "hypothyroidism",
    "pmid": "29681481",
    "rank": 1,
    "guard": "Require documented Hodgkin lymphoma, documented thyroid-exposing neck or supradiaphragmatic radiation treatment consistent with the source phenotype, and separately established hypothyroidism after treatment with compatible chronology. Do not infer hypothyroidism from Hodgkin lymphoma or chemotherapy alone. Preserve autoimmune thyroid disease, thyroid surgery or radioiodine, medications, pituitary or hypothalamic disease, congenital thyroid disease, and other causes of hypothyroidism."
  },
  {
    "primaryId": "reactive-arthritis",
    "targetId": "uveitis",
    "pmid": "34528623",
    "rank": 1,
    "guard": "Require established reactive arthritis and separately documented anterior uveitis by appropriate ophthalmic evaluation. Do not infer uveitis from reactive arthritis, conjunctivitis, red eye, ocular irritation, or photophobia alone. Preserve infectious uveitis, HLA-B27-associated uveitis from another spondyloarthritis, sarcoidosis, inflammatory bowel disease, medication-related disease, trauma, and other ocular inflammatory causes."
  }
];
const load = <T,>(file: string) => JSON.parse(fs.readFileSync(file, "utf8")) as T;

describe("Mapping Expansion ME-12 qualified-human citation verification", () => {
  it("promotes exactly the five approved ME-12 references to verified without changing mapping semantics", () => {
    for (const row of rows) {
      const mapping = load<Mapping>(path.join(ROOT, "data", "knowledge-base", `${row.primaryId}.json`));
      expect(mapping.draft).toBe(true);
      const suggestions = mapping.suggestions.filter((s) => s.conditionId === row.targetId);
      expect(suggestions).toHaveLength(1);
      const suggestion = suggestions[0]!;
      expect(suggestion.rank).toBe(1);
      expect(suggestion.nexusClaim?.nexusClassification).toBeDefined(); expect(suggestion.evidentiaryProfile?.etiologicalConsensus).toBeDefined();
      expect(suggestion.pathwayIntelligence).toBeUndefined();
      const refs = suggestion.sourceReferences.filter((r) => r.citation?.includes(`PMID ${row.pmid}`));
      expect(refs).toHaveLength(1);
      const ref = refs[0]!;
      expect(ref.verified).toBe(true);
      expect(ref.verificationScope).toBe("clinical-evidence");
    }
  });

  it("promotes exactly the five matching master sources to active qualified-human-verified state", () => {
    const registry = load<MasterSourceRegistry>(path.join(ROOT, "data", "evidence", "master-sources.json"));
    for (const row of rows) {
      const sources = registry.sources.filter((s) => s.sourceId === `pmid-${row.pmid}`);
      expect(sources).toHaveLength(1);
      const source = sources[0]!;
      expect(source.status).toBe("active");
      expect(source.verified).toBe(true);
      expect(source.verificationState?.qualifiedHumanCitationReviewDecision).toBe("approve-as-implemented");
      expect(source.verificationState?.qualifiedHumanCitationReviewRequired).toBe(false);
    }
  });

  it("preserves the five relationship identities, rank-1 amendment, draft publication state, and exact guards", () => {
    const registry = load<MasterRelationshipRegistry>(path.join(ROOT, "data", "evidence", "master-relationships.json"));
    for (const row of rows) {
      const rels = registry.relationships.filter((r) => r.relationshipId === `rel-${row.primaryId}-to-${row.targetId}`);
      expect(rels).toHaveLength(1);
      const rel = rels[0]!;
      expect(rel.primaryPublicationState).toBe("draft");
      expect(rel.rank).toBe(1);
      expect(rel.publicationGuard.structuredGuardText).toBe(row.guard);
      expect(rel.sourceIds).toContain(`pmid-${row.pmid}`);
    }
  });
});
