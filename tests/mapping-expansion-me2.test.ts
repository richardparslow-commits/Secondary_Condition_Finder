import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertMasterResolution2026CurrentState } from "./helpers/master-resolution-2026-current";
type VerifyRow = { primaryId:string; targetId:string; finalApproved:{ citation:string; sourceUrl:string; publicationGuard:string } };
type VerifyLedger = { ledgerStatus:string; implementationResult:{ sourceRowsVerified:number; asImplemented:number; guardChanges:number; replacements:number; rejected:number }; rows:VerifyRow[] };
type Ref = { citation?:string; sourceUrl?:string; verified?:boolean; verificationScope?:string };
type Sug = { conditionId:string; rationale?:string; pathwayIntelligence?:unknown; sourceReferences?:Ref[] };
type Map = { draft:boolean; suggestions?:Sug[] };
const root=process.cwd(); const kb=path.join(root,"data","knowledge-base");
const impl=()=>JSON.parse(fs.readFileSync(path.join(root,"docs","mapping-expansion-me2-approved-implementation-ledger.json"),"utf8"));
const ver=():VerifyLedger=>JSON.parse(fs.readFileSync(path.join(root,"docs","mapping-expansion-me2-citation-verification-approved-ledger.json"),"utf8")) as VerifyLedger;
const load=(id:string):Map=>JSON.parse(fs.readFileSync(path.join(kb,`${id}.json`),"utf8")) as Map;
const contains=(v:unknown,n:string):boolean=>typeof v==="string"?v.includes(n):Array.isArray(v)?v.some(x=>contains(x,n)):Boolean(v&&typeof v==="object"&&Object.values(v as Record<string,unknown>).some(x=>contains(x,n)));
describe("Mapping Expansion Batch ME-2",()=>{
  it("preserves implementation history and records separate citation verification",()=>{
    const i=impl(); expect(i.ledgerStatus).toBe("APPROVED-AND-IMPLEMENTED-LOCALLY"); expect(i.implementationResult.sourceRowsVerified).toBe(0);
    const v=ver(); expect(v.ledgerStatus).toBe("APPROVED-AND-IMPLEMENTED-LOCALLY"); expect(v.implementationResult).toMatchObject({sourceRowsVerified:5,asImplemented:3,guardChanges:2,replacements:0,rejected:0});
  });
  it("keeps five approved edges with verified sources and final guards",()=>{
    for(const row of ver().rows){ const s=(load(row.primaryId).suggestions??[]).find(x=>x.conditionId===row.targetId); expect(s).toBeTruthy(); expect(s?.pathwayIntelligence).toBeUndefined(); expect(s?.sourceReferences).toHaveLength(1);
      const r=s?.sourceReferences?.[0]; expect(r?.verified).toBe(true); expect(r?.verificationScope).toBe("clinical-evidence"); expect(r?.citation).toBe(row.finalApproved.citation); expect(r?.sourceUrl).toBe(row.finalApproved.sourceUrl); expect(contains(s,row.finalApproved.publicationGuard)).toBe(true); }
  });
  it("preserves the closed ME-2 five-edge / five-verified-source result under later approved expansions",()=>{
    const files=fs.readdirSync(kb).filter(n=>n.endsWith(".json")); const maps=files.map(n=>JSON.parse(fs.readFileSync(path.join(kb,n),"utf8")) as Map);
    expect(files).toHaveLength(817); expect(maps.filter(m=>m.draft===false)).toHaveLength(140); expect(maps.filter(m=>m.draft===true)).toHaveLength(677);
    expect(maps.reduce((n,m)=>n+(m.suggestions??[]).length,0)).toBeGreaterThanOrEqual(183);
    const refs=maps.flatMap(m=>(m.suggestions??[]).flatMap(s=>s.sourceReferences??[])); expect(refs.filter(r=>r.verified===true).length).toBeGreaterThanOrEqual(191);
    for(const row of ver().rows){ const s=(load(row.primaryId).suggestions??[]).find(x=>x.conditionId===row.targetId); expect(s).toBeTruthy(); const r=s?.sourceReferences?.[0]; expect(r?.verified).toBe(true); expect(r?.citation).toBe(row.finalApproved.citation); expect(r?.sourceUrl).toBe(row.finalApproved.sourceUrl); expect(contains(s,row.finalApproved.publicationGuard)).toBe(true); }
  });
  it("preserves the completed Master Resolution and ME-1 state",()=>{ assertMasterResolution2026CurrentState(); });
});
