import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { APPROVED_RELEASE, APPROVED_SNAPSHOT, validateQueue, validateRow } from "../scripts/automation/import-ontology-review-queue-dev.mjs";
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
 assert.equal(queue.snapshot,APPROVED_SNAPSHOT);
 assert.equal(m.release,APPROVED_RELEASE);
 validateQueue(queue,m);
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
   validateRow(r);
 }
 assert.equal(ids.size,1000);
 assert.equal(queue.clinicalApproval,"NOT_GRANTED");
});
test("rejects an arbitrary snapshot even when queue and coverage agree",()=>{
 const q=structuredClone(queue),c=structuredClone(m),fake="f".repeat(64);
 q.snapshot=fake;q.rows.forEach(r=>{r.source_snapshot=fake});c.pinned_snapshot=fake;
 assert.throws(()=>validateQueue(q,c),/approved MONDO snapshot/);
});
test("rejects populated reviewer fields and decisions",()=>{
 const row=structuredClone(queue.rows[0]);
 row.decision="APPROVED";
 assert.throws(()=>validateRow(row),/Decision must remain blank/);
 const reviewed=structuredClone(queue.rows[0]);
 reviewed.reviewer="Someone";reviewed.review_date="2026-11-10";
 assert.throws(()=>validateRow(reviewed),/Reviewer must remain blank/);
});
test("rejects unexpected or private row fields before persistence",()=>{
 const row=structuredClone(queue.rows[0]);
 row.patientNotes="not allowed";
 assert.throws(()=>validateRow(row),/Unexpected review row fields/);
});
test("rejects an unapproved release or publication status",()=>{
 const release=structuredClone(queue.rows[0]);
 release.source_release="v2026-10-07";
 assert.throws(()=>validateRow(release),/approved MONDO release/);
 const published=structuredClone(queue.rows[0]);
 published.publication_status="PUBLISHED";
 assert.throws(()=>validateRow(published),/DEV_RESEARCH_ONLY/);
});
