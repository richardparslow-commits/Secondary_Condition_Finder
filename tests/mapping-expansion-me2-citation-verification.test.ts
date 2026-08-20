import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
type Row={primaryId:string;targetId:string;decision:string;current:{pmid:string;citation:string;sourceUrl:string;publicationGuard:string};finalApproved:{pmid:string;citation:string;sourceUrl:string;publicationGuard:string}};
type Ledger={ledgerStatus:string;approvalState:{rowsReviewed:number;asImplemented:number;guardChanges:number;replacements:number;rejected:number;unresolved:number;finalUniquePmids:number};implementationResult:{sourceRowsVerified:number};rows:Row[]};
type Ref={citation?:string;sourceUrl?:string;verified?:boolean}; type Sug={conditionId:string;rationale?:string;sourceReferences?:Ref[]}; type Map={suggestions?:Sug[]};
const root=process.cwd(); const L=():Ledger=>JSON.parse(fs.readFileSync(path.join(root,"docs","mapping-expansion-me2-citation-verification-approved-ledger.json"),"utf8")) as Ledger;
const load=(id:string):Map=>JSON.parse(fs.readFileSync(path.join(root,"data","knowledge-base",`${id}.json`),"utf8")) as Map;
const contains=(v:unknown,n:string):boolean=>typeof v==="string"?v.includes(n):Array.isArray(v)?v.some(x=>contains(x,n)):Boolean(v&&typeof v==="object"&&Object.values(v as Record<string,unknown>).some(x=>contains(x,n)));
describe("ME-2 citation verification",()=>{
  it("records 3 as implemented / 2 narrowed / 0 replacements / 0 rejects",()=>{ const d=L(); expect(d.ledgerStatus).toBe("APPROVED-AND-IMPLEMENTED-LOCALLY"); expect(d.approvalState).toEqual({rowsReviewed:5,asImplemented:3,guardChanges:2,replacements:0,rejected:0,unresolved:0,finalUniquePmids:5}); expect(d.implementationResult.sourceRowsVerified).toBe(5); });
  it("preserves source identity while limiting guard changes to two rows",()=>{ for(const r of L().rows){ expect(r.finalApproved.pmid).toBe(r.current.pmid); expect(r.finalApproved.citation).toBe(r.current.citation); expect(r.finalApproved.sourceUrl).toBe(r.current.sourceUrl); if(r.decision==="as-implemented") expect(r.finalApproved.publicationGuard).toBe(r.current.publicationGuard); else expect(r.finalApproved.publicationGuard).not.toBe(r.current.publicationGuard); } });
  it("promotes all five rows with final approved guards",()=>{ for(const r of L().rows){ const s=(load(r.primaryId).suggestions??[]).find(x=>x.conditionId===r.targetId); expect(s).toBeTruthy(); expect(s?.sourceReferences?.[0]?.verified).toBe(true); expect(s?.sourceReferences?.[0]?.citation).toBe(r.finalApproved.citation); expect(s?.sourceReferences?.[0]?.sourceUrl).toBe(r.finalApproved.sourceUrl); expect(contains(s,r.finalApproved.publicationGuard)).toBe(true); if(r.decision==="narrowed") expect(contains(s,r.current.publicationGuard)).toBe(false); } });
});
