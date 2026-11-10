import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateSeed, validateRecord, normalizeTrials, normalizeProjects,
  collect, validateSnapshot,
} from "../scripts/automation/public-research-extensions-dev.mjs";

const topic = { id:"traumatic-brain-injury", query:"traumatic brain injury" };
const seed = { schemaVersion:1, seedId:"scf-public-trials-nih-projects-pilot-20261109", topics:[topic] };
const trials = { studies:[{ protocolSection:{
  identificationModule:{ nctId:"NCT01234567", briefTitle:"Traumatic Brain Injury Rehabilitation Trial" },
  statusModule:{ lastUpdatePostDateStruct:{date:"2026-10-15"}, overallStatus:"RECRUITING" },
  conditionsModule:{conditions:["Traumatic brain injury"]},
}}]};
const projects = {results:[{ appl_id:11212822, core_project_num:"IK2CX002363",
  project_num:"1IK2CX002363-03", project_title:"Neurorehabilitation Following Traumatic Brain Injury",
  fiscal_year:2026, project_start_date:"2025-01-01T00:00:00" }]};

test("bounded public-source identities retain NCT and NIH application/core IDs", () => {
  const [t] = normalizeTrials(topic,trials);
  const [p] = normalizeProjects(topic,projects);
  assert.equal(t.sourceId,"NCT01234567");
  assert.equal(t.sourceDate,"2026-10-15");
  assert.equal(t.details.reviewRequired,true);
  assert.equal(p.sourceId,"11212822");
  assert.equal(p.details.coreProjectNumber,"IK2CX002363");
  assert.equal(p.details.fiscalYear,2026);
  assert.equal(p.status,"UNVERIFIED_RESEARCH_METADATA");
});

test("rejects undocumented extra fields, corrupt hashes and unapproved providers", () => {
  const [original] = normalizeTrials(topic,trials);
  assert.throws(()=>validateRecord({...original, patientId:"person"}));
  assert.throws(()=>validateRecord({...original, contentHash:"0".repeat(64)}));
  assert.throws(()=>validateRecord({...original, provider:"production-va-health"}));
  assert.throws(()=>validateRecord({...original, details:{...original.details,reviewRequired:false}}));
});

test("refuses unknown clinical query structure and too many topics", () => {
  assert.throws(()=>validateSeed({...seed,topics:Array.from({length:6},(_,i)=>({...topic,id:"condition-"+i}))}));
  assert.throws(()=>validateSeed({...seed,topics:[{id:"individual",query:"SSN: 123-45-6789"}]}));
});

test("stages only metadata, never a raw provider response, preserving immutable hashes", async () => {
  const requests=[];
  const request = async (url,opts) => {
    requests.push({host:url.hostname,method:opts.method,query:url.searchParams.get("query.cond")});
    const json = url.hostname==="clinicaltrials.gov" ? trials : projects;
    return {ok:true,headers:new Headers(),text:async()=>JSON.stringify(json)};
  };
  const snapshot=await collect(seed,{request,repoCommit:"a".repeat(40),observedAt:"2026-11-09T23:00:00.000Z"});
  validateSnapshot(snapshot,seed);
  assert.deepEqual(requests.map((r)=>r.host),["clinicaltrials.gov","api.reporter.nih.gov"]);
  assert.equal(requests[1].method,"POST");
  assert.equal(snapshot.records.length,2);
  assert.equal(JSON.stringify(snapshot).includes("patientId"),false);
  assert.equal(snapshot.clinicalVerification,"NOT_PERFORMED");
  assert.throws(()=>validateSnapshot({...snapshot,publicationAuthorization:"GRANTED"},seed));
});
