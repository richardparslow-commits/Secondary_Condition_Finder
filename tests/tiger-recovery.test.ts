import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { assertRecovered, tableSql, validateBackup, runRecoveryDrill } from "../scripts/test-tiger-recovery.mjs";

const csv = '1,2026-01-01 00:01:00+00,synthetic,"{""sequence"": 1}"\n';
const expected = { rows: 10000, distinct_ids: 10000, digest: "a".repeat(32), hypertable: true, primary_key: ["created_at", "id"] };
const manifest = () => ({ format: "scf-synthetic-audit-v1", columns: ["id", "created_at", "run_label", "payload"], expected: { ...expected }, csv_sha256: createHash("sha256").update(csv).digest("hex") });

describe("complete audit recovery acceptance", () => {
  it("accepts matching structure and exact content summary", () => {
    expect(() => assertRecovered(expected, { ...expected })).not.toThrow();
  });
  it.each([
    { rows: 0, distinct_ids: 0 },
    { rows: 9999 },
    { distinct_ids: 9999 },
    { digest: "b".repeat(32) },
    { hypertable: false },
    { primary_key: ["id"] },
  ])("rejects partial/stale/structurally incorrect recovery: %j", (change) => {
    expect(() => assertRecovered(expected, { ...expected, ...change })).toThrow(/differs from backup/);
  });
});

describe("backup integrity", () => {
  it("accepts an intact checksum manifest", () => {
    expect(validateBackup(manifest(), csv)).toBe(csv);
  });
  it.each(["", csv.slice(0, -8), csv.replace("sequence", "modified")])("rejects missing or changed bytes", (data) => {
    expect(() => validateBackup(manifest(), data)).toThrow();
  });
  it.each([
    { format: "unknown" }, { columns: ["id"] },
    { expected: { ...expected, rows: 0 } },
    { expected: { ...expected, distinct_ids: 9999 } },
    { expected: { ...expected, hypertable: false } },
  ])("rejects invalid/incomplete metadata: %j", (change) => {
    expect(() => validateBackup({ ...manifest(), ...change }, csv)).toThrow();
  });
});

describe("recovery isolation", () => {
  it.each(["public", "scf_tiger_lab", "scf_recovery_bad_src; DROP SCHEMA public", "scf_recovery_0123456789abcdef_other"])("rejects unsafe schema names", (name) => {
    expect(() => tableSql(name)).toThrow();
  });
  it("rejects any service except the dedicated test service before connecting", () => {
    const connect = vi.fn();
    expect(() => runRecoveryDrill("llw8r9xm7v", "/unused", { connect })).toThrow(/restricted/);
    expect(connect).not.toHaveBeenCalled();
  });
});
