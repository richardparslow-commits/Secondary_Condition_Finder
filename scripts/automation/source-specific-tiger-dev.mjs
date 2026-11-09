#!/usr/bin/env node
/** Immutable research-only PubMed source/claim preflight in Tiger Cloud DEV. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { Client } from "pg";
import { getLabConnection } from "../lib/tiger-lab-client.mjs";
import { parseDevConnection } from "./tiger-evidence-dev.mjs";

const SERVICE="m8vrpmo6ec";
const HOST="m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com";
const SCHEMA="scf_source_claim_preflight_dev";
const SOURCE="dcd6681315b0b36c4a0a8270405f5446f0bd75d01465fefae1114f2206bcd7aa";
export function canonical(x){
  if(Array.isArray(x)) return "["+x.map(canonical).join(",")+"]";
  if(x && typeof x==="object")return "{"+
    Object.keys(x).sort().map(k=>JSON.stringify(k)+":"+canonical(x[k])).join(",")+"}";
  return JSON.stringify(x);
}
export function sha(x){return createHash("sha256").update(canonical(x)).digest("hex");}
const without=(x,k)=>Object.fromEntries(Object.entries(x).filter(([p])=>p!==k));

export function validate(doc){
  assert.equal(doc.schemaVersion,1);
  assert.equal(doc.scope,"PRELIMINARY_ABSTRACT_SCOPE_REVIEW_NOT_MEDICAL_VERIFICATION");
  assert.equal(doc.sourceLedgerId,SOURCE);
  assert.match(doc.curatedNotesSha256,/^[a-f0-9]{64}$/);
  assert.equal(doc.authoredReviewPacketCount,21);
  assert.equal(doc.officialPubMedSourceCount,20);
  for(const field of ["clinicalApprovals","individualVaNexusApprovals","publicationChanges",
    "originalAbstractsStored"]) assert.equal(doc[field],0);
  assert.equal(sha(without(doc,"runSha256")),doc.runSha256);
  assert.equal(doc.humanReviewCases.length,21);
  const edges=new Set(),pmids=new Set();
  for(const row of doc.humanReviewCases){
    assert.match(row.sourceId,/^[a-z0-9-]{2,90}$/);
    assert.match(row.targetId,/^[a-z0-9-]{2,90}$/);
    const key=row.sourceId+"|"+row.targetId;
    assert.ok(!edges.has(key));edges.add(key);
    assert.equal(row.medicalClaimVerification,"NOT_ASSESSED");
    assert.equal(row.individualVaNexusAssessment,"NOT_ASSESSED");
    assert.equal(row.publicationAuthorization,"NOT_GRANTED");
    assert.equal(row.humanReviewerDecision,"PENDING");
    assert.equal(row.source.fullTextReviewed,false);
    assert.equal(row.source.abstractRetainedInArtifact,false);
    assert.equal(row.source.studyToClaimVerified,"NOT_ASSESSED");
    assert.match(row.source.pmid,/^\d{4,9}$/);
    assert.ok(typeof row.source.title==="string" && row.source.title.length>=10);
    assert.ok(Array.isArray(row.source.publicationTypes));
    assert.ok(Array.isArray(row.source.commentOrCorrectionTypes));
    assert.equal(row.abstractContext.basis,"CURATED_PUBMED_ABSTRACT_ONLY");
    assert.equal(row.abstractContext.automatedClinicalVerification,"NOT_PERFORMED");
    assert.equal(row.abstractContext.humanFullTextReview,"REQUIRED");
    assert.ok(row.abstractContext.importantLimit.length>=15);
    assert.equal(sha(without(row,"contentSha256")),row.contentSha256);
    pmids.add(row.source.pmid);
  }
  assert.equal(edges.size,21);assert.equal(pmids.size,20);
  return doc;
}

const project=(doc)=>{
  const cases=doc.humanReviewCases.map(row=>({
    source_id:row.sourceId,target_id:row.targetId,payload:row,
    content_sha256:row.contentSha256,
  }));
  const publications=[...new Map(doc.humanReviewCases.map(row=>
    [row.source.pmid,row.source])).values()].map(pub=>({
    pmid:pub.pmid,payload:pub,content_sha256:sha(pub),
  }));
  assert.equal(cases.length,21);assert.equal(publications.length,20);
  return {cases,publications};
};
export function assertDevAdmin(service,conn){
  assert.equal(service,SERVICE);
  assert.equal(conn.PGHOST,HOST);
  assert.equal(conn.PGPORT,"30902");
  assert.equal(conn.PGDATABASE,"tsdb");
  assert.equal(conn.PGUSER,"tsdbadmin");
  assert.equal(conn.TIGER_LAB_ENDPOINT,"direct");
  assert.ok(conn.PGPASSWORD);
}
function statements(){
  return [
    `CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`,
    `CREATE TABLE IF NOT EXISTS ${SCHEMA}.runs(
      run_id text PRIMARY KEY CHECK(run_id ~ '^[a-f0-9]{64}$'),
      source_ledger text NOT NULL,notes_sha256 text NOT NULL,
      case_count integer NOT NULL CHECK(case_count=21),
      pubmed_count integer NOT NULL CHECK(pubmed_count=20),
      approval_state text NOT NULL DEFAULT 'NOT_GRANTED'
        CHECK(approval_state='NOT_GRANTED'),
      created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS ${SCHEMA}.cases(
      run_id text NOT NULL REFERENCES ${SCHEMA}.runs(run_id),
      source_id text NOT NULL,target_id text NOT NULL,
      payload jsonb NOT NULL,content_sha256 text NOT NULL,
      PRIMARY KEY(run_id,source_id,target_id),
      CONSTRAINT scf_claim_preflight_case_unapproved CHECK(
        payload->>'medicalClaimVerification'='NOT_ASSESSED' AND
        payload->>'publicationAuthorization'='NOT_GRANTED' AND
        payload->>'humanReviewerDecision'='PENDING' AND
        payload->>'individualVaNexusAssessment'='NOT_ASSESSED' AND
        payload->'source'->>'fullTextReviewed'='false' AND
        payload->'source'->>'abstractRetainedInArtifact'='false'))`,
    `CREATE TABLE IF NOT EXISTS ${SCHEMA}.publications(
      run_id text NOT NULL REFERENCES ${SCHEMA}.runs(run_id),
      pmid text NOT NULL CHECK(pmid ~ '^[0-9]{4,9}$'),
      payload jsonb NOT NULL,content_sha256 text NOT NULL,
      PRIMARY KEY(run_id,pmid),
      CONSTRAINT scf_claim_preflight_pub_unapproved CHECK(
        payload->>'studyToClaimVerified'='NOT_ASSESSED' AND
        payload->>'fullTextReviewed'='false' AND
        payload->>'abstractRetainedInArtifact'='false'))`,
    `REVOKE ALL ON SCHEMA ${SCHEMA} FROM PUBLIC`,
    `REVOKE ALL ON ALL TABLES IN SCHEMA ${SCHEMA} FROM PUBLIC`,
    `GRANT USAGE ON SCHEMA ${SCHEMA} TO scf_evidence_ci_writer`,
    `GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA ${SCHEMA} TO scf_evidence_ci_writer`,
  ];
}
async function open(mode){
  let cfg;
  if(mode==="setup" || !process.env.TIGER_AUTOMATION_DEV_URL){
    const conn=getLabConnection(SERVICE,"verify");
    assertDevAdmin(SERVICE,conn);
    cfg={host:HOST,port:30902,database:"tsdb",user:conn.PGUSER,
      password:conn.PGPASSWORD,ssl:{rejectUnauthorized:true},
      connectionTimeoutMillis:8000,query_timeout:26000,statement_timeout:22000,
      application_name:"scf_claim_scope_dev"};
  }else{
    cfg=parseDevConnection(process.env.TIGER_AUTOMATION_DEV_URL);
    cfg.application_name="scf_claim_scope_dev";
  }
  if(mode==="apply" && cfg.user!=="scf_evidence_ci_writer"){
    throw new Error("Only least-privileged existing DEV writer may apply");
  }
  const db=new Client(cfg);
  await db.connect();
  return db;
}
async function insert(db,table,rows,columns,run){
  const fields=columns.map(([key])=>key);
  const typed=columns.map(([key,type])=>key+" "+type).join(",");
  const sql=`INSERT INTO ${SCHEMA}.${table}(run_id,${fields.join(",")})
     SELECT $1,${fields.map(f=>"x."+f).join(",")}
     FROM jsonb_to_recordset($2::jsonb) AS x(${typed})
     ON CONFLICT DO NOTHING`;
  await db.query(sql,[run,JSON.stringify(rows)]);
}
async function compare(db,doc){
  const r=await db.query(`SELECT source_ledger,notes_sha256,case_count,pubmed_count,
    approval_state FROM ${SCHEMA}.runs WHERE run_id=$1`,[doc.runSha256]);
  assert.equal(r.rows.length,1);
  assert.deepEqual(r.rows[0],{source_ledger:SOURCE,
    notes_sha256:doc.curatedNotesSha256,case_count:21,pubmed_count:20,
    approval_state:"NOT_GRANTED"});
  const expected=project(doc);
  for(const [table,fields,key] of [
    ["cases",["source_id","target_id","payload","content_sha256"],
      row=>row.source_id+"|"+row.target_id],
    ["publications",["pmid","payload","content_sha256"],row=>row.pmid],
  ]){
    const q=await db.query(`SELECT ${fields.join(",")} FROM ${SCHEMA}.${table}
       WHERE run_id=$1`,[doc.runSha256]);
    assert.equal(q.rows.length,expected[table].length);
    const remaining=new Map(expected[table].map(row=>[key(row),row]));
    for(const row of q.rows){
      const wanted=remaining.get(key(row));assert.ok(wanted);
      assert.equal(canonical(row),canonical(wanted),"DEV row context differs");
      remaining.delete(key(row));
    }
    assert.equal(remaining.size,0);
  }
  return {result:"EXACT_SOURCE_SPECIFIC_DEV_PARITY",environment:"DEV",
    runId:doc.runSha256,reviewCases:21,uniqueOfficialPubMed:20,
    clinicalApprovals:0,publicationChanges:0};
}
export async function processSource(mode,doc){
  assert.ok(["setup","apply","verify"].includes(mode));
  validate(doc);
  const db=await open(mode);let transaction=false;
  try{
    await db.query(mode==="verify"?"BEGIN READ ONLY":"BEGIN");
    transaction=true;
    if(mode!=="verify"){
      await db.query("SET LOCAL lock_timeout='4000ms'");
      if(mode==="setup"){
        await db.query("SELECT pg_advisory_xact_lock(202611, 921)");
        for(const stmt of statements())await db.query(stmt);
      }
      await db.query(`INSERT INTO ${SCHEMA}.runs
        (run_id,source_ledger,notes_sha256,case_count,pubmed_count)
        VALUES($1,$2,$3,21,20) ON CONFLICT DO NOTHING`,
        [doc.runSha256,SOURCE,doc.curatedNotesSha256]);
      const rows=project(doc);
      await insert(db,"cases",rows.cases,[["source_id","text"],
        ["target_id","text"],["payload","jsonb"],["content_sha256","text"]],doc.runSha256);
      await insert(db,"publications",rows.publications,[["pmid","text"],
        ["payload","jsonb"],["content_sha256","text"]],doc.runSha256);
    }
    const result=await compare(db,doc);
    await db.query(mode==="verify"?"ROLLBACK":"COMMIT");
    transaction=false;return result;
  }catch{
    if(transaction)await db.query("ROLLBACK").catch(()=>undefined);
    throw new Error("DEV clinical preflight operation failed; inspect before retry");
  }finally{await db.end().catch(()=>undefined);}
}
if(process.argv[1]?.endsWith("source-specific-tiger-dev.mjs")){
  const mode=process.argv[2],flags=process.argv.slice(3);
  const valid=(["setup","apply"].includes(mode) && flags.length===1
    && flags[0]==="--dev-write") || (mode==="verify" && flags.length===0);
  if(!valid){console.error("Usage: setup --dev-write | apply --dev-write | verify");process.exitCode=1;}
  else{
    try{
      const doc=JSON.parse(fs.readFileSync(
        process.env.SCF_SOURCE_CLAIM_FILE||"/tmp/scf-source-specific-review/source-claim-21-run.json","utf8"));
      console.log(JSON.stringify(await processSource(mode,doc)));
    }catch{console.error("DEV source-specific verification failed; secrets withheld");process.exitCode=1;}
  }
}
