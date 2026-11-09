#!/usr/bin/env node
/** Audit authored clinical reference metadata against ontology identity coverage in Tiger DEV. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { Client } from "pg";
import { getLabConnection } from "./lib/tiger-lab-client.mjs";
import { canonical, sha } from "./load-ontology-enrichment-dev.mjs";

const ROOT = "/tmp/scf-mondo-20261006/staged";
const FILE = ROOT + "/pathway-citation-audit.json";
const SCHEMA = "scf_medical_ontology_dev";
const SERVICE = "m8vrpmo6ec";
const HOST = "m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com";

export function validateCitationAudit(audit) {
  assert.equal(audit.schemaVersion, 1);
  assert.equal(audit.clinicalApproval, "NOT_GRANTED");
  assert.match(audit.ontologySnapshot, /^[a-f0-9]{64}$/);
  assert.ok(Array.isArray(audit.rows) && audit.rows.length === 875);
  const { digest, ...rest } = audit;
  assert.equal(sha(rest), digest, "Pathway citation audit digest mismatch");
  const ids = new Set();
  for (const row of audit.rows) {
    assert.match(row.source_id, /^[a-z0-9-]{2,90}$/);
    assert.match(row.target_id, /^[a-z0-9-]{2,90}$/);
    assert.ok(!ids.has(row.source_id + "|" + row.target_id));
    ids.add(row.source_id + "|" + row.target_id);
    assert.equal(row.review_state, "HUMAN_REVIEW_REQUIRED");
    assert.ok(Array.isArray(row.flags) && row.flags.includes("CLINICAL_CLAIM_UNASSESSED"));
    assert.ok(row.references >= row.declared_verified);
    assert.ok(row.clinical_refs >= row.clinical_declared_verified);
    const { content_sha256, ...without } = row;
    assert.equal(sha(without), content_sha256, "Pathway citation metadata modified");
  }
  return audit;
}
async function open() {
  const conn = getLabConnection(SERVICE, "verify");
  assert.equal(conn.PGHOST, HOST);
  assert.equal(conn.PGPORT, "30902");
  assert.equal(conn.PGUSER, "tsdbadmin");
  assert.equal(conn.PGDATABASE, "tsdb");
  assert.equal(conn.TIGER_LAB_ENDPOINT, "direct");
  const db = new Client({
    host: HOST, port: 30902, database: "tsdb", user: "tsdbadmin",
    password: conn.PGPASSWORD, ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 8000, query_timeout: 20000,
    statement_timeout: 15000, application_name: "scf_ontology_citation_review_dev",
  });
  await db.connect();
  return db;
}
async function perform(mode, doc) {
  validateCitationAudit(doc);
  const db = await open();
  let tx = false;
  try {
    await db.query(mode === "verify" ? "BEGIN READ ONLY" : "BEGIN");
    tx = true;
    if (mode === "load") {
      await db.query("SET LOCAL lock_timeout='3000ms'");
      await db.query("SELECT pg_advisory_xact_lock(202611, 828)");
      await db.query("CREATE TABLE IF NOT EXISTS " + SCHEMA + ".pathway_citation_batches(" +
        "digest text PRIMARY KEY CHECK (digest ~ '^[a-f0-9]{64}$'), " +
        "ontology_snapshot text NOT NULL REFERENCES " + SCHEMA + ".releases(snapshot), " +
        "pathway_count integer NOT NULL CHECK (pathway_count=875), " +
        "review_state text NOT NULL DEFAULT 'UNREVIEWED' CHECK(review_state='UNREVIEWED'))");
      await db.query("CREATE TABLE IF NOT EXISTS " + SCHEMA + ".pathway_citation_audits(" +
        "digest text NOT NULL REFERENCES " + SCHEMA + ".pathway_citation_batches(digest), " +
        "source_id text NOT NULL, target_id text NOT NULL, rank integer NOT NULL, " +
        "nexus_classification text NOT NULL, refs integer NOT NULL, " +
        "declared_verified integer NOT NULL, clinical_refs integer NOT NULL, " +
        "clinical_declared_verified integer NOT NULL, pmids_count integer NOT NULL, " +
        "flags jsonb NOT NULL, content_sha256 text NOT NULL, " +
        "review_state text NOT NULL CHECK (review_state='HUMAN_REVIEW_REQUIRED'), " +
        "PRIMARY KEY(digest,source_id,target_id))");
      await db.query("CREATE INDEX IF NOT EXISTS scf_ontology_citation_flags_idx ON " +
        SCHEMA + ".pathway_citation_audits USING gin(flags)");
      await db.query("INSERT INTO " + SCHEMA +
        ".pathway_citation_batches(digest,ontology_snapshot,pathway_count) " +
        "VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
        [doc.digest, doc.ontologySnapshot, doc.rows.length]);
      for (const r of doc.rows) {
        await db.query("INSERT INTO " + SCHEMA + ".pathway_citation_audits (" +
          "digest,source_id,target_id,rank,nexus_classification,refs,declared_verified," +
          "clinical_refs,clinical_declared_verified,pmids_count,flags,content_sha256,review_state) " +
          "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13) ON CONFLICT DO NOTHING",
          [doc.digest,r.source_id,r.target_id,r.rank,r.nexus_classification,r.references,
            r.declared_verified,r.clinical_refs,r.clinical_declared_verified,r.pmids_count,
            JSON.stringify(r.flags),r.content_sha256,r.review_state]);
      }
    }
    const meta = await db.query("SELECT pathway_count,ontology_snapshot,review_state FROM " +
      SCHEMA + ".pathway_citation_batches WHERE digest=$1", [doc.digest]);
    assert.equal(meta.rows.length, 1);
    assert.equal(meta.rows[0].pathway_count, 875);
    assert.equal(meta.rows[0].ontology_snapshot, doc.ontologySnapshot);
    assert.equal(meta.rows[0].review_state, "UNREVIEWED");
    const rows = await db.query("SELECT source_id,target_id,rank,nexus_classification," +
      "refs,declared_verified,clinical_refs,clinical_declared_verified,pmids_count," +
      "flags,content_sha256,review_state FROM " + SCHEMA +
      ".pathway_citation_audits WHERE digest=$1", [doc.digest]);
    assert.equal(rows.rows.length, doc.rows.length, "Incomplete citation-review import");
    const expected = new Map(doc.rows.map((r) => [r.source_id + "|" + r.target_id, r]));
    for (const dbrow of rows.rows) {
      const id = dbrow.source_id + "|" + dbrow.target_id;
      const ref = expected.get(id);
      assert.ok(ref);
      assert.deepEqual([
        dbrow.rank,dbrow.nexus_classification,dbrow.refs,dbrow.declared_verified,
        dbrow.clinical_refs,dbrow.clinical_declared_verified,dbrow.pmids_count,
        canonical(dbrow.flags),dbrow.content_sha256,dbrow.review_state,
      ],[
        ref.rank,ref.nexus_classification,ref.references,ref.declared_verified,
        ref.clinical_refs,ref.clinical_declared_verified,ref.pmids_count,
        canonical(ref.flags),ref.content_sha256,ref.review_state,
      ]);
      expected.delete(id);
    }
    assert.equal(expected.size, 0);
    await db.query("COMMIT");
    tx = false;
    return { result: "EXACT_CITATION_METADATA_PARITY", environment: "DEV",
      service: SERVICE, run: doc.digest, pathways: rows.rows.length,
      clinicalReview: "REQUIRED", approvedNexusMappings: 0 };
  } catch {
    if (tx) await db.query("ROLLBACK").catch(() => {});
    throw new Error("DEV citation audit validation failed");
  } finally {
    await db.end().catch(() => {});
  }
}
if (process.argv[1]?.endsWith("load-ontology-citations-dev.mjs")) {
const mode = process.argv[2];
if (!["load", "verify"].includes(mode) ||
    (mode === "load" && (process.argv[3] !== "--dev-write" || process.argv[4])) ||
    (mode === "verify" && process.argv[3])) {
  console.error("Usage: load --dev-write | verify");
  process.exitCode = 1;
} else {
  perform(mode, JSON.parse(fs.readFileSync(FILE,"utf8"))).then(
    (result) => console.log(JSON.stringify(result)),
  ).catch(() => {
    console.error("Citation audit failed; no medical claims modified");
    process.exitCode = 1;
  });
}

}
