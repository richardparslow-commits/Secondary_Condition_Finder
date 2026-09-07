import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const ROOT=process.cwd();
const rows=[
  {
    "primaryId": "pulmonary-embolism",
    "targetId": "pulmonary-hypertension",
    "pmid": "35081846",
    "guard": "Restrict the broad pulmonary-hypertension target to separately established chronic thromboembolic pulmonary hypertension after a documented pulmonary embolism. Require persistent mismatched perfusion or chronic thromboembolic/fibrotic obstruction after an appropriate post-PE anticoagulation interval and hemodynamically confirmed pulmonary hypertension under accepted criteria. Do not infer CTEPH from acute PE, persistent dyspnea, hypoxemia, or an echocardiographic estimate alone. Preserve left-heart disease, other lung disease or hypoxia, chronic thromboembolic disease without pulmonary hypertension, drugs/toxins, and other pulmonary-hypertension etiologies as competing explanations."
  },
  {
    "primaryId": "subdural-hematoma",
    "targetId": "seizure-disorder",
    "pmid": "27914224",
    "guard": "Require objectively documented subdural hematoma and separately established epileptic seizures or a seizure disorder with compatible chronology. Do not infer a chronic seizure disorder from prophylactic antiseizure medication, transient altered mental status, or an unconfirmed spell. Distinguish an isolated acute symptomatic seizure from recurrent unprovoked seizures or epilepsy when the target diagnosis requires that distinction. Preserve pre-existing epilepsy, additional traumatic brain injury, stroke, infection, metabolic or toxic disturbance, medication or substance effects, and other seizure etiologies."
  },
  {
    "primaryId": "multiple-sclerosis",
    "targetId": "optic-neuritis",
    "pmid": "36135184",
    "guard": "Require established multiple sclerosis and a separately diagnosed optic-neuritis phenotype compatible with inflammatory demyelinating optic neuropathy. Do not infer optic neuritis from nonspecific visual loss, eye pain, abnormal imaging, or multiple-sclerosis diagnosis alone. Preserve neuromyelitis optica spectrum disorder, MOG-antibody disease, ischemic, infectious, compressive, toxic/nutritional, hereditary, and other optic-neuropathy causes."
  },
  {
    "primaryId": "hodgkins-lymphoma",
    "targetId": "hypothyroidism",
    "pmid": "29681481",
    "guard": "Require documented Hodgkin lymphoma, documented thyroid-exposing neck or supradiaphragmatic radiation treatment consistent with the source phenotype, and separately established hypothyroidism after treatment with compatible chronology. Do not infer hypothyroidism from Hodgkin lymphoma or chemotherapy alone. Preserve autoimmune thyroid disease, thyroid surgery or radioiodine, medications, pituitary or hypothalamic disease, congenital thyroid disease, and other causes of hypothyroidism."
  },
  {
    "primaryId": "reactive-arthritis",
    "targetId": "uveitis",
    "pmid": "34528623",
    "guard": "Require established reactive arthritis and separately documented anterior uveitis by appropriate ophthalmic evaluation. Do not infer uveitis from reactive arthritis, conjunctivitis, red eye, ocular irritation, or photophobia alone. Preserve infectious uveitis, HLA-B27-associated uveitis from another spondyloarthritis, sarcoidosis, inflammatory bowel disease, medication-related disease, trauma, and other ocular inflammatory causes."
  }
];
type SourceReference={ citation?:string; verified:boolean; verificationScope:string; sourceUrl?:string };
type Suggestion={ conditionId:string; rank:number; nexusClaim:{nexusClassification:string}|undefined; evidentiaryProfile:{etiologicalConsensus:string}|undefined; pathwayIntelligence?:unknown; sourceReferences:SourceReference[] };
type Mapping={ draft:boolean; suggestions:Suggestion[] };
type MasterRelationship={ relationshipId:string; primaryPublicationState:string; rank:number; publicationGuard:{ structuredGuardText:string } };
type MasterRelationshipRegistry={ relationships:MasterRelationship[] };
type MasterSource={ sourceId:string; status:string; verified:boolean };
type MasterSourceRegistry={ sources:MasterSource[] };
const load=<T,>(p:string)=>JSON.parse(fs.readFileSync(p,"utf8")) as T;
describe("Mapping Expansion ME-12 local implementation",()=>{
  it("adds exactly five rank-1 relationships while preserving draft publication state",()=>{
    for (const row of rows) {
      const m=load<Mapping>(path.join(ROOT,"data","knowledge-base",`${row.primaryId}.json`));
      expect(m.draft).toBe(true);
      const hits=m.suggestions.filter((s)=>s.conditionId===row.targetId);
      expect(hits).toHaveLength(1); expect(hits[0].rank).toBe(1); expect(hits[0].nexusClaim?.nexusClassification).toBeDefined(); expect(hits[0].evidentiaryProfile?.etiologicalConsensus).toBeDefined();
      expect(hits[0].pathwayIntelligence).toBeUndefined();
      const refs=hits[0].sourceReferences.filter((r)=>r.citation?.includes(`PMID ${row.pmid}`));
      expect(refs).toHaveLength(1); expect(refs[0].verified).toBe(true); expect(refs[0].verificationScope).toBe("clinical-evidence");
    }
  });
  it("preserves five draft-primary relationships and records five verified active master sources with exact guards",()=>{
    const rel=load<MasterRelationshipRegistry>(path.join(ROOT,"data","evidence","master-relationships.json")); const src=load<MasterSourceRegistry>(path.join(ROOT,"data","evidence","master-sources.json"));
    for (const row of rows) {
      const rr=rel.relationships.filter((r)=>r.relationshipId===`rel-${row.primaryId}-to-${row.targetId}`); expect(rr).toHaveLength(1); expect(rr[0].primaryPublicationState).toBe("draft"); expect(rr[0].rank).toBe(1); expect(rr[0].publicationGuard.structuredGuardText).toBe(row.guard);
      const ss=src.sources.filter((s)=>s.sourceId===`pmid-${row.pmid}`); expect(ss).toHaveLength(1); expect(ss[0].status).toBe("active"); expect(ss[0].verified).toBe(true);
    }
  });
  it("pins the ME-12 citation-verified aggregate state",()=>{
    const maps=fs.readdirSync(path.join(ROOT,"data","knowledge-base")).filter((f)=>f.endsWith(".json")).map((f)=>load<Mapping>(path.join(ROOT,"data","knowledge-base",f)));
    const refs=maps.flatMap((m)=>m.suggestions.flatMap((s)=>s.sourceReferences||[])); const clinical=refs.filter((r)=>r.verificationScope==="clinical-evidence");
    expect(maps.reduce((n,m)=>n+m.suggestions.length,0)).toBe(353);
    expect(maps.filter((m)=>m.draft===false&&m.suggestions.length===1)).toHaveLength(66); expect(maps.filter((m)=>m.draft===false&&m.suggestions.length>=2)).toHaveLength(73); expect(maps.filter((m)=>m.draft === true && m.suggestions.length === 1)).toHaveLength(118);
    expect(refs).toHaveLength(361); expect(refs.filter((r)=>r.verified===true)).toHaveLength(361); expect(refs.filter((r)=>r.verified===false)).toHaveLength(0); expect(clinical).toHaveLength(356);
  });
});
