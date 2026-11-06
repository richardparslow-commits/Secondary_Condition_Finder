import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the checkout against forked path names.
 *
 * A folder-sync client watching this directory can materialize a second copy of a
 * file it sees mid-write, named `<name> 2.<ext>`. Those copies are real files:
 * TypeScript typechecks them, ESLint lints them, and to any test that derives its
 * expectations from the tree a copy is indistinguishable from a new module. This
 * suite makes their presence a failure rather than something the other suites
 * route around, because a checkout that silently grows duplicate source is a
 * checkout whose test results cannot be trusted.
 *
 * The durable fix is placement, not detection: keep the checkout outside every
 * folder-sync root — iCloud Drive's Desktop and Documents, Dropbox, OneDrive,
 * Google Drive.
 *
 * `.git` is scanned rather than pruned, because inside it a fork is corruption
 * rather than duplication. A forked `.git/index` is invisible to every other
 * check — git never reads it, so `git fsck` stays quiet and `git status` stays
 * clean — yet five of them accumulated in this repository over three weeks, each
 * a snapshot of the index at a different moment in its history.
 */

const ROOT = process.cwd();

/**
 * Generated or vendored: these legitimately contain names a fork detector
 * would match. `.open-next` is the ignored OpenNext build tree; it vendors a
 * copy of dependencies and app data, so it is not source and must not make the
 * checkout-hygiene guard fail.
 */
const PRUNED = new Set(["node_modules", ".next", ".open-next"]);

/**
 * A forking suffix: `<name> 2.ts`, `<name> 3.json`, `<name> 2`.
 *
 * No path in this repository contains a space, so this cannot match legitimate
 * content today; a suite below pins that, so the assumption fails loudly if a
 * future path ever does contain one.
 */
const FORKED_NAME = / \d+(\.[A-Za-z0-9._-]+)?$/;

/** Every path in the checkout, repo-relative, POSIX-separated, with generated trees pruned. */
function listPaths(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (PRUNED.has(entry.name)) return [];
    const absolute = path.join(directory, entry.name);
    const nested = entry.isDirectory() ? listPaths(absolute) : [];
    const relative = path.relative(ROOT, absolute).split(path.sep).join("/");
    return [relative, ...nested];
  });
}

function forkedPaths(paths: string[]): string[] {
  return paths.filter((candidate) => FORKED_NAME.test(path.basename(candidate))).sort();
}

describe("checkout fork hygiene", () => {
  it("recognises the naming pattern it guards against", () => {
    for (const forked of [
      "src/lib/runtime-deployment 2.ts",
      "tests/bounded-response.test 2.ts",
      "docs/notes 3.md",
      "data/catalog 12.json",
      "src 2",
    ]) {
      expect(FORKED_NAME.test(path.basename(forked)), forked).toBe(true);
    }

    for (const legitimate of [
      "src/lib/runtime-deployment.ts",
      "tests/checkout-fork-hygiene.test.ts",
      "eslint.config.mjs",
      "docs/operations.md",
      "data/2026-09-17-catalog.json",
      "CHANGELOG.md",
    ]) {
      expect(FORKED_NAME.test(path.basename(legitimate)), legitimate).toBe(false);
    }
  });

  it("walks the whole checkout rather than a pruned corner", () => {
    const paths = listPaths(ROOT);

    // Anti-vacuity: the detection below is meaningless on a walk that saw nothing
    // or that quietly lost most of the tree.
    expect(paths.length).toBeGreaterThan(1000);
    expect(paths).toContain("src/lib/runtime-capabilities.ts");
    expect(paths).toContain("tests/checkout-fork-hygiene.test.ts");
    expect(paths).toContain("docs/operations.md");
    expect(paths.some((candidate) => candidate.startsWith("node_modules/"))).toBe(false);
    expect(paths.some((candidate) => candidate.startsWith(".next/"))).toBe(false);
    expect(paths.some((candidate) => candidate.startsWith(".open-next/"))).toBe(false);
    // The one tree that must be scanned even though it is not source.
    expect(paths).toContain(".git/HEAD");
  });

  it("holds no forked path names", () => {
    const forked = forkedPaths(listPaths(ROOT));

    expect(
      forked,
      `this checkout contains forked path names: ${forked.join(", ")}. A folder-sync ` +
        `client (iCloud Drive, Dropbox, OneDrive, Google Drive) duplicates files it sees ` +
        `mid-write; these copies are byte-identical forks of the originals, not edits. ` +
        `Move the checkout outside every sync root and delete them — while they exist, ` +
        `the capability guard skips them as duplicates and can report a forked copy of a ` +
        `module as accounted for.`,
    ).toEqual([]);
  });
});
