import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const json=(p)=>JSON.parse(readFileSync(new URL(p,import.meta.url),"utf8"));
const queue=json("../docs/research-dev/ontology-candidate-review.json");
const m=json("../docs/research-dev/ontology-coverage.json");
test("existing 819-app catalogue unchanged; ontology review expanded in DEV",()=>{
 assert.equal(queue.rows.length,1000);
 assert.equal(m.review_queue_rows,1000);
 assert.equal(m.app_catalog_unchanged,819);
 assert.equal(m.ontology_concepts_total,36055);
 assert.ok(m.ontology_active>30000);
 assert.ok(m.potential_unlinked_concepts>1000);
 assert.equal(m.medically_verified_new_conditions,0);
 assert.equal(m.automatically_published_to_app,0);
 assert.equal(queue.snapshot,m.pinned_snapshot);
});
test("all 1000 distinct MONDO candidates remain unapproved with pinned provenance",()=>{
 const ids=new Set();
 for(const r of queue.rows){
   assert.match(r.mondo_id,/^MONDO:\d{7}$/);
   assert.ok(!ids.has(r.mondo_id));ids.add(r.mondo_id);
   assert.equal(r.medical_identity,"NOT_REVIEWED");
   assert.equal(r.publication_status,"DEV_RESEARCH_ONLY");
   assert.equal(r.source_snapshot,queue.snapshot);
   assert.equal(r.reviewer,"");assert.equal(r.decision,"");
 }
 assert.equal(ids.size,1000);
 assert.equal(queue.clinicalApproval,"NOT_GRANTED");
});
