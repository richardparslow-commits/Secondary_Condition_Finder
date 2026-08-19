/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const root=process.cwd();
function mapping(id:string){return JSON.parse(fs.readFileSync(path.join(root,"data/knowledge-base",`${id}.json`),"utf8"));}
function sug(p:string,s:string){const r=mapping(p).suggestions.find((x:any)=>x.conditionId===s);expect(r).toBeTruthy();return r;}
function src(row:any,pmid:string){const r=row.sourceReferences.find((x:any)=>[x.citation,x.note,x.sourceUrl,x.sourceLocator].join(" ").includes(pmid));expect(r).toBeTruthy();return r;}
describe("citation verification batch 09",()=>{
  it("records the master-approved state",()=>{
    expect(src(sug("pcl-injury","osteoarthritis"),"34505176").verified).toBe(true);
    expect(src(sug("pituitary-neoplasm","visual-impairment"),"32419072").verified).toBe(true);
    expect(src(sug("ptosis","visual-impairment"),"35895522").verified).toBe(true);
    expect(src(sug("ptsd","sleep-apnea"),"28735910").verified).toBe(true);
    expect(src(sug("ptsd","migraine-headaches"),"41705319").verified).toBe(true);
    expect(sug("ptsd","sleep-apnea").pathwayIntelligence).toBeUndefined();
    expect(sug("ptsd","migraine-headaches").pathwayIntelligence).toBeUndefined();
  });
});
describe("batch 09 ratchet",()=>{it("pins the approved baseline",()=>{const a=fs.readFileSync(path.join(root,"scripts/audit-citation-verification.js"),"utf8");expect(a).toContain("liveVerified: 140,");expect(a).toContain("verifiedProvenance: 146,");expect(a).toContain("unverified: 1,");expect(a).toContain("reviewFindings: 1,");});});
