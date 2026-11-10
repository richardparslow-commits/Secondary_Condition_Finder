#!/usr/bin/env node
/**
 * Separately authenticated, qualified-HUMAN clinical study screening intake.
 * DEV only. No CI reviewer credentials, no automatic approvals or Production edits.
 *
 * Human identity and credentials are looked up from a DBA-verified database
 * authorization table inside the SECURITY DEFINER function; never caller input.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { getLabConnection } from "../lib/tiger-lab-client.mjs";

const HOST="m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com";
const SERVICE="m8vrpmo6ec";
const DB="tsdb";
const PORT="30902";
const SCRIPT=fileURLToPath(new URL("./qualified-review-intake-dev.sql",import.meta.url));
const LOGIN=/^scf_review_[a-z0-9_]{3,40}$/;
const SHA=/^[0-9a-f]{64}$/;
const PMID=/^[1-9][0-9]{3,8}$/;
const SLUG=/^[a-z0-9-]{2,90}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VALUES=new Set(["NEEDS_MORE_EVIDENCE","INSUFFICIENT_EVIDENCE",
  "POTENTIAL_SUPPORT","POTENTIAL_CONTRADICTION","MIXED_OR_CONFLICTED"]);
const ASSESS=new Set(["POTENTIAL_SUPPORT","POTENTIAL_CONTRADICTION",
  "CONTEXT_ONLY","INSUFFICIENT_FOR_CLAIM"]);
const ISSUES=new Set(["CAUSAL_DIRECTION","POPULATION_MISMATCH","CONFOUNDING",
  "MEDICATION_OR_PROCEDURE","PUBLICATION_CORRECTION","OTHER_UNRESOLVED"]);
const CORRECTION=new Set(["REVIEWED","REQUIRES_FOLLOW_UP","NOT_APPLICABLE"]);
const FIELDS=["submissionId","runId","sourceId","targetId","candidatePmid",
  "reviewedAt","clinicalDisposition","studyDesignPopulation","causalDirectionLimits",
  "confoundersAndMediation","supportingEvidence","unresolvedContradictions",
  "fullTextAccessBasis","reviewerRationale","correctionNoticeDisposition"];
const NARRATIVE={
  studyDesignPopulation:[12,3000],causalDirectionLimits:[12,3000],
  confoundersAndMediation:[12,3000],fullTextAccessBasis:[12,3000],
  reviewerRationale:[30,5000],
};
const RFC3339=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
function exactKeys(value,keys){
  assert.ok(value && typeof value==="object" && !Array.isArray(value),
    "Study review must be a JSON object");
  assert.deepEqual(Object.keys(value).sort(),[...keys].sort(),
    "Missing or forbidden review fields; reviewer identity is database-derived");
}
function narrative(value,[min,max]){
  assert.equal(typeof value,"string");
  assert.ok(value.trim().length>=min && value.length<=max,"Clinical rationale field is missing or too long");
  assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value),
    "Clinical text has forbidden control characters");
}
export function validateReview(value,now=new Date()){
  exactKeys(value,FIELDS);
  assert.match(value.submissionId,UUID);
  assert.match(value.runId,SHA);
  assert.match(value.sourceId,SLUG);
  assert.match(value.targetId,SLUG);
  assert.match(value.candidatePmid,PMID);
  assert.ok(VALUES.has(value.clinicalDisposition),
    "Only provisional human evidence dispositions are accepted");
  assert.equal(typeof value.reviewedAt,"string");
  assert.match(value.reviewedAt,RFC3339);
  const reviewed=new Date(value.reviewedAt);
  assert.ok(!Number.isNaN(reviewed.getTime()));
  const age=now.getTime()-reviewed.getTime();
  assert.ok(age>=0 && age<=366*24*3600*1000,"Review timestamp must be in the past year");
  for(const [field,bounds] of Object.entries(NARRATIVE)) narrative(value[field],bounds);
  assert.ok(Array.isArray(value.supportingEvidence)&&value.supportingEvidence.length>=1
    &&value.supportingEvidence.length<=20);
  for(const row of value.supportingEvidence){
    exactKeys(row,["pmid","assessment"]);
    assert.match(row.pmid,PMID);
    assert.ok(ASSESS.has(row.assessment));
  }
  assert.ok(value.supportingEvidence.some(r=>r.pmid===value.candidatePmid),
    "The exact candidate PMID must be included in the screened evidence");
  assert.ok(Array.isArray(value.unresolvedContradictions)
    &&value.unresolvedContradictions.length<=20);
  for(const row of value.unresolvedContradictions){
    exactKeys(row,["pmid","issue"]);
    assert.match(row.pmid,PMID);
    assert.ok(ISSUES.has(row.issue));
  }
  if(["MIXED_OR_CONFLICTED","POTENTIAL_CONTRADICTION"].includes(value.clinicalDisposition)){
    assert.ok(value.unresolvedContradictions.length>0,
      "Potential contradiction requires at least one study PMID and unresolved issue");
  }
  assert.ok(CORRECTION.has(value.correctionNoticeDisposition));
  return value;
}

export function parseReviewerDevUrl(raw){
  assert.ok(typeof raw==="string" && raw.length>0,"Missing private reviewer DEV credential");
  const u=new URL(raw);
  assert.ok(["postgres:","postgresql:"].includes(u.protocol));
  assert.equal(u.hostname,HOST,"Non-DEV host prohibited");
  assert.equal(u.port,PORT);
  assert.equal(u.pathname,"/"+DB);
  const user=decodeURIComponent(u.username);
  assert.match(user,LOGIN,"A dedicated individually authenticated DEV reviewer account is required");
  assert.ok(decodeURIComponent(u.password).length>=24);
  assert.equal(u.searchParams.get("sslmode"),"require");
  assert.deepEqual([...u.searchParams.keys()],["sslmode"]);
  assert.equal(u.hash,"");
  return {host:HOST,port:Number(PORT),database:DB,user,
    password:decodeURIComponent(u.password),ssl:{rejectUnauthorized:true},
    connectionTimeoutMillis:8000,query_timeout:20000,statement_timeout:15000,
    application_name:"scf_dev_qualified_human_review"};
}
export function assertDevAdmin(service,conn){
  assert.equal(service,SERVICE);
  assert.equal(conn.PGHOST,HOST);
  assert.equal(conn.PGPORT,PORT);
  assert.equal(conn.PGDATABASE,DB);
  assert.equal(conn.PGUSER,"tsdbadmin");
  assert.equal(conn.TIGER_LAB_ENDPOINT,"direct");
  assert.ok(conn.PGPASSWORD);
}
function loadReview(path){
  assert.ok(typeof path==="string" && path.length>0);
  const stat=fs.statSync(path);
  assert.ok(stat.isFile() && stat.size>0 && stat.size<=48_000,"Private reviewer form must be a small local JSON file");
  return validateReview(JSON.parse(fs.readFileSync(path,"utf8")));
}
async function openAdmin(){
  const conn=getLabConnection(SERVICE,"verify");
  assertDevAdmin(SERVICE,conn);
  const db=new Client({host:HOST,port:Number(PORT),database:DB,
    user:conn.PGUSER,password:conn.PGPASSWORD,ssl:{rejectUnauthorized:true},
    connectionTimeoutMillis:8000,query_timeout:26000,statement_timeout:22000,
    application_name:"scf_dev_qualified_review_intake_setup"});
  await db.connect();
  return db;
}
export async function setupIntake(connect=openAdmin,sql=fs.readFileSync(SCRIPT,"utf8")){
  const db=await connect();let active=false;
  try{
    await db.query("BEGIN");active=true;
    await db.query(sql);
    const rights=await db.query(
      "SELECT has_function_privilege('scf_evidence_ci_writer',"+
      "'scf_candidate_review_dev.submit_qualified_review(jsonb)','EXECUTE') AS ci_can_submit,"+
      "EXISTS (SELECT 1 FROM pg_catalog.pg_proc p "+
      "JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace "+
      "CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,"+
      "pg_catalog.acldefault('f',p.proowner))) acl "+
      "WHERE n.nspname='scf_candidate_review_dev' "+
      "AND p.proname='submit_qualified_review' "+
      "AND acl.grantee=0 AND acl.privilege_type='EXECUTE') AS public_can_submit,"+
      "has_table_privilege('scf_evidence_ci_writer',"+
      "'scf_candidate_review_dev.reviewer_authorizations','SELECT') AS ci_can_read_roster,"+
      "has_table_privilege('scf_evidence_ci_writer',"+
      "'scf_candidate_review_dev.qualified_human_reviews','INSERT') AS ci_can_insert_receipt");
    assert.equal(rights.rows.length,1);
    assert.equal(rights.rows[0].ci_can_submit,false);
    assert.equal(rights.rows[0].public_can_submit,false);
    assert.equal(rights.rows[0].ci_can_read_roster,false);
    assert.equal(rights.rows[0].ci_can_insert_receipt,false);
    await db.query("COMMIT");active=false;
    return {result:"DEV_QUALIFIED_REVIEW_INTAKE_LOCKED_UNTIL_ADMIN_ENROLLMENT",
      ciCanSubmit:false,publicCanSubmit:false,ciCanReadRoster:false,
      ciCanInsertReceipt:false,reviewerLoginsCreatedBySetup:0,
      humanReviewDecisionsCreated:0,clinicalApprovals:0,productionChanges:0};
  }catch{
    if(active)await db.query("ROLLBACK").catch(()=>undefined);
    throw new Error("DEV reviewer intake setup rejected; no credential information disclosed");
  }finally{await db.end().catch(()=>undefined);}
}
export async function sendQualifiedReview(review,connect=async ()=>{
  const db=new Client(parseReviewerDevUrl(process.env.SCF_QUALIFIED_REVIEWER_DEV_URL));
  await db.connect();return db;
}){
  validateReview(review);
  const db=await connect();let active=false;
  try{
    await db.query("BEGIN");active=true;
    // Identity/role/qualification gate and exact row lineage are enforced by the DB function.
    const result=await db.query(
      "SELECT scf_candidate_review_dev.submit_qualified_review($1::jsonb) AS receipt_id",
      [JSON.stringify(review)]);
    assert.equal(result.rows.length,1);
    assert.ok(/^\d+$/.test(String(result.rows[0].receipt_id)));
    await db.query("COMMIT");active=false;
    return {result:"QUALIFIED_HUMAN_STUDY_RECEIPT_STORED_IN_DEV_ONLY",
      receiptId:String(result.rows[0].receipt_id),
      sourceRun:review.runId,candidatePmid:review.candidatePmid,
      provisionalDisposition:review.clinicalDisposition,
      clinicalVerification:"NOT_ASSESSED",individualVaNexus:"NOT_ASSESSED",
      productionPublication:"NOT_GRANTED"};
  }catch{
    if(active)await db.query("ROLLBACK").catch(()=>undefined);
    throw new Error("Qualified review intake denied by DEV; reviewer credentials and private notes withheld");
  }finally{await db.end().catch(()=>undefined);}
}
if(process.argv[1]?.endsWith("qualified-review-intake-dev.mjs")){
  const [mode,...args]=process.argv.slice(2);
  const path=args[0];
  const authorized=(mode==="submit" && args.length===2 &&
    args[1]==="--qualified-human-submit");
  const preview=(mode==="validate" && args.length===1);
  const bootstrap=(mode==="setup" && args.length===1 && args[0]==="--dev-write");
  if(!preview && !authorized && !bootstrap){
    console.error("Usage: validate <private-review.json> | submit <private-review.json> --qualified-human-submit | setup --dev-write");
    process.exitCode=1;
  }else{
    try{
      if(bootstrap){
        console.log(JSON.stringify(await setupIntake()));
      }else{
        const d=loadReview(path);
        if(preview){
          const digest=createHash("sha256").update(JSON.stringify(d)).digest("hex");
          console.log(JSON.stringify({result:"VALID_LOCAL_QUALIFIED_REVIEW_TEMPLATE_ONLY",
            requestSha256:digest,sourceRun:d.runId,candidatePmid:d.candidatePmid,
            requiresIndependentlyAuthenticatedReviewer:true,
            clinicalApprovals:0,productionChanges:0}));
        }else{
          // An explicit human invocation is mandatory. No GitHub Action uses this mode.
          console.log(JSON.stringify(await sendQualifiedReview(d)));
        }
      }
    }catch{
      console.error("DEV qualified review validation or intake refused; private evidence and credentials withheld");
      process.exitCode=1;
    }
  }
}
