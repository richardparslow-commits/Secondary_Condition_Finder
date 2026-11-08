import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const names = {
  source: "secondary-condition-finder-fixture-source",
  target: "secondary-condition-finder-test",
};
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Only management reads are retried. SQL may have committed before a disconnect.
export function readTiger(args, { run = spawnSync, wait = sleep } = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = run("tiger", ["--version-check=false", "--color=false", ...args], {
      encoding: "utf8", timeout: 45_000, maxBuffer: 8 * 1024 * 1024,
    });
    if (!result.error && result.status === 0) return result.stdout.trim();
    const diagnostic = String(result.stderr ?? "");
    const authFailure = /unauthorized|forbidden|invalid.*(?:token|credential)|not logged in|permission denied|\b40[13]\b/i.test(diagnostic);
    const transient = result.error?.code === "ETIMEDOUT" ||
      /context deadline exceeded|Client.Timeout|TLS handshake timeout|connection reset|temporary failure|\b(?:429|502|503|504)\b/i.test(diagnostic);
    if (authFailure || !transient || attempt === 3) {
      // A URI lookup can contain a password; never include stdout or raw errors.
      throw new Error(`Tiger ${args[0]} ${args[1]} failed after ${attempt} attempt(s): ${authFailure ? "authentication/permission failure" : transient ? "temporary management connection failure" : "command failed"}. No SQL was retried.`);
    }
    wait(500 * 2 ** (attempt - 1));
  }
}

export function getLabConnection(service, mode, options = {}) {
  assert.match(service, /^[a-z0-9]{10}$/);
  assert.ok(mode === "seed" || mode === "verify", "Unknown lab mode");
  const metadata = JSON.parse(readTiger(["service", "get", service, "-o", "json"], options));
  const lab = metadata.service ?? metadata;
  assert.equal(lab.service_id ?? lab.id, service, "Unexpected service identity");
  assert.ok(lab.name === names.source || (mode === "verify" && lab.name === names.target), "Only designated lab services are allowed");
  assert.equal(lab.metadata?.environment ?? lab.environment, "DEV");
  assert.equal(lab.status, "READY");
  const pooled = options.pooled === true;
  const endpoint = pooled ? lab.connection_pooler?.endpoint : (lab.endpoint ?? { host: lab.host, port: lab.port });
  assert.ok(endpoint?.host && endpoint?.port, "Requested lab endpoint is unavailable");
  const raw = readTiger(["db", "uri", service, "--with-password", ...(pooled ? ["--pooled"] : [])], options);
  let url;
  try { url = new URL(raw); } catch { throw new Error("Tiger returned invalid connection details"); }
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol), "Invalid database protocol");
  assert.equal(url.hostname, endpoint.host, "Connection host differs from verified lab");
  assert.equal(url.port, String(endpoint.port), "Connection port differs from verified lab");
  assert.ok(url.password && url.username && url.pathname.length > 1, "Missing database credentials");
  assert.equal(url.searchParams.get("sslmode"), "require", "Lab connection must require TLS");
  return {
    PGHOST: url.hostname, PGPORT: url.port,
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGSSLMODE: "require",
    TIGER_LAB_ENDPOINT: pooled ? "pooled" : "direct",
  };
}

function runPsql(connection, input, flags, { run = spawnSync } = {}, startupOptions = "") {
  const psql = existsSync("/opt/homebrew/opt/libpq/bin/psql") ? "/opt/homebrew/opt/libpq/bin/psql" : "psql";
  const result = run(psql, ["-X", "-qAt", "-w", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", ...flags], {
    input, encoding: "utf8", timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, ...connection, PGCONNECT_TIMEOUT: "8", PGOPTIONS: startupOptions },
  });
  if (result.error || result.status !== 0) {
    // Do not retry, including timeouts: the transaction outcome may be unknown.
    const error = new Error("Lab SQL failed; it was not retried. Verify the committed state before rerunning.");
    error.sqlstate = /ERROR:\s+([0-9A-Z]{5}):/.exec(result.stderr ?? "")?.[1] ?? null;
    throw error;
  }
  return result.stdout.trim();
}

// Raw scripts retain the direct-session limit. Pooled SQL must use the
// transaction helper so local settings remain attached to the same transaction.
export function executeLabSql(connection, input, flags = [], options = {}) {
  assert.notEqual(connection.TIGER_LAB_ENDPOINT, "pooled", "Use executeLabTransaction for pooled SQL");
  return runPsql(connection, input, flags, options, "-c statement_timeout=15000");
}

export function executeLabTransaction(connection, body, { statementTimeoutMs = 15_000, lockTimeoutMs = 5_000, run = spawnSync } = {}) {
  for (const value of [statementTimeoutMs, lockTimeoutMs]) {
    assert.ok(Number.isInteger(value) && value >= 1 && value <= 60_000, "Transaction timeouts must be 1–60000 ms");
  }
  // The caller supplies one transaction body, without BEGIN/COMMIT/ROLLBACK.
  // No startup PGOPTIONS reaches the pooler, including inherited PGOPTIONS.
  return runPsql(connection, `BEGIN; SET LOCAL statement_timeout='${statementTimeoutMs}ms'; SET LOCAL lock_timeout='${lockTimeoutMs}ms';\n${body}\nCOMMIT;`, [], { run });
}
