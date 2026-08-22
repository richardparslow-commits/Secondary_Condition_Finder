import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type SourceReference = { citation?: string; verified: boolean; verificationScope: string };
type Suggestion = { conditionId: string; rank: number; prevalence: string; pathwayIntelligence?: unknown; sourceReferences: SourceReference[] };
type Mapping = { draft: boolean; suggestions: Suggestion[] };
type MasterSource = { sourceId: string; status: string; verified: boolean; verificationState?: { qualifiedHumanCitationReviewDecision?: string; qualifiedHumanCitationReviewRequired?: boolean } };
type MasterSourceRegistry = { sources: MasterSource[] };
type MasterRelationship = { relationshipId: string; primaryPublicationState: string; rank: number; publicationGuard: { structuredGuardText: string }; sourceIds: string[] };
type MasterRelationshipRegistry = { relationships: MasterRelationship[] };
const ROOT = process.cwd();
const rows = [
  {
    "primaryId": "endometrial-cancer",
    "targetId": "lymphedema",
    "pmid": "33396373",
    "rank": 1,
    "guard": "Require documented endometrial cancer, pelvic or para-aortic lymphatic-disrupting nodal treatment, and separately established lower-extremity lymphedema afterward. Do not infer lymphedema from endometrial cancer alone or from isolated edema. Preserve deep-vein thrombosis or other venous disease, cardiac or renal edema, primary lymphedema, infection, and other unrelated causes as competing explanations."
  },
  {
    "primaryId": "bladder-cancer",
    "targetId": "urinary-incontinence",
    "pmid": "39896758",
    "rank": 1,
    "guard": "Require documented bladder cancer, radical cystectomy with orthotopic neobladder reconstruction, and persistent separately established postoperative urinary incontinence. Do not infer urinary incontinence from bladder cancer alone, from an ileal conduit without the phenotype, or from transient early postoperative leakage. Preserve urinary tract infection, retention or overflow, neurologic or pelvic-floor disease, preexisting urinary incontinence, and other etiologies as competing explanations."
  },
  {
    "primaryId": "non-hodgkins-lymphoma",
    "targetId": "peripheral-neuropathy",
    "pmid": "31214762",
    "rank": 1,
    "guard": "Require documented non-Hodgkin lymphoma, a documented vincristine-containing or otherwise specifically neurotoxic lymphoma regimen, compatible chronology, and separately established peripheral neuropathy. Do not infer peripheral neuropathy from non-Hodgkin lymphoma itself. Preserve diabetic, nutritional, alcohol-related, compressive, paraproteinemic, infectious, hereditary, and other neuropathy etiologies as competing explanations."
  },
  {
    "primaryId": "fecal-incontinence",
    "targetId": "dermatitis",
    "pmid": "39836004",
    "rank": 1,
    "guard": "Require fecal incontinence with repeated or prolonged perineal skin exposure and separately diagnosed moisture-associated or incontinence-associated dermatitis in the exposed distribution. Do not generalize this relationship to eczema, fungal disease, allergic or irritant dermatitis from unrelated agents, pressure injury, cellulitis, or a nonspecific rash. Preserve those alternative skin diagnoses and other causes as competing explanations."
  },
  {
    "primaryId": "degenerative-disc-disease",
    "targetId": "radiculopathy",
    "pmid": "34402323",
    "rank": 1,
    "guard": "Require cervical degenerative disc pathology capable of nerve-root compromise and separately established anatomically concordant cervical radiculopathy. Do not infer radiculopathy from degenerative imaging, axial neck pain, nonspecific paresthesias, myelopathy, or peripheral entrapment neuropathy alone. Preserve peripheral neuropathy, plexopathy, entrapment neuropathy, spinal cord disease, nondegenerative structural lesions, and other causes as competing explanations."
  }
];
const load = <T,>(file: string) => JSON.parse(fs.readFileSync(file, "utf8")) as T;

describe("Mapping Expansion ME-13 qualified-human citation verification", () => {
  it("promotes exactly the five approved ME-13 references to verified without changing mapping semantics", () => {
    for (const row of rows) {
      const mapping = load<Mapping>(path.join(ROOT, "data", "knowledge-base", `${row.primaryId}.json`));
      expect(mapping.draft).toBe(true);
      const suggestions = mapping.suggestions.filter((s) => s.conditionId === row.targetId);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]!.rank).toBe(1);
      expect(suggestions[0]!.prevalence).toBe("sometimes-explored");
      expect(suggestions[0]!.pathwayIntelligence).toBeUndefined();
      const refs = suggestions[0]!.sourceReferences.filter((r) => r.citation?.includes(`PMID ${row.pmid}`));
      expect(refs).toHaveLength(1);
      expect(refs[0]!.verified).toBe(true);
      expect(refs[0]!.verificationScope).toBe("clinical-evidence");
    }
  });

  it("promotes exactly the five matching master sources to active qualified-human-verified state", () => {
    const registry = load<MasterSourceRegistry>(path.join(ROOT, "data", "evidence", "master-sources.json"));
    for (const row of rows) {
      const sources = registry.sources.filter((s) => s.sourceId === `pmid-${row.pmid}`);
      expect(sources).toHaveLength(1);
      expect(sources[0]!.status).toBe("active");
      expect(sources[0]!.verified).toBe(true);
      expect(sources[0]!.verificationState?.qualifiedHumanCitationReviewDecision).toBe("approve-as-implemented");
      expect(sources[0]!.verificationState?.qualifiedHumanCitationReviewRequired).toBe(false);
    }
  });

  it("preserves the five relationship identities, rank-1 amendment, draft publication state, and exact guards", () => {
    const registry = load<MasterRelationshipRegistry>(path.join(ROOT, "data", "evidence", "master-relationships.json"));
    for (const row of rows) {
      const rels = registry.relationships.filter((r) => r.relationshipId === `rel-${row.primaryId}-to-${row.targetId}`);
      expect(rels).toHaveLength(1);
      expect(rels[0]!.primaryPublicationState).toBe("draft");
      expect(rels[0]!.rank).toBe(1);
      expect(rels[0]!.publicationGuard.structuredGuardText).toBe(row.guard);
      expect(rels[0]!.sourceIds).toContain(`pmid-${row.pmid}`);
    }
  });
});
