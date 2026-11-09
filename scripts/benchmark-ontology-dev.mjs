#!/usr/bin/env node
/** Read-only live Tiger Cloud DEV index/performance and invariant checks. */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { Client } from "pg";
import { getLabConnection } from "./lib/tiger-lab-client.mjs";

const SERVICE = "m8vrpmo6ec";
const SNAP = "a165dc2fc61761f5e5413b6395dd4afb14c89d78783af213a9b8f1d0a3f2a8c7";
const SCHEMA = "scf_medical_ontology_dev";
const statements = [
  ["exact_synonym", "SELECT COUNT(*)::int AS n FROM " + SCHEMA +
    ".synonyms WHERE snapshot=$1 AND term=$2", [SNAP, "migraine"]],
  ["disease_xref", "SELECT COUNT(*)::int AS n FROM " + SCHEMA +
    ".xrefs WHERE snapshot=$1 AND xref=$2", [SNAP, "ICD10CM:G43"]],
  ["is_a_parent", "SELECT COUNT(*)::int AS n FROM " + SCHEMA +
    ".parents WHERE snapshot=$1 AND parent_id=$2", [SNAP, "MONDO:0000001"]],
  ["unmatched_diagnoses", "SELECT COUNT(*)::int AS n FROM " + SCHEMA +
    ".app_audits WHERE snapshot=$1 AND audit_status=$2",
    [SNAP, "NO_EXACT_ONTOLOGY_MATCH"]],
  ["review_pathways", "SELECT COUNT(*)::int AS n FROM " + SCHEMA +
    ".app_pathways WHERE snapshot=$1", [SNAP]],
];
const conn = getLabConnection(SERVICE, "verify");
assert.equal(conn.PGHOST, "m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com");
assert.equal(conn.PGPORT, "30902");
assert.equal(conn.PGUSER, "tsdbadmin");
assert.equal(conn.TIGER_LAB_ENDPOINT, "direct");

const db = new Client({
  host: conn.PGHOST, port: 30902, database: "tsdb",
  user: conn.PGUSER, password: conn.PGPASSWORD,
  ssl: { rejectUnauthorized: true },
  connectionTimeoutMillis: 7000, query_timeout: 12000,
  application_name: "scf_ontology_dev_bench_read_only",
});
try {
  await db.connect();
  await db.query("BEGIN READ ONLY");
  await db.query("SET LOCAL statement_timeout='12000ms'");
  const tests = [];
  for (const [test, sql, params] of statements) {
    let rows = 0;
    const times = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      const result = await db.query(sql, params);
      const elapsedMs = performance.now() - start;
      times.push(elapsedMs);
      rows = result.rows[0].n;
    }
    times.sort((a, b) => a - b);
    tests.push({ test, count: rows, medianMs: Number(times[2].toFixed(2)),
      p95Ms: Number(times[4].toFixed(2)) });
  }
  const checks = await db.query(
    "SELECT " +
    "(SELECT COUNT(*) FROM " + SCHEMA + ".concepts WHERE snapshot=$1)::int AS concepts," +
    "(SELECT COUNT(*) FROM " + SCHEMA + ".app_audits WHERE snapshot=$1)::int AS conditions," +
    "(SELECT COUNT(*) FROM " + SCHEMA + ".app_pathways WHERE snapshot=$1)::int AS pathways," +
    "(SELECT COUNT(*) FROM " + SCHEMA + ".app_candidates WHERE snapshot=$1)::int AS candidates," +
    "(SELECT COUNT(*) FROM " + SCHEMA + ".app_audits WHERE snapshot=$1 " +
      "AND audit_status='AMBIGUOUS_LEXICAL_CANDIDATES')::int AS ambiguous",
    [SNAP],
  );
  assert.equal(checks.rows[0].concepts, 36055);
  assert.equal(checks.rows[0].conditions, 819);
  assert.equal(checks.rows[0].pathways, 875);
  assert.equal(checks.rows[0].candidates, 565);
  assert.equal(checks.rows[0].ambiguous, 51);
  await db.query("COMMIT");
  console.log(JSON.stringify({ environment: "DEV", readOnly: true, result: "PASSED",
    repeatsPerQuery: 5, tests, invariants: checks.rows[0] }));
} catch {
  console.error("DEV ontology benchmark failed; no credential or SQL leaked");
  process.exitCode = 1;
} finally {
  await db.query("ROLLBACK").catch(() => {});
  await db.end().catch(() => {});
}
