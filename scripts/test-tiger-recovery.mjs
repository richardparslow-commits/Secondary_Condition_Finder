import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getLabConnection, executeLabSql } from "./lib/tiger-lab-client.mjs";

const COLUMNS = ["id", "created_at", "run_label", "payload"];
const ROWS = 10_000;
const hash = (text) => createHash("sha256").update(text).digest("hex");
const scratch = (name) => {
  assert.match(name, /^scf_recovery_[a-f0-9]{16}_(?:src|dst)$/);
  return name;
};

export function tableSql(schema) {
  scratch(schema);
  return `CREATE SCHEMA ${schema};
    CREATE TABLE ${schema}.audit_log (
      id integer NOT NULL, created_at timestamptz NOT NULL,
      run_label text NOT NULL, payload jsonb NOT NULL,
      PRIMARY KEY (created_at, id));
    SELECT create_hypertable('${schema}.audit_log','created_at',chunk_time_interval=>INTERVAL '1 day');`;
}

export function validateBackup(manifest, csv) {
  assert.equal(manifest.format, "scf-synthetic-audit-v1", "Unknown backup format");
  assert.deepEqual(manifest.columns, COLUMNS, "Backup columns mismatch");
  assert.equal(manifest.expected.rows, ROWS, "Incomplete source snapshot");
  assert.equal(manifest.expected.distinct_ids, ROWS, "Duplicate source IDs");
  assert.equal(manifest.expected.hypertable, true, "Source must be a hypertable");
  assert.match(manifest.expected.digest, /^[a-f0-9]{32}$/);
  assert.ok(csv.length > 0, "Missing backup data");
  assert.equal(hash(csv), manifest.csv_sha256, "Backup checksum mismatch");
  return csv;
}

export function assertRecovered(expected, actual) {
  assert.deepEqual(actual, expected, "Recovered audit data/structure differs from backup");
}

function inspectSql(schema) {
  scratch(schema);
  return `SELECT json_build_object(
    'rows', count(*), 'distinct_ids', count(DISTINCT id),
    'digest', md5(COALESCE(string_agg(json_build_array(id,
      to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS.US'),
      run_label,payload)::text,E'\\n' ORDER BY id),'')),
    'hypertable', EXISTS(SELECT 1 FROM timescaledb_information.hypertables
      WHERE hypertable_schema='${schema}' AND hypertable_name='audit_log'),
    'primary_key', (SELECT array_agg(a.attname ORDER BY k.ordinality)
      FROM pg_constraint c CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY k(attnum,ordinality)
      JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum
      WHERE c.contype='p' AND c.conrelid='${schema}.audit_log'::regclass)
    ) FROM ${schema}.audit_log;`;
}

export function runRecoveryDrill(service, outputDirectory, { connect = getLabConnection, execute = executeLabSql } = {}) {
  // This is a fixed synthetic drill, never an arbitrary database restore tool.
  assert.equal(service, "m8vrpmo6ec", "Recovery drill is restricted to the designated Tiger test service");
  const connection = connect(service, "verify");
  const sql = (input) => execute(connection, input);
  const id = randomUUID().replaceAll("-", "").slice(0, 16);
  const source = `scf_recovery_${id}_src`;
  const target = `scf_recovery_${id}_dst`;
  const output = resolve(outputDirectory);
  mkdirSync(output, { mode: 0o700 }); // Refuse to overwrite a previous run.
  const record = (file, data) => writeFileSync(resolve(output, file), JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  let primaryFailure;
  let result;
  try {
    sql(`BEGIN; ${tableSql(source)}
      INSERT INTO ${source}.audit_log
      SELECT n, TIMESTAMPTZ '2026-01-01 00:00:00+00' + n * INTERVAL '1 minute',
        'synthetic-recovery', jsonb_build_object('sequence',n,'label','synthetic, "quoted" value', 'optional',NULL)
      FROM generate_series(1,${ROWS}) n; COMMIT;`);
    const expected = JSON.parse(sql(inspectSql(source)));
    // SELECT is essential: copying only the parent misses Timescale chunks.
    const csv = sql(`SET TIME ZONE 'UTC'; COPY (SELECT ${COLUMNS.join(",")} FROM ${source}.audit_log ORDER BY id) TO STDOUT WITH (FORMAT csv);`) + "\n";
    const manifest = { format: "scf-synthetic-audit-v1", columns: COLUMNS, expected, csv_sha256: hash(csv) };
    writeFileSync(resolve(output, "audit.csv"), csv, { mode: 0o600 });
    writeFileSync(resolve(output, "schema.sql"), tableSql(target) + "\n", { mode: 0o600 });
    record("manifest.json", manifest);
    const saved = JSON.parse(readFileSync(resolve(output, "manifest.json"), "utf8"));
    const savedCsv = validateBackup(saved, readFileSync(resolve(output, "audit.csv"), "utf8"));
    assert.throws(() => validateBackup(saved, savedCsv.slice(0, -20)), /checksum|Missing backup/);
    // Only now remove this run's source: recovery must work from saved artifacts.
    sql(`DROP SCHEMA ${scratch(source)} CASCADE;`);
    sql(readFileSync(resolve(output, "schema.sql"), "utf8"));
    const empty = JSON.parse(sql(inspectSql(target)));
    assert.equal(empty.rows, 0);
    assert.throws(() => assertRecovered(saved.expected, empty), /differs from backup/);
    sql(`BEGIN; COPY ${scratch(target)}.audit_log (${COLUMNS.join(",")}) FROM STDIN WITH (FORMAT csv);\n${savedCsv}\\.\nCOMMIT;`);
    const recovered = JSON.parse(sql(inspectSql(target)));
    assertRecovered(saved.expected, recovered);
    const chunks = Number(sql(`SELECT count(*) FROM timescaledb_information.chunks WHERE hypertable_schema='${target}' AND hypertable_name='audit_log';`));
    assert.ok(chunks > 1, "Must exercise multiple time chunks");
    result = { service, expected, recovered, chunks, csv_sha256: saved.csv_sha256,
      sourceRemovedBeforeRestore: true, schemaOnlyRejected: true, corruptBackupRejected: true };
  } catch (error) {
    primaryFailure = error;
  } finally {
    // Names are generated by this run and narrowly validated, never user supplied.
    sql(`DROP SCHEMA IF EXISTS ${scratch(source)} CASCADE; DROP SCHEMA IF EXISTS ${scratch(target)} CASCADE;`);
    const remaining = Number(sql(`SELECT count(*) FROM pg_namespace WHERE nspname IN ('${source}','${target}');`));
    assert.equal(remaining, 0, "Recovery scratch schemas remain");
    if (primaryFailure) {
      record("failure.json", { status: "failed", scratchSchemasRemaining: remaining, message: "Recovery verification failed; inspect before retrying" });
    } else {
      result.scratchSchemasRemaining = remaining;
      record("result.json", result);
    }
  }
  if (primaryFailure) throw primaryFailure;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv.length, 4, "Usage: node scripts/test-tiger-recovery.mjs <test-service-id> <new-output-directory>");
  console.log(JSON.stringify(runRecoveryDrill(process.argv[2], process.argv[3])));
}
