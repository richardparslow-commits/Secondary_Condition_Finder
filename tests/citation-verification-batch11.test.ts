/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const root=process.cwd();
function mapping(id:string){return JSON.parse(fs.readFileSync(path.join(root,"data/knowledge-base",`${id}.json`),"utf8"));}
function sug(p:string,s:string){const r=mapping(p).suggestions.find((x:any)=>x.conditionId===s);expect(r).toBeTruthy();return r;}
function src(row:any,pmid:string){const r=row.sourceReferences.find((x:any)=>[x.citation,x.note,x.sourceUrl,x.sourceLocator].join(" ").includes(pmid));expect(r).toBeTruthy();return r;}
describe("citation verification batch 11",()=>{
  it("records the master-approved state",()=>{
    expect(src(sug("sleep-apnea","hypertension"),"40364148").verified).toBe(true);
    expect(src(sug("sleep-apnea","depressive-disorder"),"38888794").verified).toBe(true);
    expect(src(sug("sleep-apnea","anxiety-disorder"),"30453780").verified).toBe(true);
    expect(src(sug("syringomyelia","charcot-arthropathy"),"35994178").verified).toBe(true);
    expect(src(sug("testicular-cancer","hypogonadism"),"27009402").verified).toBe(true);
    expect(sug("ptsd","sleep-apnea").pathwayIntelligence).toBeUndefined();
    expect(sug("ptsd","migraine-headaches").pathwayIntelligence).toBeUndefined();
  });
});
describe("batch 11 ratchet",()=>{it("pins the approved baseline",()=>{const a=fs.readFileSync(path.join(root,"scripts/audit-citation-verification.js"),"utf8");expect(a).toContain("liveVerified: 68,");expect(a).toContain("verifiedProvenance: 74,");expect(a).toContain("unverified: 5,");expect(a).toContain("reviewFindings: 5,");});});
