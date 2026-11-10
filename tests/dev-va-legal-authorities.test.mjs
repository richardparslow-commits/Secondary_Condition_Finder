import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const json=(p)=>JSON.parse(readFileSync(new URL(p,import.meta.url),"utf8"));
const source=json("../scripts/fixtures/va-authorities-initial-20261110.json");
const report=json("../docs/research-dev/va-legal-coverage.json");
test("first official legal sources all remain review-only",()=>{
 assert.equal(source.records.length,11);
 assert.equal(report.records,11);
 assert.equal(report.legal_human_approvals,0);
 assert.equal(report.production_changes,0);
 assert.equal(report.indirect_official_case_citations,1);
 assert.deepEqual(report.records_by_kind,{statute:4,regulation:2,manual:2,court_case:3});
 for(const r of source.records){
  const u=new URL(r.sourceUrl);
  assert.equal(u.protocol,"https:");
  assert.ok(["uscode.house.gov","www.ecfr.gov","www.knowva.ebenefits.va.gov","www.cafc.uscourts.gov","www.uscourts.cavc.gov","www.supremecourt.gov"].includes(u.hostname));
  assert.equal(r.authorityStatus,"LEGAL_HUMAN_REVIEW_REQUIRED");
  assert.ok(r.reviewFlags.includes("LEGAL_HUMAN_REVIEW_REQUIRED"));
 }
});
test("CFR/M21/Spicer tension flagged; Allen original-opinion gap not disguised",()=>{
 const cases=source.records.filter(x=>x.kind==="court_case");
 assert.equal(cases.length,3);
 const allen=cases.find(x=>x.id==="cavc-allen-1995");
 assert.equal(allen.sourceRole,"OFFICIAL_COURT_SECONDARY_CITATION");
 assert.ok(allen.reviewFlags.includes("ORIGINAL_OPINION_URL_NOT_YET_VERIFIED"));
 assert.ok(report.flags.CFR_M21_SPICER_AGGRAVATION_RECONCILIATION>=3);
 assert.equal(source.approval,"NOT_GRANTED");
});
