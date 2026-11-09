import assert from "node:assert/strict";
import { Client } from "pg";

import { getLabConnection } from "./tiger-lab-client.mjs";
import { assertSnapshot } from "./public-medical-reference.mjs";

export const DEV_SERVICE = "m8vrpmo6ec";
export const DEV_HOST = "m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com";
export const DEV_PORT = "30902";
export const RESEARCH_SCHEMA = "scf_medical_reference_dev";

export function assertDevTarget(service, connection) {
  assert.equal(service, DEV_SERVICE, "Medical research operations are DEV-service-only");
  assert.equal(connection.PGHOST, DEV_HOST, "Unapproved database host");
  assert.equal(connection.PGPORT, DEV_PORT, "Unapproved database port");
  assert.equal(connection.PGDATABASE, "tsdb", "Unapproved database");
  assert.equal(connection.PGUSER, "tsdbadmin", "Unapproved ingestion role");
  assert.equal(connection.TIGER_LAB_ENDPOINT, "direct", "Pooled writes are not supported");
  assert.ok(connection.PGPASSWORD, "Missing secret; do not put it in code");
}

async function openDevClient(service, { readOnly = false, connect } = {}) {
  if (service !== DEV_SERVICE) throw new Error("Research connections are restricted to designated DEV service");
  // Tiger CLI checks the service metadata on every invocation: exact service
  // identity/name, DEV tag, READY state and TLS endpoint, before any SQL.
  // The existing lab helper uses "verify" to permit the named DEV test service.
  // It only resolves metadata/credentials; this research module controls SQL.
  const conn = connect ?? getLabConnection(service, "verify");
  assertDevTarget(service, conn);
  const client = new Client({
    host: conn.PGHOST, port: Number(conn.PGPORT), database: conn.PGDATABASE,
    user: conn.PGUSER, password: conn.PGPASSWORD,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 7_000, statement_timeout: 12_000,
    query_timeout: 15_000, application_name: readOnly ? "scf_medical_dev_verify" : "scf_medical_dev_ingest",
  });
  await client.connect();
  try {
    const identity = await client.query(
      "SELECT current_database() AS database, current_user AS username, current_setting('transaction_read_only') AS read_only",
    );
    if (identity.rows.length !== 1 || identity.rows[0].database !== "tsdb" ||
        identity.rows[0].username !== "tsdbadmin") {
      throw new Error("Unexpected research DEV database identity");
    }
  } catch {
    await client.end().catch(() => {});
    throw error;
  }
  return client;
}

function schemaDDL() {
  return [
    `CREATE SCHEMA IF NOT EXISTS ${RESEARCH_SCHEMA}`,
    `CREATE TABLE IF NOT EXISTS ${RESEARCH_SCHEMA}.runs (
      run_id text PRIMARY KEY CHECK (run_id ~ '^[0-9a-f]{64}$'),
      seed_id text NOT NULL,
      source_commit text NOT NULL,
      reference_count integer NOT NULL CHECK (reference_count BETWEEN 1 AND 30),
      observed_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      use_status text NOT NULL DEFAULT 'UNREVIEWED_RESEARCH_ONLY'
        CHECK (use_status = 'UNREVIEWED_RESEARCH_ONLY')
    )`,
    `CREATE TABLE IF NOT EXISTS ${RESEARCH_SCHEMA}.reference_records (
      run_id text NOT NULL REFERENCES ${RESEARCH_SCHEMA}.runs(run_id),
      provider text NOT NULL CHECK (provider IN ('pubmed','rxnorm','openfda_label')),
      source_key text NOT NULL,
      source_url text NOT NULL,
      title text NOT NULL,
      source_date text NOT NULL,
      record_status text NOT NULL,
      details jsonb NOT NULL,
      content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
      PRIMARY KEY (run_id, provider, source_key),
      CHECK ((details ->> 'reviewRequired') = 'true')
    )`,
    `CREATE INDEX IF NOT EXISTS scf_medical_ref_provider_key_idx
      ON ${RESEARCH_SCHEMA}.reference_records(provider, source_key)`,
  ];
}

function expectedDbRows(snapshot) {
  return snapshot.records.map((r) => ({
    provider: r.provider, key: r.key, hash: r.contentHash,
    status: r.status, sourceUrl: r.sourceUrl,
  })).sort((a, b) => a.provider.localeCompare(b.provider) || a.key.localeCompare(b.key));
}

function comparePersisted(snapshot, rows) {
  const actual = rows.map((r) => ({
    provider: r.provider, key: r.source_key, hash: r.content_hash,
    status: r.record_status, sourceUrl: r.source_url,
  })).sort((a, b) => a.provider.localeCompare(b.provider) || a.key.localeCompare(b.key));
  assert.deepEqual(actual, expectedDbRows(snapshot), "Persisted reference metadata differs from staged snapshot");
  return actual.reduce((counts, row) => {
    counts[row.provider] = (counts[row.provider] ?? 0) + 1;
    return counts;
  }, {});
}

export async function applyResearchSnapshot(service, snapshot, seed, options = {}) {
  assertSnapshot(snapshot, seed);
  if (service !== DEV_SERVICE) throw new Error("Refuse writes outside designated Tiger Cloud DEV service");
  const client = await openDevClient(service, options);
  let transaction = false;
  try {
    await client.query("BEGIN");
    transaction = true;
    await client.query("SET LOCAL statement_timeout = '12000ms'");
    await client.query("SET LOCAL lock_timeout = '3000ms'");
    await client.query("SELECT pg_advisory_xact_lock($1,$2)", [202611, 809]);
    for (const ddl of schemaDDL()) await client.query(ddl);
    await client.query(
      `INSERT INTO ${RESEARCH_SCHEMA}.runs
       (run_id,seed_id,source_commit,reference_count,observed_at)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (run_id) DO NOTHING`,
      [snapshot.contentDigest, snapshot.seedId, snapshot.repoCommit,
        snapshot.records.length, snapshot.observedAt],
    );
    for (const r of snapshot.records) {
      await client.query(
        `INSERT INTO ${RESEARCH_SCHEMA}.reference_records
         (run_id,provider,source_key,source_url,title,source_date,record_status,details,content_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
         ON CONFLICT (run_id,provider,source_key) DO NOTHING`,
        [snapshot.contentDigest, r.provider, r.key, r.sourceUrl,
          r.title, r.sourceDate, r.status, JSON.stringify(r.details), r.contentHash],
      );
    }
    const found = await client.query(
      `SELECT provider,source_key,source_url,record_status,content_hash
       FROM ${RESEARCH_SCHEMA}.reference_records WHERE run_id=$1`,
      [snapshot.contentDigest],
    );
    const counts = comparePersisted(snapshot, found.rows);
    const run = await client.query(
      `SELECT reference_count,seed_id,use_status FROM ${RESEARCH_SCHEMA}.runs WHERE run_id=$1`,
      [snapshot.contentDigest],
    );
    if (run.rows.length !== 1 || run.rows[0].reference_count !== snapshot.records.length ||
        run.rows[0].seed_id !== snapshot.seedId ||
        run.rows[0].use_status !== "UNREVIEWED_RESEARCH_ONLY") {
      throw new Error("Research ingestion manifest mismatch");
    }
    await client.query("COMMIT");
    transaction = false;
    return { result: "applied_and_verified", environment: "DEV", service, schema: RESEARCH_SCHEMA,
      runId: snapshot.contentDigest, counts, total: snapshot.records.length };
  } catch {
    if (transaction) await client.query("ROLLBACK").catch(() => {});
    // SQL has not been retried on disconnect or unknown outcome.
    throw new Error("DEV medical reference ingestion failed; inspect target state before retrying");
  } finally {
    await client.end().catch(() => {});
  }
}

export async function verifyResearchSnapshot(service, snapshot, seed, options = {}) {
  assertSnapshot(snapshot, seed);
  const client = await openDevClient(service, { ...options, readOnly: true });
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '12000ms'");
    const result = await client.query(
      `SELECT provider,source_key,source_url,record_status,content_hash
       FROM ${RESEARCH_SCHEMA}.reference_records WHERE run_id=$1`,
      [snapshot.contentDigest],
    );
    const counts = comparePersisted(snapshot, result.rows);
    const rows = await client.query(
      `SELECT reference_count,use_status FROM ${RESEARCH_SCHEMA}.runs WHERE run_id=$1`,
      [snapshot.contentDigest],
    );
    if (rows.rows.length !== 1 || rows.rows[0].reference_count !== snapshot.records.length ||
      rows.rows[0].use_status !== "UNREVIEWED_RESEARCH_ONLY") {
      throw new Error("Research manifest state invalid");
    }
    return { result: "exact_metadata_parity", environment: "DEV", service, schema: RESEARCH_SCHEMA,
      runId: snapshot.contentDigest, counts, total: snapshot.records.length };
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end().catch(() => {});
  }
}
