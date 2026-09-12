import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Named contract for the TRACK-SEPARATION composition rules, added alongside
 * the presumptive × secondary research-cue panel so a future refactor cannot
 * quietly weaken the boundary the panel depends on:
 *
 * 1. src/lib/secondary-workflow/ may never import @/lib/presumptive (types exempt).
 * 2. src/lib/presumptive/ may never import @/lib/secondary-workflow, @/lib/kb, or
 *    @/lib/engine (types exempt).
 * 3. The cross-link is legal precisely because src/app/ pages sit OUTSIDE both
 *    rules: /presumptive/results reads both track libraries at render time,
 *    display-only, with no state transfer between tracks.
 */

const ROOT = process.cwd();
const COMPOSITION_SCRIPT = path.join(ROOT, "scripts", "audit-test-composition.js");

function listFiles(directory: string): string[] {
  if (!existsSafe(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(absolute);
    return entry.name.endsWith(".ts") ? [absolute] : [];
  });
}

function existsSafe(directory: string): boolean {
  try {
    statSync(directory);
    return true;
  } catch {
    return false;
  }
}

function importedSpecifiers(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const specifiers: string[] = [];
  const patterns = [
    /import\s+type\s+[^'"]*from\s+['"]([^'"]+)['"]/g,
    /import\s+[^'"]*from\s+['"]([^'"]+)['"]/g,
    /require\(['"]([^'"]+)['"]\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

describe("track-separation composition contract (presumptive × secondary cross-link)", () => {
  it("keeps the composition audit green as shipped", () => {
    const result = spawnSync(process.execPath, [COMPOSITION_SCRIPT], { encoding: "utf8" });
    expect(result.status, `composition audit failed:\n${result.stdout}\n${result.stderr}`).toBe(0);
  });

  it("no secondary-workflow file imports presumptive logic (types exempt)", () => {
    const files = listFiles(path.join(ROOT, "src", "lib", "secondary-workflow"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      for (const specifier of importedSpecifiers(file)) {
        if (specifier.includes("/types")) continue;
        expect(
          specifier.startsWith("@/lib/presumptive"),
          `${file}: forbidden import ${specifier}`,
        ).toBe(false);
      }
    }
  });

  it("no presumptive file imports secondary/KB/engine logic (types exempt)", () => {
    const files = listFiles(path.join(ROOT, "src", "lib", "presumptive"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      for (const specifier of importedSpecifiers(file)) {
        if (specifier.includes("/types")) continue;
        const forbidden = ["@/lib/secondary-workflow", "@/lib/kb", "@/lib/engine"].some((prefix) =>
          specifier.startsWith(prefix),
        );
        expect(forbidden, `${file}: forbidden import ${specifier}`).toBe(false);
      }
    }
  });

  it("the cross-link helper lives under src/app, outside both lib tracks", () => {
    const helper = path.join(ROOT, "src", "app", "presumptive", "results", "secondary-cross-link.ts");
    const source = readFileSync(helper, "utf8");
    expect(source).toContain("secondaryTargetIndex");
    // The helper must not live under either lib track — assert the file layout
    // directly so a well-meaning move to src/lib would trip this test.
    expect(
      helper.includes(path.join("src", "lib")),
      "cross-link helper must stay at the app layer (src/app), not under src/lib tracks",
    ).toBe(false);
  });
});
