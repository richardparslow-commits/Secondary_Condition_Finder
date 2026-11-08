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
 * Regression contract for the composition gate's import scanner.
 *
 * The gate used to regex-scan raw source, so comments and ordinary strings
 * could satisfy critical-module coverage while no-substitution template
 * imports were invisible to the architecture boundaries. These fixtures run
 * the real script in an isolated repository and assert the parser behaviour.
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

describe("composition import scanner", () => {
  it("does not count import-shaped comments or strings as executable coverage", () => {
    const source = [
      '// import { recommend } from "@/lib/engine/recommend";',
      '/* import { recommend } from "@/lib/engine/recommend"; */',
      'const quoted = \'import { recommend } from "@/lib/engine/recommend";\';',
      'const doubleQuoted = "from \'@/lib/engine/recommend\'";',
      "export {};",
    ].join("\n");

    const { status, report } = runComposition({
      "tests/bait.test.ts": source,
    });

    expect(report.missing).toContain("@/lib/engine/recommend");
    expect(report.executableImportsCovered).toBe(0);
    expect(status).toBe(1);
  });

  it("does not count type-only imports or exports as executable coverage", () => {
    const source = [
      'import type { KnowledgeBase } from "@/lib/kb/schema";',
      'import { type Recommendation } from "@/lib/engine/recommend";',
      'export type { VaApiResult } from "@/lib/va/sandbox";',
      'export { type VaApiResult as ApiResult } from "@/lib/va/api";',
      "export {};",
    ].join("\n");

    const { report } = runComposition({
      "tests/types.test.ts": source,
    });

    expect(report.missing).toEqual(
      expect.arrayContaining([
        "@/lib/kb/schema",
        "@/lib/engine/recommend",
        "@/lib/va/sandbox",
        "@/lib/va/api",
      ]),
    );
    expect(report.executableImportsCovered).toBe(0);
  });

  it("counts ordinary static, re-exported, string-dynamic, and template-dynamic imports", () => {
    const source = [
      'import { recommend } from "@/lib/engine/recommend";',
      'export { buildExport } from "@/lib/engine/export";',
      'const schema = import("@/lib/kb/schema");',
      "const sandbox = import(`@/lib/va/sandbox`);",
      "void schema;",
      "void sandbox;",
    ].join("\n");

    const { report } = runComposition({
      "tests/executable.test.ts": source,
    });

    expect(report.missing).not.toContain("@/lib/engine/recommend");
    expect(report.missing).not.toContain("@/lib/engine/export");
    expect(report.missing).not.toContain("@/lib/kb/schema");
    expect(report.missing).not.toContain("@/lib/va/sandbox");
  });

  it("flags a no-substitution template-literal import across the client boundary", () => {
    const source = [
      '"use client";',
      "",
      "export function loadSchema() {",
      "  return import(`@/lib/kb/schema`);",
      "}",
    ].join("\n");

    const { report } = runComposition({
      "src/app/leak.ts": source,
    });

    expect(report.architectureClean).toBe(false);
    const violation = report.architecture.find(
      (entry) => entry.rule === "CLIENT-BOUNDARY",
    );
    expect(violation?.message).toContain("src/app/leak.ts");
    expect(violation?.message).toContain("@/lib/kb/schema");
  });

  it("still flags an ordinary client-boundary import", () => {
    const source = [
      '"use client";',
      'export { schema } from "@/lib/kb/schema";',
    ].join("\n");

    const { report } = runComposition({
      "src/app/leak.ts": source,
    });

    expect(report.architectureClean).toBe(false);
    expect(
      report.architecture.some((entry) => entry.rule === "CLIENT-BOUNDARY"),
    ).toBe(true);
  });

  it("does not treat import-shaped comments or strings in a client file as boundary violations", () => {
    const source = [
      '"use client";',
      '// import { schema } from "@/lib/kb/schema";',
      `export const note = 'from "@/lib/kb/schema"';`,
    ].join("\n");

    const { report } = runComposition({
      "src/app/notes.ts": source,
    });

    expect(report.architectureClean).toBe(true);
  });
});
