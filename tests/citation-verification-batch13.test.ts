/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const root=process.cwd();
function mapping(id:string){return JSON.parse(fs.readFileSync(path.join(root,"data/knowledge-base",`${id}.json`),"utf8"));}
function sug(p:string,s:string){const r=mapping(p).suggestions.find((x:any)=>x.conditionId===s);expect(r).toBeTruthy();return r;}
function src(row:any,pmid:string){const r=row.sourceReferences.find((x:any)=>[x.citation,x.note,x.sourceUrl,x.sourceLocator].join(" ").includes(pmid));expect(r).toBeTruthy();return r;}
describe("citation verification batch 13",()=>{
  it("records the master-approved state",()=>{
    const legal=sug("ocd","migraine-headaches").sourceReferences.find((x:any)=>String(x.citation).startsWith("38 CFR 3.310"));
    expect(legal.verified).toBe(true);
    expect(legal.verificationScope).toBe("legal-framework");
    expect(legal.sourceUrl).toContain("ecfr.gov");
    expect(sug("ptsd","sleep-apnea").pathwayIntelligence).toBeUndefined();
    expect(sug("ptsd","migraine-headaches").pathwayIntelligence).toBeUndefined();
    expect(sug("trigeminal-neuralgia","depressive-disorder").pathwayIntelligence).toBeUndefined();
    expect(mapping("ocd").draft).toBe(true);
    expect(src(sug("mild-tbi","post-traumatic-headache"),"38568491").verified).toBe(true);
  });
});
describe("batch 13 ratchet",()=>{it("pins the approved baseline",()=>{const a=fs.readFileSync(path.join(root,"scripts/audit-citation-verification.js"),"utf8");expect(a).toContain("liveVerified: 141,");expect(a).toContain("verifiedProvenance: 147,");expect(a).toContain("unverified: 0,");expect(a).toContain("reviewFindings: 0,");});});
