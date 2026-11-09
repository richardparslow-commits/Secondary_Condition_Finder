#!/usr/bin/env node
/**
 * Full pinned MONDO release + existing app ontology audit in Tiger Cloud DEV.
 * Operates on public ontology terms and versioned app taxonomy only.
 * No user/patient data. No clinical causality approval. No PROD services.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import readline from "node:readline";
import { Client } from "pg";
import { getLabConnection } from "./lib/tiger-lab-client.mjs";

const SCHEMA = "scf_medical_ontology_dev";
const SERVICE = "m8vrpmo6ec";
const HOST = "m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com";
const PORT = "30902";
const RELEASE = "v2026-10-06";
const SOURCE_SHA = "2631e8e165d41def1a46749adb1ce0a336c8aba7f6bc0978729592cee8fed60b";
const ROOT = "/tmp/scf-mondo-20261006/staged";
const ORDER = ["concepts", "synonyms", "parents", "xrefs",
  "app_audits", "app_candidates", "app_pathways"];
const TABLES = {
  concepts: { cols: ["concept_id", "label", "obsolete", "replaced_by"],
    types: ["text", "text", "boolean", "text"] },
  synonyms: { cols: ["concept_id", "term", "scope"], types: ["text", "text", "text"] },
  parents: { cols: ["child_id", "parent_id"], types: ["text", "text"] },
  xrefs: { cols: ["concept_id", "xref"], types: ["text", "text"] },
  app_audits: { cols: ["condition_id", "audit_status", "candidate_count"],
    types: ["text", "text", "integer"] },
  app_candidates: { cols: ["condition_id", "concept_id", "rule", "matched_term"],
    types: ["text", "text", "text", "text"] },
  app_pathways: { cols: ["source_id", "target_id", "rank", "audit_status"],
    types: ["text", "text", "integer", "text"] },
};

function digest(path) {
  const h = createHash("sha256");
  h.update(fs.readFileSync(path));
  return h.digest("hex");
}

export function assertManifest(manifest, root = ROOT) {
  assert.equal(manifest.version, RELEASE);
  assert.equal(manifest.source_sha256, SOURCE_SHA);
  assert.equal(manifest.clinicalApproval, "NOT_GRANTED");
  assert.equal(manifest.appConditionCount, 819);
  assert.equal(manifest.appPathwayCount, 875);
  assert.deepEqual(Object.keys(manifest.tables).sort(), [...ORDER].sort());
  const hashes = {};
  for (const [name, table] of Object.entries(manifest.tables)) {
    assert.ok(TABLES[name]);
    const csv = `${root}/${name}.csv`;
    const jsonl = `${root}/${name}.jsonl`;
    assert.equal(table.file, csv);
    assert.equal(table.jsonl, jsonl);
    assert.equal(digest(csv), table.sha256, `${name} CSV digest failed`);
    assert.equal(digest(jsonl), table.jsonl_sha256, `${name} JSONL digest failed`);
    assert.ok(Number.isInteger(table.rows) && table.rows >= 0 && table.rows < 400000);
    hashes[name] = table.sha256;
  }
  // The parser's Python json.dumps includes spaces after separators; match
  // that exact canonical release-manifest contract.
  const pySorted = "{" + Object.keys(hashes).sort().map((k) =>
    JSON.stringify(k) + ": " + JSON.stringify(hashes[k])).join(", ") + "}";
  const expected = createHash("sha256").update(SOURCE_SHA + pySorted).digest("hex");
  assert.equal(manifest.snapshot, expected);
  return manifest;
}

export function assertDev(service, conn) {
  assert.equal(service, SERVICE);
  assert.equal(conn.PGHOST, HOST);
  assert.equal(conn.PGPORT, PORT);
  assert.equal(conn.PGUSER, "tsdbadmin");
  assert.equal(conn.PGDATABASE, "tsdb");
  assert.equal(conn.PGSSLMODE, "require");
  assert.ok(conn.PGPASSWORD);
  assert.equal(conn.TIGER_LAB_ENDPOINT, "direct");
}

function sqlDdl() {
  return [
    `CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`,
    `CREATE TABLE IF NOT EXISTS ${SCHEMA}.releases(
      snapshot text PRIMARY KEY CHECK(snapshot ~ '^[a-f0-9]{64}$'),
      source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[a-f0-9]{64}$'),
      release_version text NOT NULL,
      counts jsonb NOT NULL,
      clinical_status text NOT NULL DEFAULT 'UNREVIEWED_ONTOLOGY_MAPPING'
        CHECK(clinical_status='UNREVIEWED_ONTOLOGY_MAPPING'),
      installed_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS ${SCHEMA}.concepts(
      snapshot text NOT NULL REFERENCES ${SCHEMA}.releases(snapshot),
      concept_id text NOT NULL, label text NOT NULL, obsolete boolean NOT NULL,
      replaced_by text NOT NULL, PRIMARY KEY(snapshot,concept_id))`,
    `CREATE TABLE IF NOT EXISTS ${SCHEMA}.synonyms(
      snapshot text NOT NULL, concept_id text NOT NULL, term text NOT NULL,
      scope text NOT NULL CHECK(scope IN ('EXACT','BROAD','NARROW','RELATED')),
      PRIMARY KEY(snapshot,concept_id,term,scope),
      FOREIGN KEY(snapshot,concept_id) REFERENCES ${SCHEMA}.concepts(snapshot,concept_id))`,
    `CREATE TABLE IF NOT EXISTS ${SCHEMA}.parents(
      snapshot text NOT NULL, child_id text NOT NULL, parent_id text NOT NULL,
      PRIMARY KEY(snapshot,child_id,parent_id),
      FOREIGN KEY(snapshot,child_id) REFERENCES ${SCHEMA}.concepts(snapshot,concept_id),
      FOREIGN KEY(snapshot,parent_id) REFERENCES ${SCHEMA}.concepts(snapshot,concept_id))`,
    `CREATE TABLE IF NOT EXISTS ${SCHEMA}.xrefs(
      snapshot text NOT NULL, concept_id text NOT NULL, xref text NOT NULL,
      PRIMARY KEY(snapshot,concept_id,xref),
      FOREIGN KEY(snapshot,concept_id) REFERENCES ${SCHEMA}.concepts(snapshot,concept_id))`,
    `CREATE TABLE IF NOT EXISTS ${SCHEMA}.app_audits(
      snapshot text NOT NULL REFERENCES ${SCHEMA}.releases(snapshot),
      condition_id text NOT NULL, audit_status text NOT NULL,
      candidate_count integer NOT NULL CHECK(candidate_count >= 0),
      PRIMARY KEY(snapshot,condition_id))`,
    `CREATE TABLE IF NOT EXISTS ${SCHEMA}.app_candidates(
      snapshot text NOT NULL, condition_id text NOT NULL, concept_id text NOT NULL,
      rule text NOT NULL, matched_term text NOT NULL,
      PRIMARY KEY(snapshot,condition_id,concept_id),
      FOREIGN KEY(snapshot,condition_id) REFERENCES ${SCHEMA}.app_audits(snapshot,condition_id),
      FOREIGN KEY(snapshot,concept_id) REFERENCES ${SCHEMA}.concepts(snapshot,concept_id))`,
    `CREATE TABLE IF NOT EXISTS ${SCHEMA}.app_pathways(
      snapshot text NOT NULL, source_id text NOT NULL, target_id text NOT NULL,
      rank integer NOT NULL CHECK(rank > 0), audit_status text NOT NULL,
      PRIMARY KEY(snapshot,source_id,target_id),
      FOREIGN KEY(snapshot,source_id) REFERENCES ${SCHEMA}.app_audits(snapshot,condition_id),
      FOREIGN KEY(snapshot,target_id) REFERENCES ${SCHEMA}.app_audits(snapshot,condition_id))`,
    `CREATE INDEX IF NOT EXISTS scf_ontology_dev_synonym_idx ON ${SCHEMA}.synonyms(snapshot,term)`,
    `CREATE INDEX IF NOT EXISTS scf_ontology_dev_parents_idx ON ${SCHEMA}.parents(snapshot,parent_id)`,
    `CREATE INDEX IF NOT EXISTS scf_ontology_dev_xrefs_idx ON ${SCHEMA}.xrefs(snapshot,xref)`,
    `CREATE INDEX IF NOT EXISTS scf_ontology_dev_review_idx ON ${SCHEMA}.app_audits(snapshot,audit_status)`,
  ];
}

function stringifyRow(row) {
  return JSON.stringify(row.map((value) => String(value)));
}

async function* sourceRows(name, root = ROOT) {
  const src = fs.createReadStream(`${root}/${name}.jsonl`, { encoding: "utf8" });
  const it = readline.createInterface({ input: src, crlfDelay: Infinity });
  for await (const line of it) {
    const row = JSON.parse(line);
    assert.ok(Array.isArray(row) && row.length === TABLES[name].cols.length);
    yield row;
  }
}

async function openClient() {
  // Existing helper first verifies exact DEV service identity/name, READY
  // status, metadata environment=DEV, endpoint/TLS and protected credentials.
  const conn = getLabConnection(SERVICE, "verify");
  assertDev(SERVICE, conn);
  const client = new Client({
    host: conn.PGHOST, port: Number(conn.PGPORT), database: conn.PGDATABASE,
    user: conn.PGUSER, password: conn.PGPASSWORD,
    ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 8000,
    query_timeout: 120000, statement_timeout: 90000,
    application_name: "scf_mondo_dev_snapshot",
  });
  await client.connect();
  return client;
}

async function insertRows(client, name, manifest) {
  const { cols, types } = TABLES[name];
  const limit = 3000;
  const params = cols.map((col, i) => `${col} ${types[i]}`).join(",");
  const sql = `INSERT INTO ${SCHEMA}.${name} (snapshot,${cols.join(",")})
    SELECT $1,${cols.map((col) => "v." + col).join(",")}
    FROM jsonb_to_recordset($2::jsonb) AS v(${params})
    ON CONFLICT DO NOTHING`;
  let chunk = [], count = 0;
  const flush = async () => {
    if (!chunk.length) return;
    const batch = chunk.map((row) => Object.fromEntries(cols.map((col, i) => [col, row[i]])));
    await client.query(sql, [manifest.snapshot, JSON.stringify(batch)]);
    chunk = [];
  };
  for await (const row of sourceRows(name)) {
    chunk.push(row);
    count += 1;
    if (chunk.length === limit) await flush();
  }
  await flush();
  assert.equal(count, manifest.tables[name].rows);
}

export async function importOntology(manifest, root = ROOT) {
  assertManifest(manifest, root);
  const client = await openClient();
  let tx = false;
  try {
    await client.query("BEGIN");
    tx = true;
    await client.query("SET LOCAL statement_timeout='90000ms'");
    await client.query("SET LOCAL lock_timeout='5000ms'");
    await client.query("SELECT pg_advisory_xact_lock(202611, 826)");
    for (const sql of sqlDdl()) await client.query(sql);
    await client.query(`INSERT INTO ${SCHEMA}.releases(snapshot,source_sha256,release_version,counts)
      VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING`,
      [manifest.snapshot, SOURCE_SHA, RELEASE, JSON.stringify(manifest.tables)]);
    for (const name of ORDER) {
      await insertRows(client, name, manifest);
      console.log(JSON.stringify({ status: "loaded", table: name, rows: manifest.tables[name].rows }));
    }
    await client.query("COMMIT");
    tx = false;
    console.log(JSON.stringify({ result: "DEV_ontology_ingested", snapshot: manifest.snapshot,
      counts: Object.fromEntries(ORDER.map((name) => [name, manifest.tables[name].rows])) }));
  } catch {
    if (tx) await client.query("ROLLBACK").catch(() => {});
    throw new Error("MONDO DEV ingestion failed; inspect committed snapshot state; do not blindly retry SQL");
  } finally {
    await client.end().catch(() => {});
  }
}

export async function verifyOntology(manifest, root = ROOT) {
  assertManifest(manifest, root);
  const client = await openClient();
  try {
    await client.query("BEGIN READ ONLY");
    const release = await client.query(`SELECT source_sha256,release_version,counts,clinical_status
      FROM ${SCHEMA}.releases WHERE snapshot=$1`, [manifest.snapshot]);
    assert.equal(release.rows.length, 1);
    assert.equal(release.rows[0].source_sha256, SOURCE_SHA);
    assert.equal(release.rows[0].release_version, RELEASE);
    assert.equal(release.rows[0].clinical_status, "UNREVIEWED_ONTOLOGY_MAPPING");
    const counts = {};
    for (const name of ORDER) {
      const r = await client.query(`SELECT COUNT(*)::int AS n FROM ${SCHEMA}.${name}
        WHERE snapshot=$1`, [manifest.snapshot]);
      assert.equal(r.rows[0].n, manifest.tables[name].rows, `${name} count mismatch`);
      // Compare every field of every row, not merely counts. A primary key
      // prevents duplicates, and a Set comparison detects substitutions.
      const expected = new Set();
      for await (const row of sourceRows(name)) expected.add(stringifyRow(row));
      assert.equal(expected.size, manifest.tables[name].rows, `${name} duplicate source rows`);
      const { cols } = TABLES[name];
      const stored = await client.query(`SELECT ${cols.join(",")} FROM ${SCHEMA}.${name}
        WHERE snapshot=$1`, [manifest.snapshot]);
      assert.equal(stored.rows.length, expected.size);
      for (const record of stored.rows) {
        const v = stringifyRow(cols.map((col) => record[col]));
        assert.ok(expected.delete(v), `${name} stored value differs from staged source`);
      }
      assert.equal(expected.size, 0, `${name} expected rows missing`);
      counts[name] = stored.rows.length;
    }
    await client.query("COMMIT");
    return { result: "EXACT_ROW_PARITY", environment: "DEV", service: SERVICE,
      sourceRelease: RELEASE, snapshot: manifest.snapshot,
      counts, clinicalApproval: "NOT_GRANTED" };
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end().catch(() => {});
  }
}

async function main() {
  const mode = process.argv[2];
  const arg = process.argv[3];
  if (!["import", "verify"].includes(mode)) throw new Error("Usage: import --dev-write | verify");
  if (mode === "import") assert.equal(arg, "--dev-write");
  else assert.equal(arg, undefined);
  const manifest = JSON.parse(fs.readFileSync(ROOT + "/manifest.json", "utf8"));
  const result = mode === "import" ? await importOntology(manifest) : await verifyOntology(manifest);
  if (result) console.log(JSON.stringify(result));
}

if (process.argv[1]?.endsWith("ontology-tiger-dev.mjs")) {
  main().catch(() => {
    console.error("Tiger DEV ontology validation failed; credentials/SQL details withheld.");
    process.exitCode = 1;
  });
}
