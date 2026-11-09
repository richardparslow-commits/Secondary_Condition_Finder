#!/usr/bin/env node
/** Tiger Cloud DEV-only, immutable, review-only condition/pathway ledger. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { Client } from "pg";
import { getLabConnection } from "./lib/tiger-lab-client.mjs";

const SERVICE = "m8vrpmo6ec";
const HOST = "m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com";
const SCHEMA = "scf_clinical_review_dev";
const ONTOLOGY = "a165dc2fc61761f5e5413b6395dd4afb14c89d78783af213a9b8f1d0a3f2a8c7";
const INPUT = "/tmp/scf-clinical-review-batch1/clinical-review-ledger.json";
const HIGH = new Set(["CAUSAL_CLASSIFICATION_WITH_LIMITING_EVIDENCE_LANGUAGE",
  "CAUSAL_CLASSIFICATION_WITH_HYPOTHESIZED_MECHANISM",
  "INDIVIDUAL_NEXUS_ASSERTION_IN_GENERIC_KNOWLEDGE_BASE",
  "INDIVIDUAL_PROBABILITY_ALIGNMENT_REVIEW",
  "LEGAL_AUTHORITY_MISUSED_AS_CLINICAL_EVIDENCE"]);
const NEXUS = new Set(["ASSOCIATION_ONLY", "DIRECT_CAUSATION", "AGGRAVATION"]);

export function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object") return "{" +
    Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
export function digest(v) {
  return createHash("sha256").update(canonical(v)).digest("hex");
}
export function assertDev(service, conn) {
  assert.equal(service, SERVICE, "Refuse non-DEV service");
  assert.equal(conn.PGHOST, HOST, "Refuse unknown or PROD host");
  assert.equal(conn.PGPORT, "30902");
  assert.equal(conn.PGDATABASE, "tsdb");
  assert.equal(conn.PGUSER, "tsdbadmin");
  assert.equal(conn.TIGER_LAB_ENDPOINT, "direct");
  assert.ok(conn.PGPASSWORD);
}
export function validateLedger(doc) {
  assert.equal(doc.schemaVersion, 1);
  assert.equal(doc.ontologySnapshot, ONTOLOGY);
  assert.equal(doc.clinicalApproval, "NOT_GRANTED");
  assert.equal(doc.conditionCount, 819);
  assert.equal(doc.pathwayCount, 875);
  assert.equal(doc.sourceReferenceCount, 1704);
  for (const key of ["runId","catalogDigest","knowledgeBaseDigest","sourceRegistryDigest"]) {
    assert.match(doc[key], /^[a-f0-9]{64}$/);
  }
  const { runId, ...rest } = doc;
  assert.equal(digest(rest), runId, "Immutable review-ledger digest mismatch");
  assert.ok(Array.isArray(doc.conditions) && doc.conditions.length === 819);
  assert.ok(Array.isArray(doc.pathways) && doc.pathways.length === 875);
  const conditions = new Map();
  for (const r of doc.conditions) {
    assert.match(r.id, /^[a-z0-9-]{2,90}$/);
    assert.ok(!conditions.has(r.id), "Duplicate condition");
    assert.equal(r.clinicalApproval, "NOT_GRANTED");
    assert.equal(r.reviewState, "HUMAN_IDENTITY_REVIEW_REQUIRED");
    assert.ok(["DRAFT","PUBLISHED"].includes(r.publicationState));
    assert.equal(r.ontologyCandidateCount, r.ontologyCandidateIds.length);
    assert.ok(r.ontologyCandidateIds.every((id) => /^MONDO:\d{7}$/.test(id)));
    assert.ok(Number.isInteger(r.outgoingCount) && r.outgoingCount >= 0);
    const { contentSha256, ...source } = r;
    assert.equal(digest(source), contentSha256);
    conditions.set(r.id, r);
  }
  const seen = new Set();
  const outgoing = new Map();
  let citations = 0;
  for (const r of doc.pathways) {
    assert.ok(conditions.has(r.sourceId) && conditions.has(r.targetId));
    const id = r.sourceId + "|" + r.targetId;
    assert.ok(!seen.has(id), "Duplicate pathway");
    seen.add(id);
    assert.ok(Number.isInteger(r.rank) && r.rank > 0);
    assert.equal(r.publicationState, conditions.get(r.sourceId).publicationState);
    assert.ok(NEXUS.has(r.nexusClassification));
    assert.equal(r.clinicalApproval, "NOT_GRANTED");
    assert.equal(r.reviewState, "HUMAN_CLINICAL_REVIEW_REQUIRED");
    assert.ok(r.citationCount >= 0 && r.declaredVerified <= r.citationCount);
    assert.ok(r.clinicalDeclaredVerified <= r.clinicalRefCount);
    assert.ok(Array.isArray(r.findings) && r.findings.length <= 30);
    const flags = new Set();
    for (const f of r.findings) {
      assert.match(f.rule, /^[A-Z_]{6,90}$/);
      assert.equal(f.severity === "HIGH", HIGH.has(f.rule));
      assert.ok(typeof f.field === "string" && f.field.length <= 110);
      assert.ok(typeof f.signal === "string" && f.signal.length <= 90);
      const key = [f.rule,f.field,f.signal].join("|");
      assert.ok(!flags.has(key), "Duplicate finding");
      flags.add(key);
    }
    const { contentSha256, ...source } = r;
    assert.equal(digest(source), contentSha256);
    outgoing.set(r.sourceId, (outgoing.get(r.sourceId) || 0) + 1);
    citations += r.citationCount;
  }
  assert.equal(citations, 1704);
  for (const [id, r] of conditions) assert.equal(outgoing.get(id) || 0, r.outgoingCount);
  return doc;
}

const CONDITION_COLS = [
  ["id","text"],["name","text"],["publication_state","text"],
  ["outgoing_count","integer"],["ontology_status","text"],
  ["candidate_count","integer"],["candidate_ids","jsonb"],
  ["review_state","text"],["clinical_approval","text"],["content_sha256","text"],
];
const PATH_COLS = [
  ["source_id","text"],["target_id","text"],["rank","integer"],
  ["publication_state","text"],["nexus_classification","text"],
  ["probability","text"],["citation_count","integer"],["declared_verified","integer"],
  ["clinical_ref_count","integer"],["clinical_declared_verified","integer"],
  ["pmid_count","integer"],["findings","jsonb"],["review_state","text"],
  ["clinical_approval","text"],["content_sha256","text"],
];

function projected(doc) {
  return {
    conditions: doc.conditions.map((r) => ({
      id:r.id,name:r.name,publication_state:r.publicationState,
      outgoing_count:r.outgoingCount,ontology_status:r.ontologyStatus,
      candidate_count:r.ontologyCandidateCount,candidate_ids:r.ontologyCandidateIds,
      review_state:r.reviewState,clinical_approval:r.clinicalApproval,
      content_sha256:r.contentSha256,
    })),
    pathways: doc.pathways.map((r) => ({
      source_id:r.sourceId,target_id:r.targetId,rank:r.rank,
      publication_state:r.publicationState,nexus_classification:r.nexusClassification,
      probability:r.vaNexusProbabilityAlignment,citation_count:r.citationCount,
      declared_verified:r.declaredVerified,clinical_ref_count:r.clinicalRefCount,
      clinical_declared_verified:r.clinicalDeclaredVerified,pmid_count:r.pmidCount,
      findings:r.findings,review_state:r.reviewState,clinical_approval:r.clinicalApproval,
      content_sha256:r.contentSha256,
    })),
  };
}

function ddl() {
  return [
    `CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`,
    `CREATE TABLE IF NOT EXISTS ${SCHEMA}.runs (
      run_id text PRIMARY KEY CHECK(run_id ~ '^[a-f0-9]{64}$'),
      ontology_snapshot text NOT NULL, catalog_digest text NOT NULL,
      kb_digest text NOT NULL, registry_digest text NOT NULL,
      condition_count integer NOT NULL CHECK(condition_count=819),
      pathway_count integer NOT NULL CHECK(pathway_count=875),
      reference_count integer NOT NULL CHECK(reference_count=1704),
      approval_state text NOT NULL DEFAULT 'UNREVIEWED_ONLY'
        CHECK(approval_state='UNREVIEWED_ONLY'),
      created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS ${SCHEMA}.conditions (
      run_id text NOT NULL REFERENCES ${SCHEMA}.runs(run_id),
      id text NOT NULL, name text NOT NULL,
      publication_state text NOT NULL CHECK(publication_state IN ('DRAFT','PUBLISHED')),
      outgoing_count integer NOT NULL CHECK(outgoing_count >= 0),
      ontology_status text NOT NULL, candidate_count integer NOT NULL,
      candidate_ids jsonb NOT NULL,
      review_state text NOT NULL CHECK(review_state='HUMAN_IDENTITY_REVIEW_REQUIRED'),
      clinical_approval text NOT NULL CHECK(clinical_approval='NOT_GRANTED'),
      content_sha256 text NOT NULL,
      PRIMARY KEY(run_id,id))`,
    `CREATE TABLE IF NOT EXISTS ${SCHEMA}.pathways (
      run_id text NOT NULL REFERENCES ${SCHEMA}.runs(run_id),
      source_id text NOT NULL, target_id text NOT NULL, rank integer NOT NULL CHECK(rank > 0),
      publication_state text NOT NULL CHECK(publication_state IN ('DRAFT','PUBLISHED')),
      nexus_classification text NOT NULL CHECK(nexus_classification IN
        ('ASSOCIATION_ONLY','DIRECT_CAUSATION','AGGRAVATION')),
      probability text NOT NULL, citation_count integer NOT NULL CHECK(citation_count >= 0),
      declared_verified integer NOT NULL CHECK(declared_verified >= 0),
      clinical_ref_count integer NOT NULL CHECK(clinical_ref_count >= 0),
      clinical_declared_verified integer NOT NULL CHECK(clinical_declared_verified >= 0),
      pmid_count integer NOT NULL, findings jsonb NOT NULL,
      review_state text NOT NULL CHECK(review_state='HUMAN_CLINICAL_REVIEW_REQUIRED'),
      clinical_approval text NOT NULL CHECK(clinical_approval='NOT_GRANTED'),
      content_sha256 text NOT NULL,
      PRIMARY KEY(run_id,source_id,target_id),
      FOREIGN KEY(run_id,source_id) REFERENCES ${SCHEMA}.conditions(run_id,id),
      FOREIGN KEY(run_id,target_id) REFERENCES ${SCHEMA}.conditions(run_id,id))`,
    `CREATE INDEX IF NOT EXISTS scf_clinical_review_status_idx ON ${SCHEMA}.conditions(run_id,ontology_status)`,
    `CREATE INDEX IF NOT EXISTS scf_clinical_review_flags_idx ON ${SCHEMA}.pathways USING gin(findings)`,
    `CREATE INDEX IF NOT EXISTS scf_clinical_review_nexus_idx ON ${SCHEMA}.pathways(run_id,publication_state,nexus_classification)`,
  ];
}

export async function openDev() {
  const conn = getLabConnection(SERVICE,"verify");
  assertDev(SERVICE,conn);
  const db = new Client({host:HOST,port:30902,database:"tsdb",
    user:conn.PGUSER,password:conn.PGPASSWORD,
    ssl:{rejectUnauthorized:true},connectionTimeoutMillis:8000,
    statement_timeout:22000,query_timeout:28000,
    application_name:"scf_clinical_review_dev_ledger"});
  await db.connect();
  return db;
}
async function insertRows(db, table, rows, columns, run) {
  const fields = columns.map(([field]) => field);
  const typed = columns.map(([name,type]) => name + " " + type).join(",");
  const sql = `INSERT INTO ${SCHEMA}.${table}(run_id,${fields.join(",")})
    SELECT $1,${fields.map((f) => "x." + f).join(",")}
    FROM jsonb_to_recordset($2::jsonb) AS x(${typed}) ON CONFLICT DO NOTHING`;
  for (let i = 0; i < rows.length; i += 125) {
    await db.query(sql,[run,JSON.stringify(rows.slice(i,i+125))]);
  }
}
async function verifyDb(db, doc) {
  const res = await db.query(`SELECT * FROM ${SCHEMA}.runs WHERE run_id=$1`,[doc.runId]);
  assert.equal(res.rows.length,1);
  const run=res.rows[0];
  assert.equal(run.ontology_snapshot,ONTOLOGY);
  assert.equal(run.catalog_digest,doc.catalogDigest);
  assert.equal(run.kb_digest,doc.knowledgeBaseDigest);
  assert.equal(run.registry_digest,doc.sourceRegistryDigest);
  assert.equal(run.approval_state,"UNREVIEWED_ONLY");
  assert.equal(run.condition_count,819);
  assert.equal(run.pathway_count,875);
  assert.equal(run.reference_count,1704);
  const expected=projected(doc);
  for(const [table,fields,key] of [
    ["conditions",CONDITION_COLS,(row)=>row.id],
    ["pathways",PATH_COLS,(row)=>row.source_id+"|"+row.target_id],
  ]) {
    const columns=fields.map(([f])=>f);
    const fromDb=await db.query(
      `SELECT ${columns.join(",")} FROM ${SCHEMA}.${table} WHERE run_id=$1`,[doc.runId]);
    assert.equal(fromDb.rows.length,expected[table].length);
    const missing = new Map(expected[table].map((r)=>[key(r),r]));
    for (const row of fromDb.rows) {
      const original=missing.get(key(row));
      assert.ok(original, "Unexpected row from DEV store");
      assert.equal(canonical(row),canonical(original), "Full metadata mismatch");
      missing.delete(key(row));
    }
    assert.equal(missing.size,0);
  }
  return {result:"EXACT_REVIEW_LEDGER_PARITY",environment:"DEV",service:SERVICE,
    runId:doc.runId,conditions:819,pathways:875,sourceReferences:1704,
    clinicalApproval:"NOT_GRANTED"};
}
export async function processLedger(mode,doc) {
  validateLedger(doc);
  if (!["apply","verify"].includes(mode)) throw new Error("Invalid mode");
  const db=await openDev();
  let tx=false;
  try {
    await db.query(mode==="apply"?"BEGIN":"BEGIN READ ONLY");
    tx=true;
    if(mode==="apply") {
      await db.query("SET LOCAL lock_timeout='4000ms'");
      await db.query("SELECT pg_advisory_xact_lock(202611, 904)");
      for(const ddlItem of ddl())await db.query(ddlItem);
      await db.query(`INSERT INTO ${SCHEMA}.runs
        (run_id,ontology_snapshot,catalog_digest,kb_digest,registry_digest,
          condition_count,pathway_count,reference_count)
        VALUES ($1,$2,$3,$4,$5,819,875,1704) ON CONFLICT DO NOTHING`,
        [doc.runId,ONTOLOGY,doc.catalogDigest,doc.knowledgeBaseDigest,doc.sourceRegistryDigest]);
      const rows=projected(doc);
      await insertRows(db,"conditions",rows.conditions,CONDITION_COLS,doc.runId);
      await insertRows(db,"pathways",rows.pathways,PATH_COLS,doc.runId);
    }
    const result=await verifyDb(db,doc);
    await db.query(mode==="apply"?"COMMIT":"ROLLBACK");
    tx=false;
    return result;
  } catch {
    if (tx) await db.query("ROLLBACK").catch(()=>undefined);
    throw new Error("DEV review ledger operation failed; inspect snapshot before retry");
  } finally {
    await db.end().catch(()=>undefined);
  }
}
if (process.argv[1]?.endsWith("clinical-review-tiger-dev.mjs")) {
  const mode=process.argv[2],flags=process.argv.slice(3);
  if (!["apply","verify"].includes(mode) ||
    (mode==="apply" && (flags.length!==1 || flags[0]!=="--dev-write")) ||
    (mode==="verify" && flags.length!==0)) {
    console.error("Usage: apply --dev-write | verify");
    process.exitCode=1;
  } else {
    try {
      const doc=JSON.parse(fs.readFileSync(INPUT,"utf8"));
      console.log(JSON.stringify(await processLedger(mode,doc)));
    } catch {
      console.error("Tiger Cloud DEV review-ledger validation failed");
      process.exitCode=1;
    }
  }
}
