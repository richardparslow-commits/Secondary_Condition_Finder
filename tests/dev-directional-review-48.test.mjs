import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const json=(p)=>JSON.parse(readFileSync(new URL(p,import.meta.url),"utf8"));
const queue=json("../docs/research-dev/directional-review-48.json");
const report=json("../docs/research-dev/directional-coverage.json");
const source=json("../scripts/fixtures/research-dev/directional-public-pubmed-20261109.json");
function canonical(x){if(Array.isArray(x))return "["+x.map(canonical).join(",")+"]";if(x&&typeof x==="object")return "{"+Object.keys(x).sort().map(k=>JSON.stringify(k)+":"+canonical(x[k])).join(",")+"}";return JSON.stringify(x)}
test("pinned public research digest and exact directional cohort",()=>{
 const dig=createHash("sha256").update(canonical(Object.fromEntries(Object.entries(source).filter(([k])=>k!=="runId")))).digest("hex");
 assert.equal(dig,source.runId);
 assert.equal(source.edges.length,48);
 assert.equal(queue.rows.length,48);
 assert.equal(report.edges,48);
 assert.equal(queue.snapshot,source.runId);
 assert.equal(report.unique_cited_pmids,90);
 assert.equal(report.independent_clinical_approvals,0);
 assert.equal(report.production_changes,0);
});
test("all queue entries require clinician review; no clinical nexus automatically inferred",()=>{
 const unique=new Set();
 for(const r of queue.rows){
  const key=r.source_id+"->"+r.target_id;assert.ok(!unique.has(key));unique.add(key);
  assert.ok(["DIRECT_CAUSATION","AGGRAVATION"].includes(r.authored_pathway_type));
  assert.equal(r.clinical_review,"NOT_REVIEWED");
  assert.equal(r.reviewer,"");assert.equal(r.review_decision,"");
  assert.match(r.flags,/DIRECTIONAL_CLAIM_HUMAN_REVIEW/);
  assert.equal(r.snapshot,queue.snapshot);
 }
 assert.equal(queue.clinicalApproval,"NOT_GRANTED");
});
