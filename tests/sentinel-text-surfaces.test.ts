import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readSentinelTextSurface, sentinelDevTracePath } from "../scripts/lib/sentinel-text-surfaces.mjs";

const tempDirs: string[] = [];
function fixture(files: Record<string, string> = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-text-surfaces-"));
  tempDirs.push(root);
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

afterEach(() => {
  for (const root of tempDirs.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("sentinel live dev trace source", () => {
  it("resolves Next 16's development trace, not its build trace", () => {
    expect(sentinelDevTracePath()).toBe(path.join(process.cwd(), ".next", "dev", "trace"));
  });

  it("scans a dev-only checkout like CI without requiring a build trace", () => {
    const root = fixture({ ".next/dev/trace": '[{"name":"handle-request"}]\n' });
    const result = readSentinelTextSurface(sentinelDevTracePath(root), 4_000_000);
    expect(result.text).toContain("handle-request");
    expect(result.observation.status).toBe("scanned");
    expect(result.observation.bytes).toBeGreaterThan(0);
  });

  it("does not let a clean stale build trace hide a sentinel in the dev trace", () => {
    const sentinel = "SENTINEL_PRIVATE_TRACE_CONTROL";
    const root = fixture({
      ".next/trace": '[{"name":"old-build"}]\n',
      ".next/dev/trace": JSON.stringify({ privateField: sentinel }),
    });
    const result = readSentinelTextSurface(sentinelDevTracePath(root), 4_000_000);
    expect(result.text).toContain(sentinel);
    expect(result.text).not.toContain("old-build");
  });

  it("cannot substitute a stale build trace for missing development output", () => {
    const root = fixture({ ".next/trace": '[{"name":"old-build"}]\n' });
    const result = readSentinelTextSurface(sentinelDevTracePath(root), 4_000_000);
    expect(result.text).toBe("");
    expect(result.observation).toMatchObject({ status: "missing", bytes: 0 });
  });
});

describe("sentinel bounded text scans", () => {
  it("scans the current content after rotation instead of slicing from an old offset", () => {
    const root = fixture({ "server.log": "SENTINEL_AFTER_ROTATION" });
    const result = readSentinelTextSurface(path.join(root, "server.log"), 100, 2_000);
    expect(result.text).toBe("SENTINEL_AFTER_ROTATION");
    expect(result.observation).toMatchObject({ rewrittenDuringRun: true, bytesBeforeRun: 2_000 });
  });

  it("scans the whole file even when its size did not change", () => {
    const root = fixture({ "trace": "SENTINEL" });
    const result = readSentinelTextSurface(path.join(root, "trace"), 100, 8);
    expect(result.text).toBe("SENTINEL");
    expect(result.observation).toMatchObject({ bytes: 8, sizeBytes: 8 });
  });

  it("preserves the character cap while recording the full size", () => {
    const root = fixture({ "trace": "0123456789SENTINEL" });
    const result = readSentinelTextSurface(path.join(root, "trace"), 8);
    expect(result.text).toBe("SENTINEL");
    expect(result.observation).toMatchObject({ bytes: 8, sizeBytes: 18 });
  });

  it("records an empty file as zero coverage, not a successful nonempty scan", () => {
    const root = fixture({ "trace": "" });
    expect(readSentinelTextSurface(path.join(root, "trace"), 100)).toMatchObject({
      text: "", observation: { status: "scanned", bytes: 0, sizeBytes: 0 },
    });
  });

  it("throws on an unreadable surface instead of hiding it as missing", () => {
    const root = fixture();
    expect(() => readSentinelTextSurface(root, 100)).toThrow();
  });

  it.each([0, -1, 1.5, Infinity])("rejects an invalid scan limit %s", (limit) => {
    expect(() => readSentinelTextSurface("missing", limit)).toThrow(/positive integer/);
  });

  it("keeps missing and empty traces fail-closed in the real walk", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "scripts/acceptance-browser-sentinel.mjs"), "utf8");
    expect(source).toContain("const TRACE_FILE = sentinelDevTracePath();");
    expect(source).toContain("readSentinelTextSurface(TRACE_FILE, TEXT_SURFACE_SCAN_LIMIT, traceBefore)");
    expect(source).toContain('scanText("trace-file", TRACE_FILE, traceFile.text)');
    const assertion = source.slice(source.indexOf('"server log and trace file were scanned in full'), source.indexOf("// Final assertions and report."));
    expect(assertion).toContain('observation.status === "scanned"');
    expect(assertion).toContain("text.length > 0");
    expect(assertion).not.toContain('=== "missing"');
    const notes = source.slice(source.indexOf("const SURFACE_COVERAGE_NOTES ="), source.indexOf("observations.requestBodies ="));
    expect(notes).not.toContain('"trace-file"');
    expect(notes).not.toContain('"server-log"');
  });

  it("leaves a sentinel before the bounded tail unscanned", () => {
    const sentinel = "SENTINEL_BEFORE_BOUNDED_TAIL";
    const root = fixture({ "trace": `${sentinel}${"x".repeat(64)}` });
    const result = readSentinelTextSurface(path.join(root, "trace"), 32);

    expect(result.text).not.toContain(sentinel);
    expect(result.observation).toMatchObject({
      status: "scanned",
      bytes: 32,
      sizeBytes: sentinel.length + 64,
    });
  });

  it("requires the whole file to fit inside the scan cap before claiming full coverage", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "scripts/acceptance-browser-sentinel.mjs"),
      "utf8",
    );
    const assertion = source.slice(
      source.indexOf('"server log and trace file were scanned in full'),
      source.indexOf("// Final assertions and report."),
    );

    expect(assertion).toContain("observation.sizeBytes <= TEXT_SURFACE_SCAN_LIMIT");
    expect(assertion).toContain("text.length === observation.sizeBytes");
    expect(assertion).not.toContain(
      "Math.min(observation.sizeBytes, TEXT_SURFACE_SCAN_LIMIT)",
    );
  });
});
