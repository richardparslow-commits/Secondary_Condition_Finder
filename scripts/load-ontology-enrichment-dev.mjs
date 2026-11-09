#!/usr/bin/env node
/** Bounded source-enrichment research rows, separate from clinical mapping graph. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { Client } from "pg";
import { getLabConnection } from "./lib/tiger-lab-client.mjs";

const FILE = "/tmp/scf-mondo-20261006/staged/enrichment.json";
const SCHEMA = "scf_medical_ontology_dev";
const HOST = "m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com";
const SERVICE = "m8vrpmo6ec";
const PROVIDERS = ["ols4", "icd10cm", "monarch", "pubtator3", "hpo_ols4", "opentargets"];
const SAFE_STATES = new Set(["EXACT_LABEL_REVIEW", "SEARCH_CANDIDATE_REVIEW",
  "CODING_CANDIDATE_REVIEW", "KG_ASSOCIATION_REVIEW", "TEXT_MINED_REVIEW",
  "NO_CANDIDATE", "NO_ASSOCIATIONS", "PROVIDER_UNAVAILABLE",
  "PHENOTYPE_TERM_REVIEW", "DISEASE_IDENTITY_CANDIDATE_REVIEW"]);
const base = "a165dc2fc61761f5e5413b6395dd4afb14c89d78783af213a9b8f1d0a3f2a8c7";

export function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort().map(
      (k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}
export function sha(v) {
  return createHash("sha256").update(canonical(v)).digest("hex");
}

export function validateEnrichment(doc) {
  assert.equal(doc.base_snapshot, base);
  assert.equal(doc.clinicalApproval, "NOT_GRANTED");
  assert.ok(Array.isArray(doc.seed) && doc.seed.length === 12);
  assert.equal(new Set(doc.seed).size, 12);
  assert.ok(doc.seed.every((c) => /^[a-z0-9-]{2,65}$/.test(c)));
  assert.ok(Array.isArray(doc.observations) && doc.observations.length > 0 &&
    doc.observations.length <= 300);
  assert.equal(doc.digest.length, 64);
  const { digest, ...rest } = doc;
  assert.equal(sha(rest), digest, "Enrichment snapshot checksum mismatch");
  const keys = new Set();
  for (const r of doc.observations) {
    assert.equal(r.reviewRequired, true, "No automatic medical validation");
    assert.ok(PROVIDERS.includes(r.provider));
    assert.ok(doc.seed.includes(r.condition_id));
    assert.ok(Number.isInteger(r.rank) && r.rank >= 0 && r.rank <= 8);
    assert.match(r.candidate_id, /^[^<>\n\r]{1,140}$/);
    assert.ok(r.label.length <= 220);
    assert.ok(SAFE_STATES.has(r.status));
    assert.ok(r.source_url.startsWith("https://") && !r.source_url.includes("?"));
    const expectedHost = {
      ols4: "www.ebi.ac.uk",
      icd10cm: "clinicaltables.nlm.nih.gov",
      monarch: "api.monarchinitiative.org",
      pubtator3: "www.ncbi.nlm.nih.gov",
      hpo_ols4: "www.ebi.ac.uk",
      opentargets: "api.platform.opentargets.org",
    }[r.provider];
    assert.equal(new URL(r.source_url).hostname, expectedHost);
    const id = [r.provider, r.condition_id, r.rank].join("|");
    assert.ok(!keys.has(id), "Duplicated provider/condition/rank");
    keys.add(id);
    assert.ok(r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata));
    assert.ok(Object.keys(r.metadata).length <= 5);
    assert.equal(sha(Object.fromEntries(Object.entries(r).filter(([k]) => k !== "content_sha256"))),
      r.content_sha256, "Research record modified");
  }
  return doc;
}

async function openClient() {
  const conn = getLabConnection(SERVICE, "verify");
  assert.equal(conn.PGHOST, HOST);
  assert.equal(conn.PGPORT, "30902");
  assert.equal(conn.PGDATABASE, "tsdb");
  assert.equal(conn.PGUSER, "tsdbadmin");
  assert.equal(conn.TIGER_LAB_ENDPOINT, "direct");
  assert.ok(conn.PGPASSWORD);
  const db = new Client({
    host: conn.PGHOST, port: 30902, database: "tsdb",
    user: conn.PGUSER, password: conn.PGPASSWORD,
    ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 8000,
    statement_timeout: 12000, query_timeout: 15000,
    application_name: "scf_ontology_external_dev_review",
  });
  await db.connect();
  return db;
}

const create = [
  "CREATE TABLE IF NOT EXISTS " + SCHEMA + ".research_batches (" +
    "source_digest text PRIMARY KEY CHECK(source_digest ~ '^[a-f0-9]{64}$'), " +
    "ontology_snapshot text NOT NULL REFERENCES " + SCHEMA + ".releases(snapshot), " +
    "record_count integer NOT NULL CHECK(record_count BETWEEN 1 AND 300), " +
    "observed_at timestamptz NOT NULL, " +
    "clinical_status text NOT NULL DEFAULT 'UNREVIEWED_RESEARCH' " +
    "CHECK(clinical_status = 'UNREVIEWED_RESEARCH'))",
  "CREATE TABLE IF NOT EXISTS " + SCHEMA + ".research_candidates (" +
    "source_digest text NOT NULL REFERENCES " + SCHEMA + ".research_batches(source_digest), " +
    "provider text NOT NULL, condition_id text NOT NULL, ordinal integer NOT NULL, " +
    "candidate_id text NOT NULL, label text NOT NULL, relation text NOT NULL, " +
    "record_status text NOT NULL, source_url text NOT NULL, source_version text NOT NULL, " +
    "observed_at timestamptz NOT NULL, metadata jsonb NOT NULL, content_sha256 text NOT NULL, " +
    "review_required boolean NOT NULL CHECK(review_required=true), " +
    "PRIMARY KEY(source_digest,provider,condition_id,ordinal))",
  "CREATE INDEX IF NOT EXISTS scf_ontology_research_review_idx ON " +
    SCHEMA + ".research_candidates(provider,record_status)",
];

function dbValues(r) {
  return [
    r.provider, r.condition_id, r.rank, r.candidate_id, r.label, r.relation,
    r.status, r.source_url, r.source_version, r.observed_at, r.metadata, r.content_sha256,
  ];
}
async function compare(db, doc) {
  const q = await db.query(
    "SELECT provider,condition_id,ordinal,candidate_id,label,relation,record_status," +
    "source_url,source_version,observed_at,metadata,content_sha256,review_required " +
    "FROM " + SCHEMA + ".research_candidates WHERE source_digest=$1",
    [doc.digest]);
  assert.equal(q.rows.length, doc.observations.length, "Research candidate count mismatch");
  const expected = new Map(doc.observations.map((r) => [
    [r.provider, r.condition_id, r.rank].join("|"), r]));
  for (const row of q.rows) {
    const id = [row.provider, row.condition_id, row.ordinal].join("|");
    const item = expected.get(id);
    assert.ok(item, "Unexpected research candidate");
    assert.deepEqual(
      [row.provider, row.condition_id, row.ordinal, row.candidate_id, row.label, row.relation,
        row.record_status, row.source_url, row.source_version, row.content_sha256,
        row.review_required, canonical(row.metadata)],
      [item.provider, item.condition_id, item.rank, item.candidate_id, item.label, item.relation,
        item.status, item.source_url, item.source_version, item.content_sha256,
        true, canonical(item.metadata)]);
    assert.equal(new Date(row.observed_at).getTime(),
      new Date(item.observed_at).getTime(), "Observed time mismatch");
    expected.delete(id);
  }
  assert.equal(expected.size, 0);
  return q.rows.reduce((acc, r) => { acc[r.provider] = (acc[r.provider] || 0) + 1; return acc; }, {});
}

async function run(mode, doc) {
  validateEnrichment(doc);
  const db = await openClient();
  let tx = false;
  try {
    await db.query(mode === "verify" ? "BEGIN READ ONLY" : "BEGIN");
    tx = true;
    if (mode === "load") {
      await db.query("SET LOCAL lock_timeout='3000ms'");
      await db.query("SELECT pg_advisory_xact_lock(202611, 827)");
      for (const sql of create) await db.query(sql);
      await db.query("INSERT INTO " + SCHEMA +
        ".research_batches(source_digest,ontology_snapshot,record_count,observed_at) " +
        "VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [doc.digest, doc.base_snapshot, doc.observations.length, doc.observed_at]);
      for (const r of doc.observations) {
        await db.query("INSERT INTO " + SCHEMA + ".research_candidates (" +
          "source_digest,provider,condition_id,ordinal,candidate_id,label,relation," +
          "record_status,source_url,source_version,observed_at,metadata,content_sha256,review_required)" +
          "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,true) " +
          "ON CONFLICT DO NOTHING", [doc.digest, ...dbValues(r).map((v) =>
            v && typeof v === "object" ? JSON.stringify(v) : v)]);
      }
    }
    const manifest = await db.query("SELECT record_count,ontology_snapshot,clinical_status " +
      "FROM " + SCHEMA + ".research_batches WHERE source_digest=$1", [doc.digest]);
    assert.equal(manifest.rows.length, 1);
    assert.equal(manifest.rows[0].record_count, doc.observations.length);
    assert.equal(manifest.rows[0].ontology_snapshot, base);
    assert.equal(manifest.rows[0].clinical_status, "UNREVIEWED_RESEARCH");
    const counts = await compare(db, doc);
    await db.query("COMMIT");
    tx = false;
    return { result: "EXACT_ENRICHMENT_PARITY", service: SERVICE, environment: "DEV",
      records: doc.observations.length, snapshot: doc.digest, byProvider: counts,
      pendingClinicalReview: true };
  } catch {
    if (tx) await db.query("ROLLBACK").catch(() => {});
    throw new Error("Ontology enrichment verification failed; check DEV state");
  } finally {
    await db.end().catch(() => {});
  }
}

if (process.argv[1]?.endsWith("load-ontology-enrichment-dev.mjs")) {
const mode = process.argv[2];
const flags = process.argv.slice(3);
const supplemental = flags.includes("--supplemental");
if (!["load", "verify"].includes(mode) ||
    (mode === "load" && !(flags.length === (supplemental ? 2 : 1) &&
      flags.includes("--dev-write") &&
      flags.every((x) => ["--dev-write", "--supplemental"].includes(x)))) ||
    (mode === "verify" && !(flags.length === (supplemental ? 1 : 0) &&
      flags.every((x) => x === "--supplemental")))) {
  console.error("Usage: load --dev-write [--supplemental] | verify [--supplemental]");
  process.exitCode = 1;
} else {
  const path = supplemental ?
    "/tmp/scf-mondo-20261006/staged/enrichment-supplemental.json" : FILE;
  const doc = JSON.parse(fs.readFileSync(path, "utf8"));
  run(mode, doc).then((data) => console.log(JSON.stringify(data))).catch(() => {
    console.error("DEV research candidate operation failed; sensitive details withheld");
    process.exitCode = 1;
  });
}

}
