import { describe, expect, it, vi } from "vitest";
import { readTiger, getLabConnection, executeLabSql, executeLabTransaction } from "../scripts/lib/tiger-lab-client.mjs";

const ok = (stdout: string) => ({ status: 0, stdout, stderr: "" });
const fail = (stderr: string) => ({ status: 1, stdout: "", stderr });
const service = "llw8r9xm7v";
const metadata = { service_id: service, name: "secondary-condition-finder-fixture-source", metadata: { environment: "DEV" }, status: "READY", endpoint: { host: "fixture.example", port: 5432 } };
const uri = "postgresql://lab:p%40ss@fixture.example:5432/tsdb?sslmode=require";

function connect(overrides = {}, raw = uri, mode = "seed") {
  const run = vi.fn().mockReturnValueOnce(ok(JSON.stringify({ ...metadata, ...overrides }))).mockReturnValueOnce(ok(raw));
  return { run, call: () => getLabConnection(service, mode, { run, wait: vi.fn() }) };
}

describe("Tiger management reads", () => {
  it("retries a transient lookup with bounded backoff and sufficient timeout", () => {
    const run = vi.fn().mockReturnValueOnce(fail("Client.Timeout exceeded while awaiting headers")).mockReturnValueOnce(ok("resolved"));
    const wait = vi.fn();
    expect(readTiger(["service", "get", service], { run, wait })).toBe("resolved");
    expect(wait).toHaveBeenCalledWith(500);
    expect(run.mock.calls[0][1]).toContain("--version-check=false");
    expect(run.mock.calls[0][2].timeout).toBe(45_000);
  });
  it("stops after three temporary failures without printing secrets", () => {
    const run = vi.fn().mockReturnValue({ ...fail("context deadline exceeded secret-password"), stdout: uri });
    expect(() => readTiger(["db", "uri", service], { run, wait: vi.fn() })).toThrow(/3 attempt/);
    expect(run).toHaveBeenCalledTimes(3);
    try { readTiger(["db", "uri", service], { run, wait: vi.fn() }); } catch (error) { expect(String(error)).not.toContain("secret-password"); expect(String(error)).not.toContain("p%40ss"); }
  });
  it.each(["401 unauthorized timeout", "permission denied", "unknown error"])("does not retry %s", (message) => {
    const run = vi.fn().mockReturnValue(fail(message));
    expect(() => readTiger(["service", "get", service], { run })).toThrow();
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe("lab isolation", () => {
  it("decodes credentials without putting them in command arguments", () => {
    const c = connect();
    expect(c.call()).toMatchObject({ PGPASSWORD: "p@ss", PGHOST: "fixture.example", PGSSLMODE: "require" });
    expect(c.run).toHaveBeenCalledTimes(2);
    expect(c.run.mock.calls.flat(2).filter(v => typeof v === "string").join(" ")).not.toContain("p@ss");
  });
  it.each([
    { metadata: { environment: "PROD" } },
    { name: "other-service" },
    { service_id: "m8vrpmo6ec" },
    { status: "PAUSED" },
  ])("rejects unsafe metadata before credential lookup: %j", (override) => {
    const c = connect(override); expect(c.call).toThrow(); expect(c.run).toHaveBeenCalledTimes(1);
  });
  it("allows destination verification but refuses destination seeding", () => {
    expect(connect({ name: "secondary-condition-finder-test" }, uri, "verify").call()).toBeTruthy();
    expect(connect({ name: "secondary-condition-finder-test" }).call).toThrow();
  });
  it.each([uri.replace("fixture.example", "other.example"), uri.replace(":5432", ":5433"), uri.replace("require", "disable"), "not-a-uri"])("refuses mismatched/invalid connection details", raw => {
    expect(connect({}, raw).call).toThrow();
  });
});

describe("SQL delivery", () => {
  it("executes once through psql with credentials in environment and bounded statement timeout", () => {
    const connection = connect().call(); const run = vi.fn().mockReturnValue(ok("done"));
    expect(executeLabSql(connection, "SELECT 1", [], { run })).toBe("done");
    expect(run.mock.calls[0][1]).toContain("-w");
    expect(run.mock.calls[0][1].join(" ")).not.toContain("p@ss");
    expect(run.mock.calls[0][2]).toMatchObject({ input: "SELECT 1", timeout: 120_000, env: { PGPASSWORD: "p@ss", PGOPTIONS: "-c statement_timeout=15000" } });
  });
  it("never retries an ambiguous write failure or leaks its output", () => {
    const run = vi.fn().mockReturnValue({ ...fail("p@ss secret"), error: { code: "ETIMEDOUT" } });
    expect(() => executeLabSql(connect().call(), "COMMIT", [], { run })).toThrow(/not retried/);
    expect(run).toHaveBeenCalledTimes(1);
  });
});


describe("transaction pooler compatibility", () => {
  const pooledMetadata = { ...metadata, connection_pooler: { endpoint: { host: "fixture.example", port: 6432 } } };
  function pooledConnection(raw = uri.replace(":5432", ":6432")) {
    const run = vi.fn().mockReturnValueOnce(ok(JSON.stringify(pooledMetadata))).mockReturnValueOnce(ok(raw));
    return { run, call: () => getLabConnection(service, "verify", { pooled: true, run }) };
  }
  it("resolves and validates the pooler port rather than silently using the direct endpoint", () => {
    const c = pooledConnection();
    expect(c.call()).toMatchObject({ PGPORT: "6432", TIGER_LAB_ENDPOINT: "pooled" });
    expect(c.run.mock.calls[1][1]).toContain("--pooled");
    expect(pooledConnection(uri).call).toThrow(/port differs/);
  });
  it("fails before retrieving credentials when the pooler is unavailable", () => {
    const run = vi.fn().mockReturnValue(ok(JSON.stringify(metadata)));
    expect(() => getLabConnection(service, "verify", { pooled: true, run })).toThrow(/unavailable/);
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("removes inherited startup options and applies limits inside a single transaction", () => {
    const run = vi.fn().mockReturnValue(ok("bounded"));
    const previous = process.env.PGOPTIONS;
    process.env.PGOPTIONS = "-c statement_timeout=999";
    try {
      expect(executeLabTransaction(pooledConnection().call(), "SELECT 1;", { run })).toBe("bounded");
      expect(run.mock.calls[0][2].env.PGOPTIONS).toBe("");
      expect(run.mock.calls[0][2].input).toMatch(/^BEGIN; SET LOCAL statement_timeout='15000ms'; SET LOCAL lock_timeout='5000ms';/);
      expect(run.mock.calls[0][2].input).toMatch(/SELECT 1;\nCOMMIT;$/);
    } finally {
      if (previous === undefined) delete process.env.PGOPTIONS; else process.env.PGOPTIONS = previous;
    }
  });
  it("refuses unbounded raw pooled SQL before sending anything", () => {
    const run = vi.fn();
    expect(() => executeLabSql(pooledConnection().call(), "SELECT 1", [], { run })).toThrow(/executeLabTransaction/);
    expect(run).not.toHaveBeenCalled();
  });
  it.each([0, -1, 60_001, 1.5, NaN])("rejects invalid statement/lock timeout %s", (value) => {
    const run = vi.fn();
    expect(() => executeLabTransaction({}, "SELECT 1", { statementTimeoutMs: value, run })).toThrow();
    expect(() => executeLabTransaction({}, "SELECT 1", { lockTimeoutMs: value, run })).toThrow();
    expect(run).not.toHaveBeenCalled();
  });
  it("preserves only the SQLSTATE for a timeout and never retries the failed transaction", () => {
    const run = vi.fn().mockReturnValue(fail("ERROR:  57014: canceling statement due to statement timeout secret"));
    let failure;
    try { executeLabTransaction({}, "SELECT pg_sleep(1);", { run, statementTimeoutMs: 25 }); }
    catch (error) { failure = error; }
    expect(failure).toMatchObject({ sqlstate: "57014" });
    expect(String(failure)).not.toContain("secret");
    expect(run).toHaveBeenCalledTimes(1);
  });
});
