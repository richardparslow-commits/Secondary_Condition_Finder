import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { getLabConnection, executeLabSql, executeLabTransaction } from "./lib/tiger-lab-client.mjs";

export function runPoolerCheck(service) {
  assert.equal(service, "m8vrpmo6ec", "Pooler check is restricted to the designated test service");
  const direct = getLabConnection(service, "verify");
  const pooled = getLabConnection(service, "verify", { pooled: true });
  const schema = `scf_pooler_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const result = { service, checks: [], integrity: null, scratchSchemasRemaining: null };
  try {
    executeLabSql(direct, `CREATE SCHEMA ${schema}; CREATE TABLE ${schema}.probe(id integer PRIMARY KEY,payload text NOT NULL,checksum text NOT NULL);`);
    for (let round = 0; round < 3; round++) {
      for (const [endpoint, connection] of [["direct", direct], ["pooled", pooled]]) {
        const offset = round * 200 + (endpoint === "pooled" ? 100 : 0);
        const settings = JSON.parse(executeLabTransaction(connection, `
          INSERT INTO ${schema}.probe SELECT n, 'synthetic-'||n, md5('synthetic-'||n) FROM generate_series(${offset + 1},${offset + 100}) n;
          SELECT json_build_object('statement_timeout',current_setting('statement_timeout'),'lock_timeout',current_setting('lock_timeout'));`));
        assert.deepEqual(settings, { statement_timeout: "15s", lock_timeout: "5s" });
        let sqlstate;
        try {
          executeLabTransaction(connection, `INSERT INTO ${schema}.probe VALUES(-1,'rollback','unused'); SELECT pg_sleep(0.25);`, { statementTimeoutMs: 50 });
        } catch (error) { sqlstate = error.sqlstate; }
        assert.equal(sqlstate, "57014", "Must observe an actual statement timeout");
        const rolledBackRows = Number(executeLabTransaction(connection, `SELECT count(*) FROM ${schema}.probe WHERE id=-1;`));
        assert.equal(rolledBackRows, 0, "Timed-out write was not rolled back");
        result.checks.push({ round: round + 1, endpoint, settings, timeoutSqlstate: sqlstate, rolledBackRows });
      }
    }
    result.integrity = JSON.parse(executeLabTransaction(pooled, `SELECT json_build_object(
      'rows',count(*),'distinct_ids',count(DISTINCT id),
      'bad_checksum',count(*) FILTER (WHERE checksum<>md5(payload)),
      'unexpected_ids',count(*) FILTER (WHERE id NOT BETWEEN 1 AND 600)) FROM ${schema}.probe;`));
    assert.deepEqual(result.integrity, { rows: 600, distinct_ids: 600, bad_checksum: 0, unexpected_ids: 0 });
  } finally {
    executeLabSql(direct, `DROP SCHEMA IF EXISTS ${schema} CASCADE;`);
    result.scratchSchemasRemaining = Number(executeLabSql(direct, `SELECT count(*) FROM pg_namespace WHERE nspname='${schema}';`));
    assert.equal(result.scratchSchemasRemaining, 0);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv.length, 4, "Usage: node scripts/test-tiger-pooler.mjs <test-service-id> <new-result-file>");
  const result = runPoolerCheck(process.argv[2]);
  writeFileSync(resolve(process.argv[3]), JSON.stringify(result, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify(result));
}
