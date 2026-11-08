import { describe, expect, it, vi } from "vitest";
import { readTiger, getLabConnection, executeLabSql } from "../scripts/lib/tiger-lab-client.mjs";

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
