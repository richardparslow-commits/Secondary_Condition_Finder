#!/usr/bin/env node
/** Tiger DEV-only, immutable bibliographic and ontology *triage*, not medical approval. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { Client } from "pg";
import { getLabConnection } from "../lib/tiger-lab-client.mjs";
import { parseDevConnection } from "./tiger-evidence-dev.mjs";

const SERVICE="m8vrpmo6ec";
const HOST="m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com";
const DB="tsdb";
const SCHEMA="scf_clinical_triage_dev";
const DIR="/tmp/scf-clinical-accuracy-triage";
const IDENTITY="./scripts/automation/fixtures/mondo-v2026-10-06/identity-review-candidates.json";
const SOURCE_LEDGER="dcd6681315b0b36c4a0a8270405f5446f0bd75d01465fefae1114f2206bcd7aa";
const ONTOLOGY="a165dc2fc61761f5e5413b6395dd4afb14c89d78783af213a9b8f1d0a3f2a8c7";
const NO_APPROVAL="NOT_GRANTED";

function canonical(x) {
  if (Array.isArray(x)) return "["+x.map(canonical).join(",")+"]";
  if (x && typeof x==="object") return "{"+
    Object.keys(x).sort().map(k=>JSON.stringify(k)+":"+canonical(x[k])).join(",")+"}";
  return JSON.stringify(x);
}
export function sha(x) {
  return createHash("sha256").update(canonical(x)).digest("hex");
}
function without(obj,key) {
  return Object.fromEntries(Object.entries(obj).filter(([k])=>k!==key));
}
export function validate(identity,run) {
  assert.equal(identity.schemaVersion,1);
  assert.equal(identity.ontologySnapshot,ONTOLOGY);
  assert.equal(identity.conditionsNeedingIdentityReview,375);
  assert.equal(identity.ambiguousExistingExact,51);
  assert.equal(identity.noExactLexical,324);
  assert.equal(identity.automaticOntologyDecisions,0);
  assert.equal(identity.clinicalApproval,NO_APPROVAL);
  assert.equal(identity.records.length,375);
  assert.equal(sha(without(identity,"snapshotSha256")),identity.snapshotSha256);
  const ids=new Set();
  let ambiguous=0,unmatched=0;
  for (const r of identity.records) {
    assert.match(r.conditionId,/^[a-z0-9-]{2,90}$/);
    assert.ok(!ids.has(r.conditionId),"Duplicate exception identity");
    ids.add(r.conditionId);
    assert.equal(r.humanIdentityReviewState,"NOT_ASSESSED");
    assert.equal(r.catalogChangeAuthorized,false);
    assert.equal(r.suggestedMatchesAreMedicalEquivalence,false);
    assert.equal(sha(without(r,"rowSha256")),r.rowSha256);
    if (r.existingOntologyAudit==="AMBIGUOUS_LEXICAL_CANDIDATES")ambiguous++;
    else if(r.existingOntologyAudit==="NO_EXACT_ONTOLOGY_MATCH")unmatched++;
    else throw new Error("Unknown ontology exception class");
    for (const c of r.reviewCandidates) {
      assert.equal(c.medicalEquivalence,"NOT_ASSESSED");
      assert.match(c.mondo,/^MONDO:\d{7}$/);
    }
  }
  assert.equal(ambiguous,51);
  assert.equal(unmatched,324);
  assert.equal(run.schemaVersion,1);
  assert.equal(run.campaign,"CLINICAL_ACCURACY_TRIAGE_NOT_APPROVAL");
  assert.equal(run.sourceLedgerRunId,SOURCE_LEDGER);
  assert.equal(run.ontologySnapshot,ONTOLOGY);
  assert.equal(run.ontologyReviewFixtureSha256,identity.snapshotSha256);
  assert.equal(run.highPriorityPublishedPathways,21);
  assert.equal(run.distinctCitedPubMedRecords,20);
  assert.equal(run.identityExceptions,375);
  assert.equal(run.existingAmbiguous,51);
  assert.equal(run.previouslyUnmatched,324);
  assert.equal(run.automaticClinicalApprovals,0);
  assert.equal(run.automaticTerminologyApprovals,0);
  assert.equal(run.productionChanges,0);
  assert.match(run.runSha256,/^[a-f0-9]{64}$/);
  assert.equal(sha(without(run,"runSha256")),run.runSha256);
  assert.equal(run.priorityPathways.length,21);
  assert.equal(run.publicationMetadata.length,20);
  const cases=new Set(),pmids=new Set();
  for (const r of run.priorityPathways) {
    assert.equal(r.publicationState,"PUBLISHED");
    assert.equal(r.reasonedClinicalDisposition,"QUALIFIED_HUMAN_REVIEW_REQUIRED");
    assert.equal(r.medicalClaimVerification,"NOT_ASSESSED");
    assert.equal(r.individualVaNexusDetermination,"NOT_ASSESSED");
    assert.equal(r.productionPublishAuthorization,NO_APPROVAL);
    assert.equal(r.researcherProposedChange,"NONE_AUTOMATICALLY");
    assert.equal(sha(without(r,"rowSha256")),r.rowSha256);
    const key=r.sourceId+"|"+r.targetId;
    assert.ok(!cases.has(key));
    cases.add(key);
    assert.ok(r.originalReferencePmids.length>0);
  }
  for (const r of run.publicationMetadata) {
    assert.match(r.pmid,/^\d{4,9}$/);
    assert.ok(!pmids.has(r.pmid));
    pmids.add(r.pmid);
    assert.equal(r.sourceClaimVerification,"NOT_ASSESSED");
    assert.ok(["METADATA_RETRIEVED","PUBLICATION_STATUS_REVIEW","UNRESOLVED"].includes(r.metadataStatus));
    assert.ok(["CHECKED","UNAVAILABLE"].includes(r.efetchStatus));
    assert.equal(r.originalAbstractStored,false);
  }
  assert.equal(pmids.size,20);
  assert.ok(run.priorityPathways.every(r=>r.originalReferencePmids.every(p=>pmids.has(p))));
  return true;
}
function sourceRows(identity,run) {
  return {
    identities:identity.records.map(x=>({
      condition_id:x.conditionId,ontology_status:x.existingOntologyAudit,
      payload:x,content_sha256:x.rowSha256,
    })),
    cases:run.priorityPathways.map(x=>({
      source_id:x.sourceId,target_id:x.targetId,payload:x,content_sha256:x.rowSha256,
    })),
    publications:run.publicationMetadata.map(x=>({
      pmid:x.pmid,payload:x,content_sha256:sha(x),
    })),
  };
}
function ddl() {
  return [
    `CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`,
    `CREATE TABLE IF NOT EXISTS ${SCHEMA}.runs (
      run_id text PRIMARY KEY CHECK(run_id ~ '^[a-f0-9]{64}$'),
      source_ledger text NOT NULL,
      ontology_snapshot text NOT NULL,
      identity_digest text NOT NULL,
      review_cases integer NOT NULL CHECK(review_cases=21),
      source_records integer NOT NULL CHECK(source_records=20),
      identity_exceptions integer NOT NULL CHECK(identity_exceptions=375),
      approval_state text NOT NULL DEFAULT 'NOT_GRANTED' CHECK(approval_state='NOT_GRANTED'),
      created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS ${SCHEMA}.identities(
      run_id text NOT NULL REFERENCES ${SCHEMA}.runs(run_id),
      condition_id text NOT NULL,
      ontology_status text NOT NULL CHECK(ontology_status IN
        ('NO_EXACT_ONTOLOGY_MATCH','AMBIGUOUS_LEXICAL_CANDIDATES')),
      payload jsonb NOT NULL,content_sha256 text NOT NULL,
      PRIMARY KEY(run_id,condition_id))`,
    `CREATE TABLE IF NOT EXISTS ${SCHEMA}.cases(
      run_id text NOT NULL REFERENCES ${SCHEMA}.runs(run_id),
      source_id text NOT NULL,target_id text NOT NULL,
      payload jsonb NOT NULL,content_sha256 text NOT NULL,
      PRIMARY KEY(run_id,source_id,target_id))`,
    `CREATE TABLE IF NOT EXISTS ${SCHEMA}.publications(
      run_id text NOT NULL REFERENCES ${SCHEMA}.runs(run_id),
      pmid text NOT NULL CHECK(pmid ~ '^[0-9]{4,9}$'),
      payload jsonb NOT NULL,content_sha256 text NOT NULL,
      PRIMARY KEY(run_id,pmid))`,
    `CREATE INDEX IF NOT EXISTS clinical_triage_state_idx
      ON ${SCHEMA}.identities(run_id,ontology_status)`,
    `CREATE INDEX IF NOT EXISTS clinical_triage_pubmed_idx
      ON ${SCHEMA}.publications(pmid)`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='scf_triage_identity_unapproved') THEN
        ALTER TABLE ${SCHEMA}.identities ADD CONSTRAINT scf_triage_identity_unapproved
          CHECK (payload->>'humanIdentityReviewState'='NOT_ASSESSED' AND
                 payload->>'catalogChangeAuthorized'='false');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='scf_triage_case_unapproved') THEN
        ALTER TABLE ${SCHEMA}.cases ADD CONSTRAINT scf_triage_case_unapproved
          CHECK (payload->>'medicalClaimVerification'='NOT_ASSESSED' AND
                 payload->>'productionPublishAuthorization'='NOT_GRANTED');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='scf_triage_pubmed_unapproved') THEN
        ALTER TABLE ${SCHEMA}.publications ADD CONSTRAINT scf_triage_pubmed_unapproved
          CHECK (payload->>'sourceClaimVerification'='NOT_ASSESSED');
      END IF;
    END $$`,
    `REVOKE ALL ON SCHEMA ${SCHEMA} FROM PUBLIC`,
    `GRANT USAGE ON SCHEMA ${SCHEMA} TO scf_evidence_ci_writer`,
    `GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA ${SCHEMA} TO scf_evidence_ci_writer`,
  ];
}
export function assertDevAdmin(service,conn) {
  assert.equal(service,SERVICE);
  assert.equal(conn.PGHOST,HOST);
  assert.equal(conn.PGPORT,"30902");
  assert.equal(conn.PGUSER,"tsdbadmin");
  assert.equal(conn.PGDATABASE,DB);
  assert.equal(conn.TIGER_LAB_ENDPOINT,"direct");
  assert.ok(conn.PGPASSWORD);
}
async function connect(mode) {
  let cfg;
  if (mode==="setup" || !process.env.TIGER_AUTOMATION_DEV_URL) {
    const conn=getLabConnection(SERVICE,"verify");
    assertDevAdmin(SERVICE,conn);
    cfg={
      host:HOST,port:30902,database:DB,user:conn.PGUSER,
      password:conn.PGPASSWORD,ssl:{rejectUnauthorized:true},
      connectionTimeoutMillis:8000,query_timeout:25000,
      statement_timeout:22000,application_name:"scf_clinical_triage_dev",
    };
  } else {
    cfg=parseDevConnection(process.env.TIGER_AUTOMATION_DEV_URL);
    cfg.application_name="scf_clinical_triage_dev";
  }
  if(mode==="apply" && cfg.user!=="scf_evidence_ci_writer") {
    throw new Error("Only the least-privilege DEV research role may apply snapshots");
  }
  const db=new Client(cfg);
  await db.connect();
  return db;
}
const COLUMNS={
  identities:[["condition_id","text"],["ontology_status","text"],
    ["payload","jsonb"],["content_sha256","text"]],
  cases:[["source_id","text"],["target_id","text"],
    ["payload","jsonb"],["content_sha256","text"]],
  publications:[["pmid","text"],["payload","jsonb"],["content_sha256","text"]],
};
async function insertRows(db,table,rows,runId) {
  const cols=COLUMNS[table];
  const fields=cols.map(([field])=>field);
  const recordset=cols.map(([field,type])=>field+" "+type).join(",");
  const sql=`INSERT INTO ${SCHEMA}.${table}(run_id,${fields.join(",")})
    SELECT $1,${fields.map(f=>"x."+f).join(",")} FROM
    jsonb_to_recordset($2::jsonb) AS x(${recordset}) ON CONFLICT DO NOTHING`;
  for (let i=0;i<rows.length;i+=90) {
    await db.query(sql,[runId,JSON.stringify(rows.slice(i,i+90))]);
  }
}
async function verifyRows(db,identity,run) {
  const info=await db.query(
    `SELECT source_ledger,ontology_snapshot,identity_digest,review_cases,
      source_records,identity_exceptions,approval_state
      FROM ${SCHEMA}.runs WHERE run_id=$1`,[run.runSha256]);
  assert.equal(info.rows.length,1);
  assert.deepEqual(info.rows[0],{
    source_ledger:SOURCE_LEDGER,ontology_snapshot:ONTOLOGY,
    identity_digest:identity.snapshotSha256,review_cases:21,
    source_records:20,identity_exceptions:375,approval_state:NO_APPROVAL,
  });
  const expected=sourceRows(identity,run);
  for (const table of ["identities","cases","publications"]) {
    const fieldNames=COLUMNS[table].map(([name])=>name);
    const results=await db.query(
      `SELECT ${fieldNames.join(",")} FROM ${SCHEMA}.${table} WHERE run_id=$1`,
      [run.runSha256]);
    assert.equal(results.rows.length,expected[table].length);
    const key=(row)=>{
      if(table==="identities")return row.condition_id;
      if(table==="publications")return row.pmid;
      return row.source_id+"|"+row.target_id;
    };
    const pending=new Map(expected[table].map(row=>[key(row),row]));
    for(const row of results.rows) {
      const wanted=pending.get(key(row));
      assert.ok(wanted,"Unrecognized DEV clinical triage row");
      assert.equal(canonical(row),canonical(wanted),
        "Stored triage metadata or state differs from source");
      pending.delete(key(row));
    }
    assert.equal(pending.size,0);
  }
  return {
    result:"EXACT_CLINICAL_TRIAGE_DEV_PARITY",environment:"DEV",
    runId:run.runSha256,reviewCases:21,publicationRecords:20,
    identityReviewRows:375,clinicalApprovals:0,terminologyApprovals:0,
  };
}
export async function processTriage(mode,identity,run) {
  assert.ok(["setup","apply","verify"].includes(mode));
  validate(identity,run);
  const db=await connect(mode);
  let tx=false;
  try{
    await db.query(mode==="verify"?"BEGIN READ ONLY":"BEGIN");
    tx=true;
    if(mode!=="verify"){
      await db.query("SET LOCAL lock_timeout='4000ms'");
      if(mode==="setup"){
        await db.query("SELECT pg_advisory_xact_lock(202611, 910)");
        for (const sql of ddl())await db.query(sql);
      }
      await db.query(
        `INSERT INTO ${SCHEMA}.runs
         (run_id,source_ledger,ontology_snapshot,identity_digest,
          review_cases,source_records,identity_exceptions)
         VALUES ($1,$2,$3,$4,21,20,375) ON CONFLICT DO NOTHING`,
        [run.runSha256,SOURCE_LEDGER,ONTOLOGY,identity.snapshotSha256]);
      const rows=sourceRows(identity,run);
      for (const table of ["identities","cases","publications"]) {
        await insertRows(db,table,rows[table],run.runSha256);
      }
    }
    const result=await verifyRows(db,identity,run);
    await db.query(mode==="verify"?"ROLLBACK":"COMMIT");
    tx=false;
    return result;
  } catch {
    if(tx)await db.query("ROLLBACK").catch(()=>undefined);
    throw new Error("DEV-only clinical triage operation failed; inspect before retry");
  } finally {
    await db.end().catch(()=>undefined);
  }
}
if(process.argv[1]?.endsWith("clinical-accuracy-tiger-dev.mjs")) {
  const mode=process.argv[2];
  const flags=process.argv.slice(3);
  const valid=["setup","apply"].includes(mode)
    ? flags.length===1 && flags[0]==="--dev-write"
    : mode==="verify" && flags.length===0;
  if(!valid){
    console.error("Usage: setup --dev-write | apply --dev-write | verify");
    process.exitCode=1;
  } else {
    try{
      const path=process.env.SCF_CLINICAL_TRIAGE_DIR||DIR;
      const identity=JSON.parse(fs.readFileSync(IDENTITY,"utf8"));
      const run=JSON.parse(fs.readFileSync(path+"/triage-run.json","utf8"));
      console.log(JSON.stringify(await processTriage(mode,identity,run)));
    }catch{
      console.error("DEV clinical accuracy triage failed; secrets withheld");
      process.exitCode=1;
    }
  }
}
