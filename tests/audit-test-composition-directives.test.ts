import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Regression contract for React directive detection in the composition gate.
 *
 * The gate used to search for the exact double-quoted text, so single-quoted
 * `use client` / `use server` directives bypassed the boundary and placement
 * rules, while quoted comments and non-prologue strings could trigger them.
 * These fixtures run the real script in an isolated repository.
 */

const ROOT = process.cwd();
const COMPOSITION_SCRIPT = path.join(ROOT, "scripts", "audit-test-composition.js");
const NODE_PATH = process.env.NODE_PATH
  ? `${path.join(ROOT, "node_modules")}${path.delimiter}${process.env.NODE_PATH}`
  : path.join(ROOT, "node_modules");

type ArchitectureEntry = {
  rule: string;
  status: string;
  message: string;
};

type CompositionReport = {
  testFiles: number;
  criticalModules: number;
  executableImportsCovered: number;
  executableImportCoveragePercent: number;
  requiredPercent: number;
  missing: string[];
  architectureRules: number;
  architectureClean: boolean;
  architecture: ArchitectureEntry[];
};

function runComposition(files: Record<string, string>): {
  status: number | null;
  report: CompositionReport;
} {
  const fixture = mkdtempSync(path.join(tmpdir(), "scf-composition-"));
  try {
    mkdirSync(path.join(fixture, "scripts"), { recursive: true });
    copyFileSync(
      COMPOSITION_SCRIPT,
      path.join(fixture, "scripts", "audit-test-composition.js"),
    );
    mkdirSync(path.join(fixture, "src"), { recursive: true });
    mkdirSync(path.join(fixture, "tests"), { recursive: true });

    for (const [relative, content] of Object.entries(files)) {
      const absolute = path.join(fixture, relative);
      mkdirSync(path.dirname(absolute), { recursive: true });
      writeFileSync(absolute, content);
    }

    const result = spawnSync(
      process.execPath,
      [path.join(fixture, "scripts", "audit-test-composition.js")],
      {
        cwd: fixture,
        encoding: "utf8",
        env: { ...process.env, NODE_PATH },
      },
    );
    expect(result.error).toBeUndefined();
    if (!result.stdout.trim()) {
      throw new Error(
        `composition audit produced no report:\n${result.stdout}\n${result.stderr}`,
      );
    }
    return {
      status: result.status,
      report: JSON.parse(result.stdout) as CompositionReport,
    };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

describe("composition directive prologue", () => {
  it("flags a single-quoted use server directive outside src/lib/actions", () => {
    const source = [
      "// A leading comment must not hide the directive prologue.",
      "'use server';",
      "",
      "export async function probe() {",
      "  return 1;",
      "}",
    ].join("\n");

    const { report } = runComposition({
      "src/probe.ts": source,
    });

    expect(report.architectureClean).toBe(false);
    expect(
      report.architecture.some(
        (entry) => entry.rule === "SERVER-ACTION-PLACEMENT",
      ),
    ).toBe(true);
  });

  it("flags a single-quoted use client directive with a forbidden import", () => {
    const source = [
      "'use client';",
      'export { schema } from "@/lib/kb/schema";',
    ].join("\n");

    const { report } = runComposition({
      "src/app/client.ts": source,
    });

    expect(report.architectureClean).toBe(false);
    const violation = report.architecture.find(
      (entry) => entry.rule === "CLIENT-BOUNDARY",
    );
    expect(violation?.message).toContain("@/lib/kb/schema");
  });

  it("still enforces double-quoted directives", () => {
    const { report } = runComposition({
      "src/probe.ts": [
        '"use server";',
        "export async function probe() {",
        "  return 1;",
        "}",
      ].join("\n"),
      "src/app/client.ts": [
        '"use client";',
        'export { schema } from "@/lib/kb/schema";',
      ].join("\n"),
    });

    expect(report.architectureClean).toBe(false);
    expect(
      report.architecture.some(
        (entry) => entry.rule === "SERVER-ACTION-PLACEMENT",
      ),
    ).toBe(true);
    expect(
      report.architecture.some((entry) => entry.rule === "CLIENT-BOUNDARY"),
    ).toBe(true);
  });

  it("ignores directive-shaped text in comments and ordinary strings", () => {
    const { report } = runComposition({
      "src/probe.ts": [
        '// "use server" appears only in this comment.',
        `export const note = '"use server"';`,
      ].join("\n"),
      "src/app/client.ts": [
        '// "use client" appears only in this comment.',
        'import { schema } from "@/lib/kb/schema";',
        "export { schema };",
      ].join("\n"),
    });

    expect(report.architectureClean).toBe(true);
  });

  it("does not treat a directive after another statement as a prologue", () => {
    const { report } = runComposition({
      "src/probe.ts": [
        'import { value } from "./value";',
        '"use server";',
        "export async function probe() {",
        "  return value;",
        "}",
      ].join("\n"),
      "src/app/client.ts": [
        'import { schema } from "@/lib/kb/schema";',
        '"use client";',
        "export { schema };",
      ].join("\n"),
    });

    expect(report.architectureClean).toBe(true);
  });

  it("allows a single-quoted use server directive under src/lib/actions", () => {
    const { report } = runComposition({
      "src/lib/actions/allowed.ts": [
        "'use server';",
        "export async function allowed() {",
        "  return 1;",
        "}",
      ].join("\n"),
    });

    expect(report.architectureClean).toBe(true);
  });
});
