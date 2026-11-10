import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { canonical, sha, validate, project, schemaStatements, compare,
  assertDevAdmin, processCandidate } from "../scripts/automation/candidate-review-tiger-dev.mjs";

const LEDGER="dcd6681315b0b36c4a0a8270405f5446f0bd75d01465fefae1114f2206bcd7aa";
const clone=x=>JSON.parse(JSON.stringify(x));
const hash=d=>({...d,runSha256:sha(d)});
function fixture(){
  const pubs=[
    {pmid:"99880001",title:"Test study with linked official erratum",publicationTypes:["Journal Article"],
      publicationYearText:"2024",abstractAvailable:true,correctionOrRetractionTypes:["ErratumIn"],
      publicationStatusReviewRequired:true,bibliographicStatus:"OFFICIAL_RECORD_FOUND",
      clinicalSupport:"NOT_ASSESSED",medicalReview:"REQUIRED",fullTextReviewed:false,
      abstractTextStored:false,publicationAuthorization:"NOT_GRANTED"},
    {pmid:"99880002",title:"Test study without indexed abstract",publicationTypes:["Clinical Trial"],
      publicationYearText:"2021",abstractAvailable:false,correctionOrRetractionTypes:[],
      publicationStatusReviewRequired:false,bibliographicStatus:"OFFICIAL_RECORD_FOUND",
      clinicalSupport:"NOT_ASSESSED",medicalReview:"REQUIRED",fullTextReviewed:false,
      abstractTextStored:false,publicationAuthorization:"NOT_GRANTED"},
    {pmid:"99880003",title:"Test candidate study needing full text",publicationTypes:[],
      publicationYearText:"2019",abstractAvailable:true,correctionOrRetractionTypes:[],
      publicationStatusReviewRequired:false,bibliographicStatus:"OFFICIAL_RECORD_FOUND",
      clinicalSupport:"NOT_ASSESSED",medicalReview:"REQUIRED",fullTextReviewed:false,
      abstractTextStored:false,publicationAuthorization:"NOT_GRANTED"},
  ];
  const links=pubs.map((p,i)=>({
    sourceId:"sleep-apnea",targetId:"depressive-disorder",originalPmid:"12345678",
    candidatePmid:p.pmid,searchRank:i+1,studyScreening:"REQUIRED",
    clinicalFinding:"NOT_ASSESSED",individualVaNexus:"NOT_ASSESSED",
    publicationAuthorization:"NOT_GRANTED",
  }));
  return hash({schemaVersion:1,scope:"OFFICIAL_PUBMED_CANDIDATE_BIBLIOGRAPHY_NOT_CLINICAL_VERIFICATION",
    sourceLedgerId:LEDGER,sourceCandidateRunSha256:"a".repeat(64),
    observedAt:"2026-11-09T19:30:00+00:00",sourcePublicationCount:3,
    publications:pubs,caseCandidateLinks:links,clinicalApprovals:0,
    individualVaNexusApprovals:0,productionChanges:0,abstractTextsStored:0,
    fullTextsReviewed:0,contradictionFindings:0});
}
const rehash=d=>({...d,runSha256:sha(Object.fromEntries(
  Object.entries(d).filter(([k])=>k!=="runSha256")))});

test("immutable candidate run rejects approval and source tampering even when rehashed",()=>{
  const a=fixture();assert.equal(validate(a),a);
  for(const mutate of [
    d=>{d.clinicalApprovals=1;},
    d=>{d.publications[0].clinicalSupport="VERIFIED";},
    d=>{d.publications[0].abstractTextStored=true;},
    d=>{d.caseCandidateLinks[0].clinicalFinding="SUPPORTED";},
    d=>{d.caseCandidateLinks[0].individualVaNexus="SERVICE_CONNECTED";},
    d=>{d.productionChanges=1;},
    d=>{d.sourceLedgerId="b".repeat(64);},
  ]){
    const doc=clone(a);mutate(doc);
    assert.throws(()=>validate(rehash(doc)));
  }
});

test("all candidate publication and case links retain exact provenance",()=>{
  const a=fixture(),p=project(a);
  assert.equal(p.publications.length,3);
  assert.equal(p.case_candidates.length,3);
  assert.deepEqual(p.case_candidates.map(x=>x.review_priority),[
    "P1_STATUS_NOTICE_REVIEW","P2_ABSTRACT_UNAVAILABLE","P3_FULL_TEXT_SCREENING"]);
  assert.ok(p.case_candidates.every(x=>
    x.review_state==="PENDING_QUALIFIED_REVIEW"&&
    x.claim_verification==="NOT_ASSESSED"&&x.publication_authorization==="NOT_GRANTED"));
  for(const r of p.case_candidates){
    const {content_sha256,...fields}=r;
    assert.equal(content_sha256,sha(fields));
  }
});

test("reject duplicate ranks, unlinked publications and fabricated source PMIDs",()=>{
  const d=fixture();
  const duplicate=clone(d);duplicate.caseCandidateLinks[1].searchRank=1;
  assert.throws(()=>validate(rehash(duplicate)));
  const notLinked=clone(d);notLinked.caseCandidateLinks.pop();
  assert.throws(()=>validate(rehash(notLinked)));
  const wrongPmid=clone(d);wrongPmid.caseCandidateLinks[0].candidatePmid="00000000";
  assert.throws(()=>validate(rehash(wrongPmid)));
});

test("correct DEV endpoint is mandatory for privileged schema setup",()=>{
  const c={PGHOST:"m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com",
    PGPORT:"30902",PGDATABASE:"tsdb",PGUSER:"tsdbadmin",
    TIGER_LAB_ENDPOINT:"direct",PGPASSWORD:"synthetic-test-secret"};
  assertDevAdmin("m8vrpmo6ec",c);
  assert.throws(()=>assertDevAdmin("yc5kzxwazj",c));
  assert.throws(()=>assertDevAdmin("m8vrpmo6ec",{...c,PGHOST:"another-timescale-server.com"}));
  assert.throws(()=>assertDevAdmin("m8vrpmo6ec",{...c,PGUSER:"postgres"}));
  assert.throws(()=>assertDevAdmin("m8vrpmo6ec",{...c,PGDATABASE:"production"}));
});

test("DDL restricts automation role to immutable research and human reviews stay private",()=>{
  const sql=schemaStatements().join("\n");
  assert.match(sql,/scf_candidate_review_dev[.]qualified_human_reviews/);
  assert.match(sql,/qualification_verified_by/);
  assert.match(sql,/unresolved_contradictions jsonb NOT NULL/);
  assert.match(sql,/supporting_evidence jsonb NOT NULL/);
  assert.match(sql,/production_publication_state/);
  assert.match(sql,/reject_human_review_changes/);
  assert.match(sql,/BEFORE UPDATE OR DELETE/);
  assert.match(sql,/REVOKE ALL ON scf_candidate_review_dev[.]qualified_human_reviews FROM scf_evidence_ci_writer/);
  assert.match(sql,/GRANT SELECT, INSERT ON scf_candidate_review_dev[.]runs,/);
  assert.doesNotMatch(sql,/GRANT .*qualified_human_reviews TO scf_evidence_ci_writer/);
  assert.doesNotMatch(sql,/GRANT UPDATE|GRANT DELETE/);
});

function queryMock(doc, tamper){
  const data=project(doc),calls=[];
  const db={
    calls,
    async query(sql,params=[]){
      calls.push(sql);
      if(sql.startsWith("SELECT source_ledger"))return {rows:[{
        source_ledger:LEDGER,source_candidate_run:doc.sourceCandidateRunSha256,
        official_pubmed_count:doc.publications.length,
        candidate_link_count:doc.caseCandidateLinks.length,approval_state:"NOT_GRANTED"}]};
      if(sql.startsWith("SELECT pmid"))return {rows:data.publications.map(x=>({...x}))};
      if(sql.startsWith("SELECT source_id")){
        const rows=data.case_candidates.map(x=>({...x}));
        if(tamper)rows[0].review_state="APPROVED";
        return {rows};
      }
      return {rows:[]};
    },
    async end(){calls.push("DB_END");},
  };
  return db;
}
test("independent DEV compare rejects single-row tampering even with exact counts",async()=>{
  const doc=fixture();
  const db=queryMock(doc,false);
  const good=await compare(db,doc);
  assert.equal(good.result,"EXACT_CANDIDATE_REVIEW_DEV_PARITY");
  assert.equal(good.reviewReceiptWrites,0);
  assert.equal(good.clinicalApprovals,0);
  assert.equal(good.productionChanges,0);
  assert.ok(!db.calls.some(sql=>/SELECT .*qualified_human_reviews/i.test(sql)));
  await assert.rejects(compare(queryMock(doc,true),doc));
});

test("writer verify mode is read-only and never reads or writes review receipts",async()=>{
  const doc=fixture(),db=queryMock(doc,false);
  await processCandidate("verify",doc,async mode=>{
    assert.equal(mode,"verify");return db;
  });
  assert.equal(db.calls[0],"BEGIN READ ONLY");
  assert.ok(db.calls.includes("ROLLBACK"));
  assert.ok(!db.calls.some(sql=>/INSERT INTO|CREATE SCHEMA|CREATE TABLE/.test(sql)));
  assert.ok(!db.calls.some(sql=>sql.includes("qualified_human_reviews")));
});
test("writer apply is additive and never creates database schemas or human decisions",async()=>{
  const doc=fixture(),db=queryMock(doc,false);
  await processCandidate("apply",doc,async mode=>{
    assert.equal(mode,"apply");return db;
  });
  assert.equal(db.calls[0],"BEGIN");
  assert.ok(db.calls.some(s=>s.startsWith("INSERT INTO scf_candidate_review_dev.runs")));
  assert.ok(db.calls.some(s=>s.includes(".case_candidates(run_id,")));
  assert.ok(db.calls.includes("COMMIT"));
  assert.ok(!db.calls.some(s=>s.startsWith("CREATE ")));
  assert.ok(!db.calls.some(s=>s.includes("qualified_human_reviews")));
});
test("DEV weekly workflow requires separate apply and independent verification",()=>{
  const wf=fs.readFileSync(".github/workflows/tiger-dev-clinical-accuracy-triage.yml","utf8");
  assert.match(wf,/candidate-review-tiger-dev[.]mjs apply --dev-write/);
  assert.match(wf,/candidate-review-tiger-dev[.]mjs verify/);
  assert.match(wf,/environment: tiger-dev-research/);
  assert.doesNotMatch(wf,/gh pr merge|DATABASE_URL_PRODUCTION/);
});
