/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const root=process.cwd();
function mapping(id:string){return JSON.parse(fs.readFileSync(path.join(root,"data/knowledge-base",`${id}.json`),"utf8"));}
function sug(p:string,s:string){const r=mapping(p).suggestions.find((x:any)=>x.conditionId===s);expect(r).toBeTruthy();return r;}
function src(row:any,pmid:string){const r=row.sourceReferences.find((x:any)=>[x.citation,x.note,x.sourceUrl,x.sourceLocator].join(" ").includes(pmid));expect(r).toBeTruthy();return r;}
describe("citation verification batch 12",()=>{
  it("records the master-approved state",()=>{
    expect(src(sug("thyroiditis","hypothyroidism"),"42232752").verified).toBe(true);
    expect(src(sug("trigeminal-neuralgia","depressive-disorder"),"40355578").verified).toBe(true);
    expect(src(sug("urethral-stricture","hydronephrosis"),"8571802").verified).toBe(true);
    expect(src(sug("uveitis","glaucoma"),"31816329").verified).toBe(true);
    expect(src(sug("ocd","migraine-headaches"),"24898830").verified).toBe(true);
    expect(sug("ptsd","sleep-apnea").pathwayIntelligence).toBeUndefined();
    expect(sug("ptsd","migraine-headaches").pathwayIntelligence).toBeUndefined();
    expect(sug("trigeminal-neuralgia","depressive-disorder").pathwayIntelligence).toBeUndefined();
    expect(mapping("ocd").draft).toBe(true);
  });
});
describe("batch 12 ratchet",()=>{it("pins the approved baseline",()=>{const a=fs.readFileSync(path.join(root,"scripts/audit-citation-verification.js"),"utf8");expect(a).toContain("liveVerified: 67,");expect(a).toContain("verifiedProvenance: 73,");expect(a).toContain("unverified: 2,");expect(a).toContain("reviewFindings: 1,");});});
