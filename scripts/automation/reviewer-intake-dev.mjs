#!/usr/bin/env node
/**
 * Separately authenticated human-only screening receipts. No AI/CI reviewer,
 * no Production connection, no medical verification, no reviewer provisioning.
 * The DB derives reviewer identity/qualification from a private DBA registry.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { getLabConnection } from "../lib/tiger-lab-client.mjs";
import { assertDevAdmin } from "./candidate-review-tiger-dev.mjs";

const SERVICE="m8vrpmo6ec";
const HOST="m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com";
const SCHEMA="scf_candidate_review_dev";
const SQL=fileURLToPath(new URL("./reviewer-intake-setup-dev.sql",import.meta.url));
const SCOPE="QUALIFIED_HUMAN_STUDY_SCREENING_DEV_ONLY";
const FIELDS=["schemaVersion","scope","runId","sourceId","targetId",
  "candidatePmid","reviewedAt","clinicalDisposition","studyDesignPopulation",
  "causalDirectionLimits","confoundersAndMediation","supportingEvidence",
  "unresolvedContradictions","fullTextAccessBasis","reviewerRationale",
  "submissionSha256"];
const EVIDENCE_FIELDS=["pmid","assessment"];
const DISPOSITIONS=new Set(["NEEDS_MORE_EVIDENCE","INSUFFICIENT_EVIDENCE",
  "POTENTIAL_SUPPORT","POTENTIAL_CONTRADICTION","MIXED_OR_CONFLICTED"]);
const DIGEST=/^[a-f0-9]{64}$/;
const SLUG=/^[a-z0-9-]{2,90}$/;
const PMID=/^[1-9][0-9]{3,8}$/;
const LOGIN=/^scf_review_[a-z0-9_]{4,40}$/;

export function canonical(x){
  if(Array.isArray(x))return "["+x.map(canonical).join(",")+"]";
  if(x && typeof x==="object")return "{"+Object.keys(x).sort().map(
    k=>JSON.stringify(k)+":"+canonical(x[k])).join(",")+"}";
  return JSON.stringify(x);
}
export const sha=x=>createHash("sha256").update(canonical(x)).digest("hex");
const without=(o,k)=>Object.fromEntries(Object.entries(o).filter(([p])=>p!==k));
function onlyKeys(x,keys){
  assert.ok(x && typeof x==="object" && !Array.isArray(x));
  assert.deepEqual(Object.keys(x).sort(),[...keys].sort(),
    "Only approved research/evidence fields may be submitted");
}
function textLength(value,min,max){
  assert.ok(typeof value==="string" && value===value.trim() &&
    value.length>=min && value.length<=max && !value.includes("\0") &&
    !/[\u0001-\u0008\u000b\u000c\u000e-\u001f]/.test(value),
    "Study critique missing or outside permitted limits");
}
function boundedEvidence(items){
  assert.ok(Array.isArray(items)&&items.length<=12);
  const seen=new Set();
  for(const x of items){
    onlyKeys(x,EVIDENCE_FIELDS);
    assert.match(x.pmid,PMID);
    textLength(x.assessment,12,2000);
    assert.ok(!seen.has(x.pmid),"Duplicate PubMed evidence source");
    seen.add(x.pmid);
  }
}
export function validateReview(doc,clock=Date.now()){
  onlyKeys(doc,FIELDS);
  assert.equal(doc.schemaVersion,1);
  assert.equal(doc.scope,SCOPE);
  assert.match(doc.runId,DIGEST);
  assert.match(doc.sourceId,SLUG);
  assert.match(doc.targetId,SLUG);
  assert.match(doc.candidatePmid,PMID);
  assert.ok(DISPOSITIONS.has(doc.clinicalDisposition),
    "Clinical review can only be a preliminary disposition");
  assert.match(doc.reviewedAt,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/);
  const time=Date.parse(doc.reviewedAt);
  assert.ok(Number.isFinite(time) &&
    time>=Date.parse("2020-01-01T00:00:00Z")&&time<=clock+86400000,
    "Invalid qualified-review timestamp");
  for(const x of ["studyDesignPopulation","causalDirectionLimits",
                  "confoundersAndMediation"])textLength(doc[x],12,5000);
  textLength(doc.fullTextAccessBasis,12,1000);
  textLength(doc.reviewerRationale,30,10000);
  boundedEvidence(doc.supportingEvidence);
  boundedEvidence(doc.unresolvedContradictions);
  if(["POTENTIAL_SUPPORT","MIXED_OR_CONFLICTED"].includes(doc.clinicalDisposition))
    assert.ok(doc.supportingEvidence.length>0,"Supporting study source required");
  if(["POTENTIAL_CONTRADICTION","MIXED_OR_CONFLICTED"].includes(doc.clinicalDisposition))
    assert.ok(doc.unresolvedContradictions.length>0,"Contradiction source required");
  assert.match(doc.submissionSha256,DIGEST);
  assert.equal(doc.submissionSha256,sha(without(doc,"submissionSha256")),
    "Human review receipt SHA-256 mismatch");
  return doc;
}
export function parseReviewerConnection(raw){
  if(!raw)throw Error("A separate named reviewer DEV credential is required");
  const u=new URL(raw);
  assert.ok(["postgres:","postgresql:"].includes(u.protocol));
  assert.equal(u.hostname,HOST,"Reject non-DEV PostgreSQL host");
  assert.equal(u.port,"30902");
  assert.equal(u.pathname,"/tsdb");
  assert.deepEqual([...u.searchParams.keys()],["sslmode"]);
  assert.equal(u.searchParams.get("sslmode"),"require");
  const user=decodeURIComponent(u.username);
  assert.match(user,LOGIN,"Dedicated named reviewer login required");
  const password=decodeURIComponent(u.password);
  assert.ok(password.length>=24,"Weak or absent credential");
  return {host:HOST,port:30902,database:"tsdb",user,password,
    ssl:{rejectUnauthorized:true},connectionTimeoutMillis:7000,
    query_timeout:16000,statement_timeout:12000,
    application_name:"scf_human_candidate_receipt_dev"};
}
export function assertGateAudit(row){
  assert.equal(row.role_exists,true);
  assert.equal(row.role_is_no_login,true);
  assert.equal(row.ci_select_registry,false);
  assert.equal(row.ci_insert_registry,false);
  assert.equal(row.ci_read_receipts,false);
  assert.equal(row.ci_insert_receipts,false);
  assert.equal(row.ci_execute_submit,false);
  assert.equal(row.reviewer_group_read_receipts,false);
  assert.equal(row.reviewer_group_insert_receipts,false);
  assert.equal(row.reviewer_group_execute_submit,true);
  assert.ok(Number.isInteger(Number(row.reviewer_count)) && Number(row.reviewer_count)>=0);
  assert.ok(Number.isInteger(Number(row.active_reviewer_count)) &&
    Number(row.active_reviewer_count)>=0);
  assert.ok(Number.isInteger(Number(row.receipt_count))&&Number(row.receipt_count)>=0);
  assert.equal(Number(row.unregistered_role_members),0,
    "Unverified or unregistered individual reviewer group membership");
  return row;
}
export const gateAuditSql=()=>
  "SELECT "+
  "EXISTS(SELECT 1 FROM pg_roles WHERE rolname='scf_dev_qualified_reviewers') AS role_exists,"+
  "EXISTS(SELECT 1 FROM pg_roles WHERE rolname='scf_dev_qualified_reviewers' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreaterole) AS role_is_no_login,"+
  "has_table_privilege('scf_evidence_ci_writer','"+SCHEMA+".qualified_reviewers','SELECT') AS ci_select_registry,"+
  "has_table_privilege('scf_evidence_ci_writer','"+SCHEMA+".qualified_reviewers','INSERT') AS ci_insert_registry,"+
  "has_table_privilege('scf_evidence_ci_writer','"+SCHEMA+".qualified_human_reviews','SELECT') AS ci_read_receipts,"+
  "has_table_privilege('scf_evidence_ci_writer','"+SCHEMA+".qualified_human_reviews','INSERT') AS ci_insert_receipts,"+
  "has_function_privilege('scf_evidence_ci_writer', "+
  "(SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace "+
  " WHERE n.nspname='"+SCHEMA+"' AND p.proname='submit_qualified_review'), 'EXECUTE') AS ci_execute_submit,"+
  "has_table_privilege('scf_dev_qualified_reviewers','"+SCHEMA+".qualified_human_reviews','SELECT') AS reviewer_group_read_receipts,"+
  "has_table_privilege('scf_dev_qualified_reviewers','"+SCHEMA+".qualified_human_reviews','INSERT') AS reviewer_group_insert_receipts,"+
  "has_function_privilege('scf_dev_qualified_reviewers', "+
  "(SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace "+
  " WHERE n.nspname='"+SCHEMA+"' AND p.proname='submit_qualified_review'), 'EXECUTE') AS reviewer_group_execute_submit,"+
  "(SELECT COUNT(*) FROM "+SCHEMA+".qualified_reviewers) AS reviewer_count,"+
  "(SELECT COUNT(*) FROM "+SCHEMA+".qualified_reviewers WHERE status='ACTIVE' AND credential_expires_at>now()) AS active_reviewer_count,"+
  "(SELECT COUNT(*) FROM "+SCHEMA+".qualified_human_reviews) AS receipt_count,"+
  "(SELECT COUNT(*) FROM pg_auth_members m "+
  "JOIN pg_roles g ON g.oid=m.roleid JOIN pg_roles member ON member.oid=m.member "+
  "WHERE g.rolname='scf_dev_qualified_reviewers' AND member.rolname<>'tsdbadmin' "+
  "AND NOT EXISTS (SELECT 1 FROM "+SCHEMA+".qualified_reviewers reg "+
  "WHERE reg.login_name=member.rolname AND reg.status='ACTIVE' "+
  "AND reg.revoked_at IS NULL AND reg.verified_at<=now() "+
  "AND reg.credential_expires_at>now())) AS unregistered_role_members";

async function adminDb(){
  const conn=getLabConnection(SERVICE,"verify");
  assertDevAdmin(SERVICE,conn);
  const db=new Client({host:HOST,port:30902,database:"tsdb",user:conn.PGUSER,
    password:conn.PGPASSWORD,ssl:{rejectUnauthorized:true},
    connectionTimeoutMillis:8000,query_timeout:26000,statement_timeout:22000,
    application_name:"scf_human_review_dev_gate_admin"});
  await db.connect();return db;
}

export async function setupGates(connect=adminDb,ddl=fs.readFileSync(SQL,"utf8")){
  const db=await connect();let active=false;
  try{
    await db.query("BEGIN");active=true;
    await db.query("SET LOCAL lock_timeout='4000ms'");
    await db.query("SELECT pg_advisory_xact_lock(202611, 924)");
    await db.query(ddl);
    await db.query("COMMIT");active=false;
    return await auditGates(async()=>db,false);
  }catch{
    if(active)await db.query("ROLLBACK").catch(()=>undefined);
    throw Error("DEV qualified-reviewer gates setup failed closed; no credentials logged");
  }finally{await db.end().catch(()=>undefined);}
}
export async function auditGates(connect=adminDb,owns=true){
  const db=await connect();let active=false;
  try{
    await db.query("BEGIN READ ONLY");active=true;
    const r=await db.query(gateAuditSql());
    assert.equal(r.rows.length,1);
    assertGateAudit(r.rows[0]);
    await db.query("ROLLBACK");active=false;
    return {result:"DEV_QUALIFIED_REVIEWER_GATE_ISOLATION_PASS",
      reviewerCredentialsProvisioned:Number(r.rows[0].reviewer_count),
      activeQualifiedReviewers:Number(r.rows[0].active_reviewer_count),
      preliminaryReceipts:Number(r.rows[0].receipt_count),
      ciCanSubmit:false,clinicalApprovals:0,productionChanges:0};
  }catch{
    if(active)await db.query("ROLLBACK").catch(()=>undefined);
    throw Error("DEV qualified reviewer gate audit failed closed");
  }finally{if(owns)await db.end().catch(()=>undefined);}
}

const FUNCTION_ARGS="($1::text,$2::text,$3::text,$4::text,$5::timestamptz,"+
 "$6::text,$7::text,$8::text,$9::text,$10::jsonb,$11::jsonb,$12::text,$13::text,$14::text)";
export async function submitHumanReview(doc,connect=async()=>{
  const db=new Client(parseReviewerConnection(process.env.TIGER_QUALIFIED_REVIEW_DEV_URL));
  await db.connect();return db;
}){
  validateReview(doc);
  const db=await connect();let active=false;
  try{
    const identity=await db.query("SELECT session_user AS login");
    assert.equal(identity.rows.length,1);
    assert.match(identity.rows[0].login,LOGIN);
    await db.query("BEGIN");active=true;
    await db.query("SET LOCAL lock_timeout='4000ms'");
    const params=[doc.runId,doc.sourceId,doc.targetId,doc.candidatePmid,doc.reviewedAt,
      doc.clinicalDisposition,doc.studyDesignPopulation,doc.causalDirectionLimits,
      doc.confoundersAndMediation,JSON.stringify(doc.supportingEvidence),
      JSON.stringify(doc.unresolvedContradictions),doc.fullTextAccessBasis,
      doc.reviewerRationale,doc.submissionSha256];
    const res=await db.query("SELECT "+SCHEMA+".submit_qualified_review"+
      FUNCTION_ARGS+" AS review_id",params);
    assert.equal(res.rows.length,1);
    assert.match(String(res.rows[0].review_id),/^[1-9][0-9]*$/);
    await db.query("COMMIT");active=false;
    return {result:"PRIVATE_PRELIMINARY_STUDY_REVIEW_RECEIPT",
      reviewId:String(res.rows[0].review_id),receiptSha256:doc.submissionSha256,
      clinicalVerification:"NOT_GRANTED",productionAuthorization:"NOT_GRANTED"};
  }catch{
    if(active)await db.query("ROLLBACK").catch(()=>undefined);
    // Do not retry ambiguous submissions: DB may already have committed.
    throw Error("Qualified DEV review receipt not confirmed; verify status securely before retry");
  }finally{await db.end().catch(()=>undefined);}
}

async function main(argv){
  const [mode,file,flag,...extra]=argv;
  if(extra.length)throw Error("Unrecognized reviewer intake flags");
  if(mode==="validate" && typeof file==="string" && flag===undefined){
    const doc=validateReview(readSmall(file));
    return {result:"OFFLINE_REVIEW_DRAFT_SCHEMA_OK",
      receiptSha256:doc.submissionSha256,
      clinicalVerification:"NOT_GRANTED",productionAuthorization:"NOT_GRANTED"};
  }
  if(mode==="submit" && typeof file==="string" && flag==="--dev-write"){
    return await submitHumanReview(readSmall(file));
  }
  if(mode==="setup-gates" && file==="--dev-write" && flag===undefined){
    return await setupGates();
  }
  if(mode==="audit-gates" && file===undefined){
    return await auditGates();
  }
  throw Error("Usage: validate <review.json> | submit <review.json> --dev-write | setup-gates --dev-write | audit-gates");
}
function readSmall(path){
  if(fs.statSync(path).size>48000)throw Error("Review document too large");
  return JSON.parse(fs.readFileSync(path,"utf8"));
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]){
  try{console.log(JSON.stringify(await main(process.argv.slice(2))));}
  catch{console.error("Human-only DEV review command failed closed; no credentials or private study details logged");process.exitCode=1;}
}
