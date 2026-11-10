import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateReview, parseReviewerDevUrl, assertDevAdmin, setupIntake,
  sendQualifiedReview } from "../scripts/automation/qualified-review-intake-dev.mjs";

const SQL="scripts/automation/qualified-review-intake-dev.sql";
const FIXED="03951d20ec87019fa00e3e7af4e62ee3178288c361f2902bacd3de16687b5424";
function fixture(){
  return {
    submissionId:"123e4567-e89b-42d3-a456-426614174000",
    runId:FIXED,
    sourceId:"sleep-apnea",targetId:"depressive-disorder",
    candidatePmid:"99880001",reviewedAt:"2026-11-09T19:00:00Z",
    clinicalDisposition:"NEEDS_MORE_EVIDENCE",
    studyDesignPopulation:"Retrospective population sample with selection limitations.",
    causalDirectionLimits:"Temporal ordering does not demonstrate individual causation.",
    confoundersAndMediation:"Treatment selection and relevant baseline risk factors unresolved.",
    supportingEvidence:[{pmid:"99880001",assessment:"CONTEXT_ONLY"}],
    unresolvedContradictions:[],
    fullTextAccessBasis:"Institutional licensed access with source citation reference.",
    reviewerRationale:"Insufficient methodological detail to assess the directed relationship.",
    correctionNoticeDisposition:"REQUIRES_FOLLOW_UP",
  };
}
const mutate=(fn)=>{const x=structuredClone(fixture());fn(x);return x;};
const now=new Date("2026-11-09T21:00:00Z");

test("qualified review validates exactly the human-only preliminary evidence fields",()=>{
  const x=fixture();
  assert.equal(validateReview(x,now),x);
  for(const fn of [
    d=>{d.reviewerIdentifier="A forged medical specialist";},
    d=>{d.medicalVerification="VERIFIED";},
    d=>{d.qualificationVerifiedBy="SELF";},
    d=>{d.productionAuthorization="APPROVED";},
    d=>{delete d.correctionNoticeDisposition;},
    d=>{d.runId="0".repeat(64)+"1";},
    d=>{d.candidatePmid="0";},
    d=>{d.sourceId="NO spaces";},
    d=>{d.submissionId="not-a-uuid";},
    d=>{d.clinicalDisposition="VERIFIED";},
    d=>{d.supportingEvidence=[];},
    d=>{d.unresolvedContradictions=[{pmid:"99880001",issue:"PROVEN_FALSE"}];},
    d=>{d.supportingEvidence=[{pmid:"99880001",assessment:"CONTEXT_ONLY",note:"private notes"}];},
    d=>{d.reviewerRationale="short";},
  ]) assert.throws(()=>validateReview(mutate(fn),now));
});
test("contradiction signal requires a bounded original PMID reference",()=>{
  for(const d of ["MIXED_OR_CONFLICTED","POTENTIAL_CONTRADICTION"]){
    assert.throws(()=>validateReview(mutate(x=>{x.clinicalDisposition=d;}),now));
    const y=mutate(x=>{
      x.clinicalDisposition=d;
      x.unresolvedContradictions=[{pmid:"12345678",issue:"CAUSAL_DIRECTION"}];
    });
    assert.equal(validateReview(y,now),y);
  }
});
test("review timestamp must be real, bounded and timezone-aware",()=>{
  assert.throws(()=>validateReview(mutate(x=>{x.reviewedAt="2026-11-09";}),now));
  assert.throws(()=>validateReview(mutate(x=>{x.reviewedAt="2027-11-09T19:00:00Z";}),now));
  assert.throws(()=>validateReview(mutate(x=>{x.reviewedAt="2024-11-09T19:00:00Z";}),now));
});
test("reviewer connection strictly pins protected DEV and individual login",()=>{
  const mk=(username,host="m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com",extras="")=>
    "postgresql://"+username+":synthetic-reviewer-password-with-32-bytes@"+host+
    ":30902/tsdb?sslmode=require"+extras;
  assert.equal(parseReviewerDevUrl(mk("scf_review_testuser")).user,"scf_review_testuser");
  assert.throws(()=>parseReviewerDevUrl(mk("tsdbadmin")));
  assert.throws(()=>parseReviewerDevUrl(mk("scf_evidence_ci_writer")));
  assert.throws(()=>parseReviewerDevUrl(mk("scf_review_testuser","production.example.org")));
  assert.throws(()=>parseReviewerDevUrl(mk("scf_review_testuser","m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com","&sslmode=disable")));
  assert.throws(()=>parseReviewerDevUrl(mk("scf_review_testuser","m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com","&application_name=spoofed")));
  assert.throws(()=>parseReviewerDevUrl(""));
});
test("schema setup refuses another Tiger service, database or admin login",()=>{
  const c={PGHOST:"m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com",
    PGPORT:"30902",PGDATABASE:"tsdb",PGUSER:"tsdbadmin",
    TIGER_LAB_ENDPOINT:"direct",PGPASSWORD:"synthetic-only"};
  assertDevAdmin("m8vrpmo6ec",c);
  assert.throws(()=>assertDevAdmin("yc5kzxwazj",c));
  assert.throws(()=>assertDevAdmin("m8vrpmo6ec",{...c,PGHOST:"prod"}));
  assert.throws(()=>assertDevAdmin("m8vrpmo6ec",{...c,PGUSER:"scf_evidence_ci_writer"}));
});
test("SQL function binds identity to session user and enforces revocable credential attestation",()=>{
  const sql=fs.readFileSync(SQL,"utf8");
  assert.match(sql,/SECURITY DEFINER/);
  assert.match(sql,/SET search_path = pg_catalog/);
  assert.match(sql,/SESSION_USER/);
  assert.match(sql,/reviewer_authorizations/);
  assert.match(sql,/revoked_at IS NULL/);
  assert.match(sql,/verified_at <= now\(\) AND expires_at > now\(\)/);
  assert.match(sql,/rolcanlogin AND NOT rolsuper AND NOT rolcreaterole/);
  assert.match(sql,/qualification_verified_by <> reviewer_identifier/);
  assert.match(sql,/revoke|REVOKE ALL ON FUNCTION/);
  assert.match(sql,/REVOKE ALL ON FUNCTION .*submit_qualified_review\(jsonb\) FROM PUBLIC/);
  assert.match(sql,/FROM scf_evidence_ci_writer/);
  assert.match(sql,/production_publication_state/);
  assert.match(sql,/NOT_GRANTED/);
  assert.match(sql,/JOIN scf_candidate_review_dev\.publications/); // Exact immutable candidate linkage
  assert.doesNotMatch(sql,/\bCREATE ROLE\b(?!.*NO LOGIN)/i);
  assert.doesNotMatch(sql,/\bGRANT EXECUTE\b/i);
  assert.doesNotMatch(sql,/TIGER_AUTOMATION_DEV_URL/);
});
function mockDb(permission){
  const calls=[];
  return {
    calls,
    async query(sql){
      calls.push(sql);
      if(sql.startsWith("SELECT has_function_privilege")) return {rows:[permission]};
      return {rows:[]};
    },
    async end(){calls.push("DB_END");},
  };
}
test("admin setup stays one transaction and fails closed on public or CI EXECUTE",async()=>{
  const valid=mockDb({ci_can_submit:false,public_can_submit:false});
  const r=await setupIntake(async()=>valid,"SELECT 'synthetic' AS setup");
  assert.equal(r.result,"DEV_QUALIFIED_REVIEW_INTAKE_LOCKED_UNTIL_ADMIN_ENROLLMENT");
  assert.deepEqual(valid.calls.slice(0,2),["BEGIN","SELECT 'synthetic' AS setup"]);
  assert.ok(valid.calls.includes("COMMIT"));
  assert.ok(!valid.calls.includes("ROLLBACK"));
  const bad=mockDb({ci_can_submit:false,public_can_submit:true});
  await assert.rejects(setupIntake(async()=>bad,"SELECT 1"));
  assert.ok(bad.calls.includes("ROLLBACK"));
  assert.ok(!bad.calls.includes("COMMIT"));
});
test("human submission uses parameterized SECURITY DEFINER function, no direct table INSERT",async()=>{
  const calls=[];
  const db={
    async query(sql,params){
      calls.push({sql,params});
      if(sql.startsWith("SELECT scf_candidate_review_dev.submit_qualified_review")){
        return {rows:[{receipt_id:"42"}]};
      }
      return {rows:[]};
    },
    async end(){},
  };
  const out=await sendQualifiedReview(fixture(),async()=>db);
  assert.equal(out.provisionalDisposition,"NEEDS_MORE_EVIDENCE");
  assert.equal(out.productionPublication,"NOT_GRANTED");
  assert.equal(out.clinicalVerification,"NOT_ASSESSED");
  assert.equal(calls[0].sql,"BEGIN");
  assert.equal(calls[1].sql,"SELECT scf_candidate_review_dev.submit_qualified_review($1::jsonb) AS receipt_id");
  assert.equal(calls[2].sql,"COMMIT");
  assert.equal(calls[1].params.length,1);
  assert.ok(!calls.some(x=>/INSERT INTO|UPDATE .*qualified_human_reviews/.test(x.sql)));
});
test("failed database reviewer authorization rolls back and leaks no reviewer details",async()=>{
  const calls=[];
  const db={
    async query(sql){
      calls.push(sql);
      if(sql.startsWith("SELECT scf_candidate_review_dev.submit_qualified_review"))
        throw new Error("Sensitive mock credential rejection");
      return {rows:[]};
    },
    async end(){},
  };
  await assert.rejects(sendQualifiedReview(fixture(),async()=>db),
    /Qualified review intake denied by DEV; reviewer credentials and private notes withheld/);
  assert.deepEqual(calls,["BEGIN",
    "SELECT scf_candidate_review_dev.submit_qualified_review($1::jsonb) AS receipt_id",
    "ROLLBACK"]);
});
test("automated weekly workflow never accepts credentials or submits a human review",()=>{
  const wf=fs.readFileSync(".github/workflows/tiger-dev-clinical-accuracy-triage.yml","utf8");
  assert.doesNotMatch(wf,/qualified-review-intake-dev\.mjs submit/);
  assert.doesNotMatch(wf,/SCF_QUALIFIED_REVIEWER_DEV_URL/);
  const ci=fs.readFileSync(".github/workflows/ci.yml","utf8");
  assert.match(ci,/qualified-review-intake-dev\.test\.mjs/);
});
