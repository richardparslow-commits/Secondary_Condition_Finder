import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {sha,canonical,validateReview,parseReviewerConnection,submitHumanReview,
  assertGateAudit,gateAuditSql,auditGates,setupGates} from
  "../scripts/automation/reviewer-intake-dev.mjs";

const SQL=fs.readFileSync("scripts/automation/reviewer-intake-setup-dev.sql","utf8");
const clone=x=>JSON.parse(JSON.stringify(x));
const rehash=d=>({...d,submissionSha256:sha(Object.fromEntries(
 Object.entries(d).filter(([k])=>k!=="submissionSha256")))});
function valid(){
  return rehash({
    schemaVersion:1,scope:"QUALIFIED_HUMAN_STUDY_SCREENING_DEV_ONLY",
    runId:"a".repeat(64),sourceId:"sleep-apnea",targetId:"depressive-disorder",
    candidatePmid:"99880001",reviewedAt:"2026-11-09T19:00:00Z",
    clinicalDisposition:"MIXED_OR_CONFLICTED",
    studyDesignPopulation:"Observational cohort of adults with sleep apnea.",
    causalDirectionLimits:"Reverse causation and residual confounding cannot be excluded.",
    confoundersAndMediation:"Age, medications, obesity, and access to care may mediate effects.",
    supportingEvidence:[{pmid:"99880001",assessment:"Association observed in adult sample; no causal effect established."}],
    unresolvedContradictions:[{pmid:"99880002",assessment:"Separate cohort finds inconsistent direction and effect size."}],
    fullTextAccessBasis:"Reviewer read legally obtained full-text article and errata.",
    reviewerRationale:"Evidence is mixed, with observational associations and competing methodological explanations."
  });
}
const NOW=Date.parse("2026-11-10T01:00:00Z");
const signed=d=>rehash(d);

test("canonical human receipt hashes are stable and validate only approved fields",()=>{
  assert.equal(canonical({z:2,a:1}),canonical({a:1,z:2}));
  const d=valid();assert.equal(validateReview(d,NOW),d);
  assert.equal(d.submissionSha256,sha(Object.fromEntries(Object.entries(d)
    .filter(([k])=>k!=="submissionSha256"))));
});

test("rehashed medical approval, VA nexus and private fields fail closed",()=>{
  for(const mutation of [
    d=>{d.productionAuthorization="APPROVED";},
    d=>{d.medicalVerification="VERIFIED";},
    d=>{d.individualVaNexus="SERVICE_CONNECTED";},
    d=>{d.reviewerIdentifier="SELF_ATTESTED_DOCTOR";},
    d=>{d.patientHistory="SHOULD_NOT_BE_STORED";},
    d=>{d.qualificationVerifiedBy="MYSELF";},
  ]){
    const d=valid();mutation(d);
    assert.throws(()=>validateReview(signed(d),NOW));
  }
});
test("unauthorized causal labels, future dates and missing audit fields are rejected",()=>{
  for(const mutation of [
    d=>{d.clinicalDisposition="VERIFIED_CAUSATION";},
    d=>{d.reviewedAt="2030-01-01T00:00:00Z";},
    d=>{delete d.confoundersAndMediation;},
    d=>{d.fullTextAccessBasis="unknown";},
    d=>{d.reviewerRationale="too short";},
    d=>{d.sourceId="../../etc/passwd";},
    d=>{d.candidatePmid="not-a-pmid";},
    d=>{d.reviewedAt="2026-11-09";},
  ]){
    const d=valid();mutation(d);
    assert.throws(()=>validateReview(signed(d),NOW));
  }
});
test("evidence requirements, duplicate PMIDs, and oversized text fail closed",()=>{
  for(const mutation of [
    d=>{d.supportingEvidence=[];},
    d=>{d.unresolvedContradictions=[];},
    d=>{d.supportingEvidence.push({...d.supportingEvidence[0]});},
    d=>{d.supportingEvidence=[{pmid:"99880001",assessment:"test",rawFullText:"COPYRIGHT"}];},
    d=>{d.supportingEvidence[0].assessment="filler ".repeat(500);},
    d=>{d.supportingEvidence=[...Array(13)].map((_,i)=>({pmid:String(99880100+i),assessment:"Observational data require fuller study."}));},
    d=>{d.supportingEvidence[0].pmid="00000000";},
  ]){
    const d=valid();mutation(d);
    assert.throws(()=>validateReview(signed(d),NOW));
  }
});
test("tampered content digest fails even if all other fields remain valid",()=>{
  const d=valid();d.reviewerRationale+=" Altered after signing.";
  assert.throws(()=>validateReview(d,NOW));
});
test("reviewer connection rejects admin, CI, pooled and non-DEV URLs",()=>{
  const good="postgresql://scf_review_verified1:"+("x".repeat(28))+
    "@m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com:30902/tsdb?sslmode=require";
  const r=parseReviewerConnection(good);
  assert.equal(r.user,"scf_review_verified1");
  assert.equal(r.ssl.rejectUnauthorized,true);
  for(const raw of [
    good.replace("scf_review_verified1","tsdbadmin"),
    good.replace("scf_review_verified1","scf_evidence_ci_writer"),
    good.replace("m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com","evil.db.internal"),
    good.replace(":30902",":5432"),
    good.replace("tsdb?","production?"),
    good.replace("sslmode=require","sslmode=disable"),
    good+"&options=-csearch_path%3Dpublic",
    good.replace("x".repeat(28),"short")
  ])assert.throws(()=>parseReviewerConnection(raw));
});

test("DB DDL uses individual-login identity, verified registry, SECURITY DEFINER and no approval route",()=>{
  assert.match(SQL,/session_user/);
  assert.match(SQL,/SECURITY DEFINER/);
  assert.match(SQL,/SET search_path = pg_catalog/);
  assert.match(SQL,/qualified_reviewers/);
  assert.match(SQL,/status='ACTIVE'/);
  assert.match(SQL,/credential_expires_at > now\(\)/);
  assert.match(SQL,/qualification_verified_by/);
  assert.match(SQL,/qualified_review_receipt_audit/);
  assert.match(SQL,/submission_sha256.*UNIQUE/);
  assert.match(SQL,/source_candidate_sha256/);
  assert.match(SQL,/REVOKE ALL ON FUNCTION/);
  assert.match(SQL,/GRANT EXECUTE ON FUNCTION/);
  assert.match(SQL,/scf_dev_qualified_reviewers NOLOGIN/);
  assert.match(SQL,/pg_has_role\(rolname/);
  assert.match(SQL,/NOT rolbypassrls/);
  assert.match(SQL,/NOT rolcreaterole/);
  assert.doesNotMatch(SQL,/CREATE ROLE scf_review_[a-z0-9]+ LOGIN/);
  assert.doesNotMatch(SQL,/GRANT .*qualified_human_reviews .* TO scf_dev_qualified_reviewers/);
  assert.doesNotMatch(SQL,/GRANT .*qualified_human_reviews .* TO scf_evidence_ci_writer/);
  assert.doesNotMatch(SQL,/PRODUCTION_DATABASE_URL|SERVICE_CONNECTED|APPROVED_FOR_PRODUCTION/);
});

function privilegeRow(){
  return {role_exists:true,role_is_no_login:true,
    ci_select_registry:false,ci_insert_registry:false,
    ci_read_receipts:false,ci_insert_receipts:false,ci_execute_submit:false,
    reviewer_group_read_receipts:false,reviewer_group_insert_receipts:false,
    reviewer_group_execute_submit:true,
    reviewer_count:"0",active_reviewer_count:"0",receipt_count:"0",
    unregistered_role_members:"0"};
}
test("audit rejects accidental CI privileges or private table access",()=>{
  const r=privilegeRow();assert.equal(assertGateAudit(r),r);
  for(const k of ["ci_select_registry","ci_insert_registry","ci_read_receipts",
    "ci_insert_receipts","ci_execute_submit","reviewer_group_read_receipts",
    "reviewer_group_insert_receipts"]){
    assert.throws(()=>assertGateAudit({...r,[k]:true}));
  }
  assert.throws(()=>assertGateAudit({...r,role_is_no_login:false}));
  assert.throws(()=>assertGateAudit({...r,reviewer_group_execute_submit:false}));
  assert.throws(()=>assertGateAudit({...r,unregistered_role_members:"1"}));
  assert.match(gateAuditSql(),/has_function_privilege/);
});
function mockDb(login="scf_review_verified1",fail=false){
  const calls=[];
  return {calls,async query(sql,params){
    calls.push({sql,params});
    if(sql==="SELECT session_user AS login")return {rows:[{login}]};
    if(sql.startsWith("SELECT scf_candidate_review_dev.submit_qualified_review")){
      if(fail)throw new Error("Private DB error must not be logged to user");
      return {rows:[{review_id:"42"}]};
    }
    if(sql.startsWith("SELECT EXISTS"))return {rows:[privilegeRow()]};
    return {rows:[]};
  },async end(){calls.push({sql:"END"})}};
}
test("authenticated human submit uses bound SQL, transaction and no public review write",async()=>{
  const doc=valid(),db=mockDb();
  const result=await submitHumanReview(doc,async()=>db);
  assert.equal(result.result,"PRIVATE_PRELIMINARY_STUDY_REVIEW_RECEIPT");
  assert.equal(result.reviewId,"42");
  assert.equal(result.clinicalVerification,"NOT_GRANTED");
  assert.equal(db.calls[1].sql,"BEGIN");
  const call=db.calls.find(x=>x.sql.startsWith("SELECT scf_candidate_review_dev.submit_qualified_review"));
  assert.equal(call.params.length,14);
  assert.equal(call.params[0],doc.runId);
  assert.equal(call.params[13],doc.submissionSha256);
  assert.ok(db.calls.some(x=>x.sql==="COMMIT"));
  assert.ok(!db.calls.some(x=>x.sql.includes("INSERT INTO")));
  assert.ok(!db.calls.some(x=>x.sql.includes("tsdbadmin")));
});
test("unverified login and DB failures produce rollback and no accidental retry",async()=>{
  const d=valid(),bad=mockDb("scf_evidence_ci_writer");
  await assert.rejects(submitHumanReview(d,async()=>bad));
  assert.ok(!bad.calls.some(x=>x.sql.includes("submit_qualified_review")));
  const broken=mockDb("scf_review_verified1",true);
  await assert.rejects(submitHumanReview(d,async()=>broken),/not confirmed/);
  assert.equal(broken.calls.filter(x=>x.sql.startsWith("SELECT scf_candidate_review_dev.submit")).length,1);
  assert.ok(broken.calls.some(x=>x.sql==="ROLLBACK"));
});
test("DB setup uses one transaction and gate audit is explicitly read only",async()=>{
  const db=mockDb();
  const gates=await setupGates(async()=>db,SQL);
  assert.equal(gates.result,"DEV_QUALIFIED_REVIEWER_GATE_ISOLATION_PASS");
  assert.equal(gates.reviewerCredentialsProvisioned,0);
  assert.ok(db.calls.some(x=>x.sql===SQL));
  assert.ok(db.calls.some(x=>x.sql==="COMMIT"));
  assert.ok(db.calls.some(x=>x.sql==="BEGIN READ ONLY"));
  assert.ok(db.calls.some(x=>x.sql==="ROLLBACK"));
  const audit=mockDb();
  const result=await auditGates(async()=>audit,true);
  assert.equal(result.activeQualifiedReviewers,0);
  assert.ok(audit.calls.every(c=>!c.sql.startsWith("INSERT INTO")));
});
test("CI never exposes private reviewer credential or issues qualified clinical decisions",()=>{
  const ci=fs.readFileSync(".github/workflows/ci.yml","utf8");
  const weekly=fs.readFileSync(".github/workflows/tiger-dev-clinical-accuracy-triage.yml","utf8");
  assert.match(ci,/reviewer-intake-dev[.]test[.]mjs/);
  assert.doesNotMatch(weekly,/TIGER_QUALIFIED_REVIEW_DEV_URL/);
  assert.doesNotMatch(weekly,/reviewer-intake-dev[.]mjs submit/);
  assert.doesNotMatch(weekly,/setup-gates --dev-write/);
  assert.doesNotMatch(ci,/TIGER_QUALIFIED_REVIEW_DEV_URL/);
});
