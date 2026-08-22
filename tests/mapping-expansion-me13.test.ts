import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
type SourceReference = { citation?: string; verified: boolean; verificationScope?: string };
type Suggestion = { conditionId: string; rank: number; prevalence: string; pathwayIntelligence?: unknown; sourceReferences: SourceReference[] };
type Mapping = { draft: boolean; suggestions: Suggestion[] };
type RelationshipRecord = { relationshipId: string; primaryPublicationState: string; rank: number; publicationGuard: { structuredGuardText: string } };
type RelationshipRegistry = { baselineCommit: string; currentState: string; relationships: RelationshipRecord[] };
type SourceRecord = { sourceId: string; status: string; verified: boolean };
type SourceRegistry = { baselineCommit: string; currentState: string; sources: SourceRecord[] };
const ROOT=process.cwd();
const rows=[
  {
    "primaryId": "endometrial-cancer",
    "targetId": "lymphedema",
    "pmid": "33396373",
    "guard": "Require documented endometrial cancer, pelvic or para-aortic lymphatic-disrupting nodal treatment, and separately established lower-extremity lymphedema afterward. Do not infer lymphedema from endometrial cancer alone or from isolated edema. Preserve deep-vein thrombosis or other venous disease, cardiac or renal edema, primary lymphedema, infection, and other unrelated causes as competing explanations."
  },
  {
    "primaryId": "bladder-cancer",
    "targetId": "urinary-incontinence",
    "pmid": "39896758",
    "guard": "Require documented bladder cancer, radical cystectomy with orthotopic neobladder reconstruction, and persistent separately established postoperative urinary incontinence. Do not infer urinary incontinence from bladder cancer alone, from an ileal conduit without the phenotype, or from transient early postoperative leakage. Preserve urinary tract infection, retention or overflow, neurologic or pelvic-floor disease, preexisting urinary incontinence, and other etiologies as competing explanations."
  },
  {
    "primaryId": "non-hodgkins-lymphoma",
    "targetId": "peripheral-neuropathy",
    "pmid": "31214762",
    "guard": "Require documented non-Hodgkin lymphoma, a documented vincristine-containing or otherwise specifically neurotoxic lymphoma regimen, compatible chronology, and separately established peripheral neuropathy. Do not infer peripheral neuropathy from non-Hodgkin lymphoma itself. Preserve diabetic, nutritional, alcohol-related, compressive, paraproteinemic, infectious, hereditary, and other neuropathy etiologies as competing explanations."
  },
  {
    "primaryId": "fecal-incontinence",
    "targetId": "dermatitis",
    "pmid": "39836004",
    "guard": "Require fecal incontinence with repeated or prolonged perineal skin exposure and separately diagnosed moisture-associated or incontinence-associated dermatitis in the exposed distribution. Do not generalize this relationship to eczema, fungal disease, allergic or irritant dermatitis from unrelated agents, pressure injury, cellulitis, or a nonspecific rash. Preserve those alternative skin diagnoses and other causes as competing explanations."
  },
  {
    "primaryId": "degenerative-disc-disease",
    "targetId": "radiculopathy",
    "pmid": "34402323",
    "guard": "Require cervical degenerative disc pathology capable of nerve-root compromise and separately established anatomically concordant cervical radiculopathy. Do not infer radiculopathy from degenerative imaging, axial neck pain, nonspecific paresthesias, myelopathy, or peripheral entrapment neuropathy alone. Preserve peripheral neuropathy, plexopathy, entrapment neuropathy, spinal cord disease, nondegenerative structural lesions, and other causes as competing explanations."
  }
];
const load=<T,>(p:string):T=>JSON.parse(fs.readFileSync(p,"utf8")) as T;
describe("Mapping Expansion ME-13 local implementation",()=>{
  it("adds exactly five rank-1 relationships while preserving draft publication state",()=>{
    for (const row of rows) {
      const m=load<Mapping>(path.join(ROOT,"data","knowledge-base",`${row.primaryId}.json`));
      expect(m.draft).toBe(true);
      const hits=m.suggestions.filter((s:Suggestion)=>s.conditionId===row.targetId);
      expect(hits).toHaveLength(1); expect(hits[0]!.rank).toBe(1); expect(hits[0]!.prevalence).toBe("sometimes-explored");
      expect(hits[0]!.pathwayIntelligence).toBeUndefined();
      const refs=hits[0]!.sourceReferences.filter((r:SourceReference)=>r.citation?.includes(`PMID ${row.pmid}`));
      expect(refs).toHaveLength(1); expect(refs[0]!.verified).toBe(false); expect(refs[0]!.verificationScope).toBe("clinical-evidence");
    }
  });
  it("registers five draft-primary relationships and five pending master sources with exact guards",()=>{
    const rel=load<RelationshipRegistry>(path.join(ROOT,"data","evidence","master-relationships.json")); const src=load<SourceRegistry>(path.join(ROOT,"data","evidence","master-sources.json"));
    expect(rel.baselineCommit).toBe("e1bf62a6e5fde1da4f1938ce3322257662060bff"); expect(rel.currentState).toBe("ME13-PRE-QUALIFIED-HUMAN-CITATION-VERIFICATION");
    expect(src.baselineCommit).toBe("e1bf62a6e5fde1da4f1938ce3322257662060bff"); expect(src.currentState).toBe("ME13-PRE-QUALIFIED-HUMAN-CITATION-VERIFICATION");
    for (const row of rows) {
      const rr=rel.relationships.filter((r:RelationshipRecord)=>r.relationshipId===`rel-${row.primaryId}-to-${row.targetId}`);
      expect(rr).toHaveLength(1); expect(rr[0]!.primaryPublicationState).toBe("draft"); expect(rr[0]!.rank).toBe(1); expect(rr[0]!.publicationGuard.structuredGuardText).toBe(row.guard);
      const ss=src.sources.filter((s:SourceRecord)=>s.sourceId===`pmid-${row.pmid}`);
      expect(ss).toHaveLength(1); expect(ss[0]!.status).toBe("pending-verification"); expect(ss[0]!.verified).toBe(false);
    }
  });
  it("pins the ME-13 pending aggregate state",()=>{
    const maps=fs.readdirSync(path.join(ROOT,"data","knowledge-base")).filter((f)=>f.endsWith(".json")).map((f)=>load<Mapping>(path.join(ROOT,"data","knowledge-base",f)));
    const refs=maps.flatMap((m:Mapping)=>m.suggestions.flatMap((s:Suggestion)=>s.sourceReferences||[])); const clinical=refs.filter((r:SourceReference)=>r.verificationScope==="clinical-evidence");
    expect(maps.reduce((n:number,m:Mapping)=>n+m.suggestions.length,0)).toBe(238);
    expect(maps.filter((m:Mapping)=>m.draft===false&&m.suggestions.length===1)).toHaveLength(66); expect(maps.filter((m:Mapping)=>m.draft===false&&m.suggestions.length>=2)).toHaveLength(73); expect(maps.filter((m:Mapping)=>m.draft===true&&m.suggestions.length===1)).toHaveLength(11);
    expect(refs).toHaveLength(246); expect(refs.filter((r:SourceReference)=>r.verified===true)).toHaveLength(241); expect(refs.filter((r:SourceReference)=>r.verified===false)).toHaveLength(5); expect(clinical).toHaveLength(241);
  });
});
