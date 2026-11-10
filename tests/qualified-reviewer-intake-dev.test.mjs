import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { canonical } from "../scripts/automation/candidate-review-tiger-dev.mjs";
import { validateReceipt, parseReviewerConnection, bootstrapStatements,
  checkReviewer, submitReceipt, sealDraft } from "../scripts/automation/qualified-reviewer-intake-dev.mjs";

const digest=x=>createHash("sha256").update(canonical(x)).digest("hex");
const clone=x=>JSON.parse(JSON.stringify(x));
const rehash=x=>({...x,receiptSha256:digest(Object.fromEntries(
  Object.entries(x).filter(([k])=>k!=="receiptSha256")))});
function fixture(){
  return rehash({schemaVersion:1,runId:"a".repeat(64),
    sourceId:"sleep-apnea",targetId:"depressive-disorder",
    candidatePmid:"12345678",reviewerIdentifier:"synthetic-qualified-reviewer",
    reviewerQualification:"Synthetic clinical evidence qualification for test only",
    qualificationVerifiedBy:"synthetic-admin",
    reviewedAt:"2026-11-09T19:20:00Z",
    clinicalDisposition:"POTENTIAL_SUPPORT",
    studyDesignPopulation:"Synthetic 100 adults; no actual findings or subjects",
    causalDirectionLimits:"Observational design; temporal and causal direction cannot be inferred",
    confoundersAndMediation:"Synthetic cohort with unmeasured confounding; medication effects require review",
    supportingEvidence:[{pmid:"12345678",note:"Synthetic study relevance only; full text not examined in test"}],
    unresolvedContradictions:[{pmid:"87654321",note:"Synthetic competing explanation must be reviewed separately"}],
    fullTextAccessBasis:"Synthetic full-text access statement; not actual clinical verification",
    reviewerRationale:"Synthetic test-only rationale: potential support is not clinical verification",
    productionPublicationState:"NOT_GRANTED"});
}
const validUrl="postgresql://scf_reviewer_testuser:"+"x".repeat(32)+
  "@m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com:30902/tsdb?sslmode=require";

test("structured preliminary reviewer receipts require exact fields and digest",()=>{
  const doc=fixture(); assert.equal(validateReceipt(doc),doc);
  const altered=clone(doc);altered.reviewerRationale="Edited after signing";
  assert.throws(()=>validateReceipt(altered));
  const extra=clone(doc);extra.claimantName="Private medical information";
  assert.throws(()=>validateReceipt(rehash(extra)));
  const clinical=clone(doc);clinical.productionPublicationState="APPROVED";
  assert.throws(()=>validateReceipt(rehash(clinical)));
  const contradiction=clone(doc);contradiction.clinicalDisposition="POTENTIAL_CONTRADICTION";
  contradiction.unresolvedContradictions=[];
  assert.throws(()=>validateReceipt(rehash(contradiction)));
  const support=clone(doc);support.supportingEvidence=[];
  assert.throws(()=>validateReceipt(rehash(support)));
});
test("local sealing preserves signed reviewer provenance without authentication claims",()=>{
  const original=fixture(),draft=Object.fromEntries(Object.entries(original).filter(([k])=>k!=="receiptSha256"));
  assert.deepEqual(sealDraft(draft),original);
  const altered={...draft,claimantEmail:"never write patient data"};
  assert.throws(()=>sealDraft(altered));
});
test("study pointers allow only PMID and bounded non-identifying note",()=>{
  for(const mutate of [
    d=>{d.supportingEvidence[0].patientName="Forbidden";},
    d=>{d.supportingEvidence[0].pmid="invalid";},
    d=>{d.supportingEvidence[0].note="x".repeat(401);},
    d=>{d.supportingEvidence=Array(21).fill({pmid:"12345678",note:"Synthetic evidence screening required"});},
  ]){
    const doc=fixture();mutate(doc);
    assert.throws(()=>validateReceipt(rehash(doc)));
  }
});
test("reviewer credentials use only individual pinned DEV host, TLS and role",()=>{
  const c=parseReviewerConnection(validUrl);
  assert.equal(c.user,"scf_reviewer_testuser");
  assert.equal(c.database,"tsdb");
  assert.equal(c.ssl.rejectUnauthorized,true);
  for(const bad of [
    validUrl.replace("scf_reviewer_testuser","tsdbadmin"),
    validUrl.replace("scf_reviewer_testuser","scf_evidence_ci_writer"),
    validUrl.replace("m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com","production.example.com"),
    validUrl.replace("30902","5432"),
    validUrl.replace("sslmode=require","sslmode=disable"),
    validUrl+"&options=-csearch_path%3Dpublic",
    "postgresql://scf_reviewer_a:short@m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com:30902/tsdb?sslmode=require",
  ])assert.throws(()=>parseReviewerConnection(bad));
});
test("bootstrap adds NOLOGIN role but never creates or enrolls a user",()=>{
  const sql=bootstrapStatements().join("\n");
  assert.match(sql,/CREATE ROLE scf_qualified_review_submitter NOLOGIN NOINHERIT/);
  assert.match(sql,/reviewer_authorizations/);
  assert.match(sql,/SECURITY DEFINER/);
  assert.match(sql,/session_user/);
  assert.match(sql,/pg_has_role/);
  assert.match(sql,/qualification_verified_by/);
  assert.match(sql,/valid_until<=now/);
  assert.match(sql,/BEFORE INSERT/);
  assert.match(sql,/receipt_sha256/);
  assert.match(sql,/production_publication_state/);
  assert.match(sql,/GRANT INSERT ON scf_candidate_review_dev[.]qualified_human_reviews TO scf_qualified_review_submitter/);
  assert.doesNotMatch(sql,/GRANT .* TO scf_reviewer_/);
  assert.doesNotMatch(sql,/CREATE ROLE scf_reviewer_/);
  assert.doesNotMatch(sql,/GRANT SELECT ON scf_candidate_review_dev[.]qualified_human_reviews/);
  assert.doesNotMatch(sql,/GRANT .* TO scf_evidence_ci_writer/);
});
test("trusted session_user and explicit reviewer role must match",async()=>{
  const db={query:async()=>({rows:[{login:"scf_reviewer_testuser",has_role:true}]})};
  assert.equal(await checkReviewer(db,"scf_reviewer_testuser"),true);
  await assert.rejects(checkReviewer({query:async()=>({rows:[{login:"scf_reviewer_other",has_role:true}]})},"scf_reviewer_testuser"));
  await assert.rejects(checkReviewer({query:async()=>({rows:[{login:"scf_reviewer_testuser",has_role:false}]})},"scf_reviewer_testuser"));
  await assert.rejects(checkReviewer(db,"tsdbadmin"));
});
test("submit uses authenticated role, one INSERT, and no human receipt SELECT",async()=>{
  const doc=fixture(),calls=[];
  const db={query:async(sql,values)=>{
    calls.push([sql,values]);
    if(sql.startsWith("SELECT session_user"))return {rows:[{login:"scf_reviewer_testuser",has_role:true}]};
    return {rows:[]};
  },end:async()=>{calls.push(["END"]);}};
  const prior=process.env.SCF_QUALIFIED_REVIEW_DEV_URL;
  process.env.SCF_QUALIFIED_REVIEW_DEV_URL=validUrl;
  try{
    const result=await submitReceipt(doc,async cfg=>{
      assert.equal(cfg.user,"scf_reviewer_testuser");return db;
    });
    assert.equal(result.result,"QUALIFIED_REVIEW_RECEIPT_ACCEPTED_DEV_ONLY");
    assert.equal(result.clinicalApprovals,0);
    assert.equal(result.publicationChanges,0);
    assert.deepEqual(calls.map(x=>x[0]).slice(0,4),[
      "BEGIN","SET LOCAL lock_timeout='3000ms'",
      "SELECT session_user AS login, pg_has_role(session_user,$1,'member') AS has_role",
      "SET LOCAL ROLE scf_qualified_review_submitter"]);
    assert.equal(calls.filter(([sql])=>sql.startsWith("INSERT INTO scf_candidate_review_dev.qualified_human_reviews")).length,1);
    assert.ok(!calls.some(([sql])=>/SELECT .*qualified_human_reviews/.test(sql)));
    assert.ok(calls.some(([sql])=>sql==="COMMIT"));
  }finally{
    if(prior===undefined)delete process.env.SCF_QUALIFIED_REVIEW_DEV_URL;
    else process.env.SCF_QUALIFIED_REVIEW_DEV_URL=prior;
  }
});
test("failed authentication rolls back, never inserts, and closes session",async()=>{
  const doc=fixture(),calls=[];
  const db={query:async sql=>{
    calls.push(sql);
    if(sql.startsWith("SELECT session_user"))return {rows:[{login:"scf_reviewer_testuser",has_role:false}]};
    return {rows:[]};
  },end:async()=>{calls.push("END");}};
  const prior=process.env.SCF_QUALIFIED_REVIEW_DEV_URL;
  process.env.SCF_QUALIFIED_REVIEW_DEV_URL=validUrl;
  try{
    await assert.rejects(submitReceipt(doc,async()=>db));
    assert.ok(calls.includes("ROLLBACK"));
    assert.ok(calls.includes("END"));
    assert.ok(!calls.some(s=>s.startsWith("INSERT INTO")));
  }finally{
    if(prior===undefined)delete process.env.SCF_QUALIFIED_REVIEW_DEV_URL;
    else process.env.SCF_QUALIFIED_REVIEW_DEV_URL=prior;
  }
});
