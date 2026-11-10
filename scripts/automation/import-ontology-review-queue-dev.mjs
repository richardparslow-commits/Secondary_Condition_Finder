#!/usr/bin/env node
/** DEV-only immutable candidate-review queue SQL. No medical verification. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const CONFIG={"count": 1000, "coverage": "ontology-coverage.json", "file": "ontology-candidate-review.json", "keyFields": ["mondo_id"], "lockId": 936, "rowSourceDigest": "source_snapshot", "schema": "scf_ontology_candidate_queue_dev", "sourceDigest": "pinned_snapshot", "statusField": "medical_identity"};
const STATUS="NOT_REVIEWED";
const SCHEMA=CONFIG.schema;
export const APPROVED_SNAPSHOT="a165dc2fc61761f5e5413b6395dd4afb14c89d78783af213a9b8f1d0a3f2a8c7";
export const APPROVED_RELEASE="v2026-10-06";
const EXPECTED_APP_CATALOG=819;
const ROW_FIELDS=["decision","label","medical_identity","mondo_id","publication_status","review_date","reviewer","source_release","source_snapshot","triage_bucket"];
const TRIAGE_BUCKETS=new Set(["cardiopulmonary","immune-endocrine","mental-health","oncology-tumors","other","rare-genetic","rare-hematology","renal-gastrointestinal","skeletal-musculoskeletal","tbi-neurology"]);
assert.match(SCHEMA,/^scf_[a-z0-9_]+_dev$/);
const sha=s=>createHash("sha256").update(s).digest("hex");
function canonical(x){
 if(Array.isArray(x))return "["+x.map(canonical).join(",")+"]";
 if(x&&typeof x==="object")return "{"+Object.keys(x).sort().map(k=>JSON.stringify(k)+":"+canonical(x[k])).join(",")+"}";
 return JSON.stringify(x);
}
const hash=x=>sha(canonical(x));
export function validateRow(row){
 assert.deepEqual(Object.keys(row).sort(),[...ROW_FIELDS].sort(),"Unexpected review row fields");
 for(const field of ROW_FIELDS)assert.equal(typeof row[field],"string","Review row field must be text: "+field);
 assert.match(row.mondo_id,/^MONDO:\d{7}$/);
 assert.equal(row.source_snapshot,APPROVED_SNAPSHOT,"Review row is not from the approved MONDO snapshot");
 assert.equal(row.source_release,APPROVED_RELEASE,"Review row is not from the approved MONDO release");
 assert.equal(row.publication_status,"DEV_RESEARCH_ONLY","Review row publication status must remain DEV_RESEARCH_ONLY");
 assert.equal(row.medical_identity,STATUS,"Review row identity status must remain NOT_REVIEWED");
 assert.equal(row.reviewer,"","Reviewer must remain blank");
 assert.equal(row.review_date,"","Review date must remain blank");
 assert.equal(row.decision,"","Decision must remain blank");
 assert.ok(TRIAGE_BUCKETS.has(row.triage_bucket),"Unknown triage bucket");
 assert.ok(row.label.length>=6&&row.label.length<=180,"Review label length out of bounds");
 assert.equal(row.label,row.label.trim(),"Review label must be trimmed");
 assert.ok(![...row.label].some(ch=>{const code=ch.codePointAt(0);return code<32||code===127}),"Review label contains control characters");
}
export function validateQueue(queue,coverage){
 assert.deepEqual(Object.keys(queue).sort(),["clinicalApproval","rows","snapshot"],"Unexpected review queue fields");
 assert.ok(Array.isArray(queue.rows),"Review queue rows must be an array");
 assert.equal(queue.clinicalApproval,"NOT_GRANTED");
 assert.equal(queue.snapshot,APPROVED_SNAPSHOT,"Review queue does not use the approved MONDO snapshot");
 assert.equal(coverage.pinned_snapshot,APPROVED_SNAPSHOT,"Coverage report does not use the approved MONDO snapshot");
 assert.equal(coverage.release,APPROVED_RELEASE,"Coverage report does not use the approved MONDO release");
 assert.equal(queue.snapshot,coverage.pinned_snapshot);
 assert.equal(queue.rows.length,CONFIG.count);
 assert.equal(coverage.review_queue_rows,CONFIG.count);
 assert.equal(coverage.app_catalog_unchanged,EXPECTED_APP_CATALOG);
 assert.equal(coverage.medically_verified_new_conditions,0);
 assert.equal(coverage.automatically_published_to_app,0);
 const keys=new Set();
 const rows=queue.rows.map(row=>{
  validateRow(row);
  const key=CONFIG.keyFields.map(field=>row[field]).join("--");
  assert.match(key,/^[a-zA-Z0-9_:-]{4,150}$/);
  assert.ok(!keys.has(key),"Duplicated review row");keys.add(key);
  return {key,recordHash:hash(row),status:STATUS,details:row};
 });
 const d={schemaVersion:1,sourceSnapshot:queue.snapshot,reviewStatus:STATUS,
  count:rows.length,rows};
 return {...d,runId:hash(d)};
}
export function prepare(root=new URL("../../",import.meta.url)){
 const queue=JSON.parse(readFileSync(new URL("docs/research-dev/"+CONFIG.file,root),"utf8"));
 const coverage=JSON.parse(readFileSync(new URL("docs/research-dev/"+CONFIG.coverage,root),"utf8"));
 return validateQueue(queue,coverage);
}
async function connect(){
 // Load the database driver and Tiger helpers only for SQL modes; deterministic
 // validation must remain runnable without a database dependency.
 const [{ getLabConnection },{ DEV_SERVICE, assertDevTarget }]=await Promise.all([
  import("../lib/tiger-lab-client.mjs"),import("../lib/medical-reference-tiger-dev.mjs")]);
 // getLabConnection verifies exact service ID, service name, READY, DEV tag,
 // TLS endpoint and credentials. Never pass patient content to any SQL.
 const conn=getLabConnection(DEV_SERVICE,"verify");
 assertDevTarget(DEV_SERVICE,conn);
 const { Client }=await import("pg");
 const client=new Client({host:conn.PGHOST,port:Number(conn.PGPORT),database:conn.PGDATABASE,
  user:conn.PGUSER,password:conn.PGPASSWORD,ssl:{rejectUnauthorized:true},
  connectionTimeoutMillis:8000,query_timeout:30000,statement_timeout:25000,
  application_name:"scf_public_review_queue_DEV"});
 try{
  await client.connect();
  const identity=await client.query("SELECT current_database() AS db,current_user AS role");
  assert.equal(identity.rows[0].db,"tsdb");assert.equal(identity.rows[0].role,"tsdbadmin");
  return client;
 }catch(e){
  await client.end().catch(()=>{});
  throw e;
 }
}
async function parity(client,d){
 const run=await client.query("SELECT source_snapshot,review_status,row_count FROM "+
   SCHEMA+".runs WHERE run_id=$1",[d.runId]);
 assert.equal(run.rows.length,1);assert.equal(run.rows[0].source_snapshot,d.sourceSnapshot);
 assert.equal(run.rows[0].review_status,STATUS);assert.equal(run.rows[0].row_count,d.count);
 const records=await client.query("SELECT record_key,record_hash,review_status,details FROM "+
   SCHEMA+".review_queue WHERE run_id=$1",[d.runId]);
 assert.equal(records.rows.length,d.count);
 const expected=new Map(d.rows.map(x=>[x.key,x]));
 for(const row of records.rows){
  const v=expected.get(row.record_key);
  assert.ok(v,"Unanticipated queue row");
  assert.equal(row.review_status,STATUS);
  assert.equal(row.record_hash,v.recordHash);
  assert.deepEqual(row.details,v.details);
  expected.delete(row.record_key);
 }
 assert.equal(expected.size,0,"Missing rows");
}
async function execute(mode,d){
 const { DEV_SERVICE }=await import("../lib/medical-reference-tiger-dev.mjs");
 const c=await connect();let active=false;
 try{
  await c.query(mode==="verify"?"BEGIN READ ONLY":"BEGIN");active=true;
  await c.query("SET LOCAL statement_timeout='25000ms'");
  if(mode==="apply"){
   await c.query("SET LOCAL lock_timeout='3000ms'");
   await c.query("SELECT pg_advisory_xact_lock(202611,"+CONFIG.lockId+")");
   await c.query("CREATE SCHEMA IF NOT EXISTS "+SCHEMA);
   await c.query("CREATE TABLE IF NOT EXISTS "+SCHEMA+".runs ("+
     "run_id text PRIMARY KEY CHECK(run_id ~ '^[a-f0-9]{64}$'),"+
     "source_snapshot text NOT NULL CHECK(source_snapshot ~ '^[a-f0-9]{64}$'),"+
     "review_status text NOT NULL CHECK(review_status='"+STATUS+"'),"+
     "row_count integer NOT NULL CHECK(row_count BETWEEN 1 AND 1500),"+
     "created_at timestamptz NOT NULL DEFAULT now())");
   await c.query("CREATE TABLE IF NOT EXISTS "+SCHEMA+".review_queue ("+
     "run_id text NOT NULL REFERENCES "+SCHEMA+".runs(run_id),"+
     "record_key text NOT NULL,record_hash text NOT NULL CHECK(record_hash ~ '^[a-f0-9]{64}$'),"+
     "review_status text NOT NULL CHECK(review_status='"+STATUS+"'),"+
     "details jsonb NOT NULL CHECK(details->>'"+CONFIG.statusField+"'='"+STATUS+"'),"+
     "PRIMARY KEY(run_id,record_key))");
   await c.query("REVOKE ALL ON SCHEMA "+SCHEMA+" FROM PUBLIC");
   await c.query("REVOKE ALL ON ALL TABLES IN SCHEMA "+SCHEMA+" FROM PUBLIC");
   await c.query("INSERT INTO "+SCHEMA+".runs(run_id,source_snapshot,review_status,row_count) "+
     "VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
     [d.runId,d.sourceSnapshot,STATUS,d.count]);
   for(let i=0;i<d.rows.length;i+=100){
     const batch=d.rows.slice(i,i+100).map(r=>({key:r.key,digest:r.recordHash,details:r.details}));
     await c.query("INSERT INTO "+SCHEMA+
      ".review_queue(run_id,record_key,record_hash,review_status,details) "+
      "SELECT $1,v.key,v.digest,'"+STATUS+"',v.details "+
      "FROM jsonb_to_recordset($2::jsonb) AS v(key text,digest text,details jsonb) "+
      "ON CONFLICT DO NOTHING",[d.runId,JSON.stringify(batch)]);
   }
  }
  await parity(c,d);
  await c.query("COMMIT");active=false;
  return {result:mode==="apply"?"DEV_REVIEW_QUEUE_APPLIED":"DEV_REVIEW_QUEUE_PARITY",
   service:DEV_SERVICE,schema:SCHEMA,sourceSnapshot:d.sourceSnapshot,runId:d.runId,
   queued:d.rows.length,humanApprovals:0,productionChanges:0};
 }catch(e){if(active)await c.query("ROLLBACK").catch(()=>{});throw e}
 finally{await c.end().catch(()=>{})}
}
async function main(){
 const mode=process.argv[2],args=process.argv.slice(3);
 assert.ok(["check","apply","verify"].includes(mode));
 assert.deepEqual(args,mode==="apply"?["--dev-write"]:[]);
 const d=prepare();
 if(mode==="check"){
  console.log(JSON.stringify({result:"REVIEW_QUEUE_VALID",schema:SCHEMA,count:d.count,
   runId:d.runId,humanApprovals:0}));return;
 }
 console.log(JSON.stringify(await execute(mode,d)));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch((e)=>{
  if(process.argv[2]==="check")console.error("DEV queue validation: "+String(e.message).slice(0,180));
  else console.error("DEV SQL operation failed; inspect live rows before any retry; credentials hidden.");
  process.exitCode=1;
 });
}
