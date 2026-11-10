#!/usr/bin/env node
/**
 * Authenticated, qualified-human ONLY, append-only PubMed review receipt intake.
 * NEVER called by GitHub Actions or the autonomous research writer.
 * DEV only. Credential verification/enrollment must be performed separately by DBA.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { Client } from "pg";
import { getLabConnection } from "../lib/tiger-lab-client.mjs";
import { assertDevAdmin, canonical } from "./candidate-review-tiger-dev.mjs";

const SERVICE="m8vrpmo6ec";
const HOST="m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com";
const SCHEMA="scf_candidate_review_dev";
const SUBMITTER="scf_qualified_review_submitter";
const NO="NOT_GRANTED";
const SHA=/^[a-f0-9]{64}$/;
const SLUG=/^[a-z0-9-]{2,90}$/;
const PMID=/^[1-9][0-9]{3,8}$/;
const REVIEWER=/^scf_reviewer_[a-z0-9_]{3,45}$/;
const DISPOSITIONS=[
  "NEEDS_MORE_EVIDENCE","INSUFFICIENT_EVIDENCE",
  "POTENTIAL_SUPPORT","POTENTIAL_CONTRADICTION","MIXED_OR_CONFLICTED",
];
const KEYS=[
  "schemaVersion","runId","sourceId","targetId","candidatePmid",
  "reviewerIdentifier","reviewerQualification","qualificationVerifiedBy",
  "reviewedAt","clinicalDisposition","studyDesignPopulation",
  "causalDirectionLimits","confoundersAndMediation",
  "supportingEvidence","unresolvedContradictions",
  "fullTextAccessBasis","reviewerRationale",
  "productionPublicationState","receiptSha256",
];
const FIELDS=[
  ["run_id","runId"],["source_id","sourceId"],["target_id","targetId"],
  ["candidate_pmid","candidatePmid"],
  ["reviewer_identifier","reviewerIdentifier"],
  ["reviewer_qualification","reviewerQualification"],
  ["qualification_verified_by","qualificationVerifiedBy"],
  ["reviewed_at","reviewedAt"],["clinical_disposition","clinicalDisposition"],
  ["study_design_population","studyDesignPopulation"],
  ["causal_direction_limits","causalDirectionLimits"],
  ["confounders_and_mediation","confoundersAndMediation"],
  ["supporting_evidence","supportingEvidence"],
  ["unresolved_contradictions","unresolvedContradictions"],
  ["full_text_access_basis","fullTextAccessBasis"],
  ["reviewer_rationale","reviewerRationale"],
  ["production_publication_state","productionPublicationState"],
  ["receipt_sha256","receiptSha256"],
];
const sha=x=>createHash("sha256").update(canonical(x)).digest("hex");
const withoutHash=x=>Object.fromEntries(Object.entries(x).filter(([key])=>key!=="receiptSha256"));
function boundedText(v,min=12,max=3000){
  assert.ok(typeof v==="string"&&v.trim().length>=min&&v.length<=max);
  assert.ok(!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v));
}
function evidenceArray(arr){
  assert.ok(Array.isArray(arr)&&arr.length<=20);
  for(const e of arr){
    assert.ok(e && !Array.isArray(e) && typeof e==="object");
    assert.deepEqual(Object.keys(e).sort(),["pmid","note"].sort(),
      "Only public PMID and short non-identifying reviewer note are permitted");
    assert.match(e.pmid,PMID);
    boundedText(e.note,12,400);
  }
}
export function validateReceipt(doc){
  assert.ok(doc && typeof doc==="object" && !Array.isArray(doc));
  assert.deepEqual(Object.keys(doc).sort(),KEYS.slice().sort(),
    "Unexpected field in reviewer receipt; private claimant data not supported");
  assert.equal(doc.schemaVersion,1);
  assert.match(doc.runId,SHA);
  assert.match(doc.sourceId,SLUG);
  assert.match(doc.targetId,SLUG);
  assert.match(doc.candidatePmid,PMID);
  boundedText(doc.reviewerIdentifier,3,100);
  boundedText(doc.reviewerQualification,12,300);
  boundedText(doc.qualificationVerifiedBy,3,100);
  assert.ok(typeof doc.reviewedAt==="string"&&doc.reviewedAt.length<=50);
  assert.ok(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(doc.reviewedAt));
  assert.ok(Number.isFinite(Date.parse(doc.reviewedAt)));
  assert.ok(DISPOSITIONS.includes(doc.clinicalDisposition));
  for(const key of ["studyDesignPopulation","causalDirectionLimits",
    "confoundersAndMediation","fullTextAccessBasis"])boundedText(doc[key],12,3000);
  boundedText(doc.reviewerRationale,30,5000);
  evidenceArray(doc.supportingEvidence);
  evidenceArray(doc.unresolvedContradictions);
  if(doc.clinicalDisposition==="POTENTIAL_SUPPORT") assert.ok(doc.supportingEvidence.length>0);
  if(doc.clinicalDisposition==="POTENTIAL_CONTRADICTION") assert.ok(doc.unresolvedContradictions.length>0);
  assert.equal(doc.productionPublicationState,NO);
  assert.match(doc.receiptSha256,SHA);
  assert.equal(doc.receiptSha256,sha(withoutHash(doc)),
    "Exact human-authored receipt digest mismatch");
  return doc;
}
export function parseReviewerConnection(raw){
  if(!raw)throw new Error("Missing separate qualified-reviewer DEV secret");
  let url;
  try{url=new URL(raw);}catch{throw new Error("Invalid reviewer connection metadata");}
  assert.ok(["postgres:","postgresql:"].includes(url.protocol));
  assert.equal(url.hostname,HOST,"Production or alternate host rejected");
  assert.equal(url.port,"30902");
  assert.equal(url.pathname,"/tsdb");
  assert.equal(url.searchParams.get("sslmode"),"require");
  assert.equal(url.searchParams.size,1,"Unapproved PostgreSQL URL options");
  const reviewer=decodeURIComponent(url.username);
  assert.match(reviewer,REVIEWER,"Dedicated per-person reviewer login required");
  assert.notEqual(reviewer,"tsdbadmin");
  assert.notEqual(reviewer,"scf_evidence_ci_writer");
  const password=decodeURIComponent(url.password);
  assert.ok(password.length>=24);
  return {host:HOST,port:30902,database:"tsdb",user:reviewer,password,
    ssl:{rejectUnauthorized:true},connectionTimeoutMillis:8000,
    query_timeout:12000,statement_timeout:10000,
    application_name:"scf_human_review_intake_dev"};
}
export function bootstrapStatements(){
  // These changes provide the *capability* to enroll a verified reviewer,
  // not any login, grant to a person, qualification attestation, or decision.
  const s=SCHEMA;
  return [
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='"+SUBMITTER+"') "+
      "THEN CREATE ROLE "+SUBMITTER+" NOLOGIN NOINHERIT; END IF; END $$",
    "ALTER TABLE "+s+".qualified_human_reviews ADD COLUMN IF NOT EXISTS "+
      "receipt_sha256 text",
    "ALTER TABLE "+s+".qualified_human_reviews ADD CONSTRAINT scf_review_receipt_hash_valid "+
      "CHECK(receipt_sha256 ~ '^[a-f0-9]{64}$')",
    "ALTER TABLE "+s+".qualified_human_reviews ALTER COLUMN receipt_sha256 SET NOT NULL",
    "CREATE UNIQUE INDEX IF NOT EXISTS scf_review_receipt_unique "+
      "ON "+s+".qualified_human_reviews(receipt_sha256)",
    "CREATE TABLE IF NOT EXISTS "+s+".reviewer_authorizations ("+
      "login_role text PRIMARY KEY CHECK(login_role ~ '^scf_reviewer_[a-z0-9_]{3,45}$'),"+
      "reviewer_identifier text NOT NULL CHECK(length(trim(reviewer_identifier))>=3),"+
      "verified_qualification text NOT NULL CHECK(length(trim(verified_qualification))>=12),"+
      "qualification_verified_by text NOT NULL CHECK(length(trim(qualification_verified_by))>=3),"+
      "verified_at timestamptz NOT NULL,valid_until timestamptz NOT NULL,"+
      "is_active boolean NOT NULL DEFAULT false CHECK(valid_until>verified_at),"+
      "approved_by text NOT NULL CHECK(length(trim(approved_by))>=3),"+
      "created_at timestamptz NOT NULL DEFAULT now())",
    "CREATE OR REPLACE FUNCTION "+s+".check_qualified_review_submission() "+
      "RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER "+
      "SET search_path=pg_catalog,pg_temp AS $$ "+
      "DECLARE a record; BEGIN "+
      "IF session_user IN ('tsdbadmin','scf_evidence_ci_writer') OR "+
      "session_user !~ '^scf_reviewer_[a-z0-9_]{3,45}$' THEN "+
      "RAISE EXCEPTION 'Dedicated qualified-reviewer login required'; END IF; "+
      "IF NOT pg_has_role(session_user,'"+SUBMITTER+"','member') THEN "+
      "RAISE EXCEPTION 'Reviewer submitter role not granted'; END IF; "+
      "SELECT reviewer_identifier,verified_qualification,qualification_verified_by, "+
      "is_active,valid_until INTO a FROM "+s+".reviewer_authorizations "+
      "WHERE login_role=session_user; "+
      "IF NOT FOUND OR a.is_active IS DISTINCT FROM true OR a.valid_until<=now() THEN "+
      "RAISE EXCEPTION 'Qualified reviewer not registered or attestation expired'; END IF; "+
      "IF NEW.reviewer_identifier<>a.reviewer_identifier OR "+
      "NEW.reviewer_qualification<>a.verified_qualification OR "+
      "NEW.qualification_verified_by<>a.qualification_verified_by THEN "+
      "RAISE EXCEPTION 'Receipt does not match DBA-verified reviewer identity'; END IF; "+
      "IF NEW.reviewed_at>now()+interval '5 minutes' OR "+
      "NEW.reviewed_at<now()-interval '90 days' THEN "+
      "RAISE EXCEPTION 'Reviewer timestamp outside allowed window'; END IF; "+
      "IF NEW.receipt_sha256 !~ '^[a-f0-9]{64}$' THEN "+
      "RAISE EXCEPTION 'Missing receipt digest'; END IF; "+
      "IF NEW.production_publication_state<>'"+NO+"' THEN "+
      "RAISE EXCEPTION 'Production publication is never authorized here'; END IF; "+
      "RETURN NEW; END $$",
    "REVOKE ALL ON FUNCTION "+s+".check_qualified_review_submission() FROM PUBLIC",
    "DROP TRIGGER IF EXISTS qualified_review_authentication ON "+
      s+".qualified_human_reviews",
    "CREATE TRIGGER qualified_review_authentication BEFORE INSERT ON "+
      s+".qualified_human_reviews FOR EACH ROW "+
      "EXECUTE FUNCTION "+s+".check_qualified_review_submission()",
    "REVOKE ALL ON "+s+".reviewer_authorizations FROM PUBLIC",
    "REVOKE ALL ON "+s+".reviewer_authorizations FROM scf_evidence_ci_writer",
    "REVOKE ALL ON "+s+".qualified_human_reviews FROM PUBLIC",
    "REVOKE ALL ON "+s+".qualified_human_reviews FROM scf_evidence_ci_writer",
    "GRANT USAGE ON SCHEMA "+s+" TO "+SUBMITTER,
    "GRANT INSERT ON "+s+".qualified_human_reviews TO "+SUBMITTER,
    "GRANT USAGE ON SEQUENCE "+s+".qualified_human_reviews_review_id_seq TO "+SUBMITTER,
  ];
}
async function openAdmin(){
  const c=getLabConnection(SERVICE,"verify");assertDevAdmin(SERVICE,c);
  const db=new Client({host:HOST,port:30902,database:"tsdb",user:c.PGUSER,
    password:c.PGPASSWORD,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:8000,
    query_timeout:20000,statement_timeout:15000,
    application_name:"scf_qualified_review_dev_bootstrap"});
  await db.connect();return db;
}
export async function bootstrap(connect=openAdmin){
  const db=await connect();let tx=false;
  try{
    await db.query("BEGIN");tx=true;
    await db.query("SET LOCAL lock_timeout='3000ms'");
    await db.query("SELECT pg_advisory_xact_lock(202611,924)");
    // Schema is expected to exist after merged PR #678: never create outside it.
    const count=await db.query("SELECT count(*)::int AS n FROM "+
      "pg_namespace WHERE nspname=$1",[SCHEMA]);
    assert.equal(count.rows[0].n,1,"Candidate research schema not initialized");
    const role=await db.query("SELECT count(*)::int AS n FROM "+
      "scf_candidate_review_dev.reviewer_authorizations");
    // When run against a fresh bootstrap, this relation does not exist yet.
    await db.query("COMMIT");tx=false;
    return role;
  }catch(err){
    if(tx)await db.query("ROLLBACK").catch(()=>undefined);
    throw err;
  }finally{await db.end().catch(()=>undefined);}
}
export async function installReviewerIntake(connect=openAdmin){
  const db=await connect();let tx=false;
  try{
    await db.query("BEGIN");tx=true;
    await db.query("SET LOCAL lock_timeout='3000ms'");
    await db.query("SELECT pg_advisory_xact_lock(202611,924)");
    const schema=await db.query("SELECT count(*)::int AS n FROM pg_namespace WHERE nspname=$1",[SCHEMA]);
    assert.equal(schema.rows[0].n,1);
    const empty=await db.query("SELECT count(*)::int AS n FROM "+
      SCHEMA+".qualified_human_reviews");
    assert.equal(empty.rows[0].n,0,"Existing private reviews: migrate under separate review");
    for(const sql of bootstrapStatements())await db.query(sql);
    const row=await db.query("SELECT count(*)::int AS n FROM "+
      SCHEMA+".reviewer_authorizations");
    assert.equal(row.rows[0].n,0,"Cannot replace existing qualified reviewer authorizations");
    await db.query("COMMIT");tx=false;
    return {result:"QUALIFIED_REVIEW_INTAKE_PREPARED",
      environment:"DEV",reviewerEnrollments:0,reviewReceipts:0,
      automaticReviewerGrants:0,clinicalApprovals:0,productionChanges:0};
  }catch{
    if(tx)await db.query("ROLLBACK").catch(()=>undefined);
    throw new Error("Qualified-reviewer intake bootstrap failed closed");
  }finally{await db.end().catch(()=>undefined);}
}
export async function checkReviewer(db,login){
  assert.match(login,REVIEWER);
  const r=await db.query("SELECT session_user AS login, "+
    "pg_has_role(session_user,$1,'member') AS has_role",[SUBMITTER]);
  assert.equal(r.rows.length,1);
  assert.equal(r.rows[0].login,login,"Authenticated reviewer login differs");
  assert.equal(r.rows[0].has_role,true,"Dedicated reviewer not enrolled");
  // No private authorizations are queried by the reviewer role. The
  // SECURITY DEFINER INSERT trigger performs the DB-authenticated attestation.
  return true;
}
export async function submitReceipt(doc,connect){
  validateReceipt(doc);
  const cfg=parseReviewerConnection(process.env.SCF_QUALIFIED_REVIEW_DEV_URL);
  const db=await connect(cfg);let tx=false;
  try{
    await db.query("BEGIN");tx=true;
    await db.query("SET LOCAL lock_timeout='3000ms'");
    await checkReviewer(db,cfg.user);
    const values=FIELDS.map(([dbCol,key])=>key==="supportingEvidence"||
      key==="unresolvedContradictions"?JSON.stringify(doc[key]):doc[key]);
    const names=FIELDS.map(([name])=>name);
    const args=names.map((_,i)=>"$"+(i+1)+(names[i]==="supporting_evidence"||
      names[i]==="unresolved_contradictions"?"::jsonb":""));
    // The INSERT trigger validates the exact server-authenticated user
    // against a DBA-controlled credential registry. No SELECT on receipts.
    await db.query("INSERT INTO "+SCHEMA+".qualified_human_reviews("+
      names.join(",")+") VALUES ("+args.join(",")+")",values);
    await db.query("COMMIT");tx=false;
    return {result:"QUALIFIED_REVIEW_RECEIPT_ACCEPTED_DEV_ONLY",
      receiptSha256:doc.receiptSha256,environment:"DEV",
      preliminaryDisposition:doc.clinicalDisposition,
      clinicalApprovals:0,publicationChanges:0};
  }catch{
    if(tx)await db.query("ROLLBACK").catch(()=>undefined);
    throw new Error("Human-review receipt rejected: authentication, attestation, or evidence gate failed");
  }finally{await db.end().catch(()=>undefined);}
}
if(process.argv[1]?.endsWith("qualified-reviewer-intake-dev.mjs")){
  const [mode,...args]=process.argv.slice(2);
  if(mode==="setup"&&args.length===1&&args[0]==="--dev-write"){
    try{console.log(JSON.stringify(await installReviewerIntake()));}
    catch{console.error("Restricted DEV intake setup failed; no secrets disclosed");process.exitCode=1;}
  }else if(mode==="validate"&&args.length===1){
    try{const doc=JSON.parse(fs.readFileSync(args[0],"utf8"));validateReceipt(doc);
      console.log(JSON.stringify({result:"REVIEW_RECEIPT_FORMAT_VALID",
        receiptSha256:doc.receiptSha256,clinicalApprovals:0,publicationChanges:0}));}
    catch{console.error("Reviewer receipt format validation failed");process.exitCode=1;}
  }else if(mode==="submit"&&args.length===2&&args[0]==="--dev-write"){
    try{const doc=JSON.parse(fs.readFileSync(args[1],"utf8"));
      console.log(JSON.stringify(await submitReceipt(doc,async cfg=>{
        const db=new Client(cfg);await db.connect();return db;
      })));}
    catch{console.error("Reviewer authentication or evidence gate rejected receipt");process.exitCode=1;}
  }else{
    console.error("Usage: setup --dev-write | validate <receipt.json> | submit --dev-write <receipt.json>");
    process.exitCode=1;
  }
}
