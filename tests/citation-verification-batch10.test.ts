/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const root=process.cwd();
function mapping(id:string){return JSON.parse(fs.readFileSync(path.join(root,"data/knowledge-base",`${id}.json`),"utf8"));}
function sug(p:string,s:string){const r=mapping(p).suggestions.find((x:any)=>x.conditionId===s);expect(r).toBeTruthy();return r;}
function src(row:any,pmid:string){const r=row.sourceReferences.find((x:any)=>[x.citation,x.note,x.sourceUrl,x.sourceLocator].join(" ").includes(pmid));expect(r).toBeTruthy();return r;}
describe("citation verification batch 10",()=>{
  it("records the master-approved state",()=>{
    expect(src(sug("ptsd","erectile-dysfunction"),"19473282").verified).toBe(true);
    expect(src(sug("pulmonary-hypertension","congestive-heart-failure"),"36017548").verified).toBe(true);
    expect(src(sug("rectal-prolapse","fecal-incontinence"),"25869649").verified).toBe(true);
    expect(src(sug("retinal-dystrophy","visual-impairment"),"34839010").verified).toBe(true);
    expect(src(sug("rheumatoid-arthritis","gerd"),"18671778").verified).toBe(true);
    expect(sug("ptsd","sleep-apnea").pathwayIntelligence).toBeUndefined();
    expect(sug("ptsd","migraine-headaches").pathwayIntelligence).toBeUndefined();
  });
});
describe("batch 10 ratchet",()=>{it("pins the approved baseline",()=>{const a=fs.readFileSync(path.join(root,"scripts/audit-citation-verification.js"),"utf8");expect(a).toContain("liveVerified: 62,");expect(a).toContain("verifiedProvenance: 68,");expect(a).toContain("unverified: 7,");expect(a).toContain("reviewFindings: 5,");});});
