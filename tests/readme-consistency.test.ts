import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * README consistency contract.
 *
 * The README is the repository's front door, so every claim it makes about the
 * repository must stay true mechanically, not just at authoring time:
 *
 * 1. Every file path it references must exist on disk (markdown links, images,
 *    and inline-code paths). A moved or renamed doc breaks the README silently
 *    otherwise.
 * 2. Every `npm run <script>` it mentions must exist in package.json. Command
 *    names drift when scripts are renamed; this pins the contract in both
 *    directions of rename.
 * 3. It must not hardcode volatile snapshot counts (publication split,
 *    relationship totals, reference/verification totals, Vitest suite size).
 *    PR #461 replaced those with a generator table (`kb:validate`,
 *    `citations:audit`, `authoring:tracker`) precisely because they caused
 *    documentation-only commits and merge conflicts on every authoring change.
 *    Versioned milestone numbers (e.g. the 813-condition 2026-09 expansion) are
 *    historical facts and are deliberately NOT banned.
 * 4. The generated-snapshot policy itself must stay visible: the generator
 *    table anchors and the "does not hardcode snapshot counts" statement are
 *    contractual text, not decoration.
 *
 * Numbers anchored to completed, versioned milestones (Waves 1–7, the 2026-09
 * master-list expansion, the 14-step walkthrough) are narrative history, not
 * current-state snapshots, and remain allowed.
 */

const root = process.cwd();
const readme = readFileSync(join(root, "README.md"), "utf8");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};

/**
 * Extract candidate file references from markdown links/images and inline code.
 *
 * The README writes many non-path phrases in backticks (clinical shorthand
 * like `2/2`, medical terms like `HIV/AIDS`, packages like `@vercel/otel`,
 * concepts like `published/draft`), so a bare "looks like a path" regex would
 * drown in false positives. Two precise sources instead:
 *
 * 1. Markdown link/image targets (`[text](path)`) — checked as-is.
 * 2. Inline-code spans that are either a known slash-less root file
 *    (package.json, SECURITY.md, ...) or begin with a real repository root
 *    directory (data/, src/, docs/, tests/, e2e/, scripts/, public/, .github/).
 *    Anything else in backticks is prose, a route, a command, or a term and is
 *    not an on-disk path claim.
 */
const repoRoots = [
  "data/",
  "src/",
  "docs/",
  "tests/",
  "e2e/",
  "scripts/",
  "public/",
  ".github/",
];
const rootFiles = new Set([
  "package.json",
  "package-lock.json",
  "SECURITY.md",
  "README.md",
  ".env.example",
  ".env.template",
]);

function readmeFileReferences(): string[] {
  const linkTargets = [...readme.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)].map(
    (match) => match[1],
  );

  const codePaths: string[] = [];
  // Single-line spans only: a stray unpaired backtick in one prose line must
  // not invert span pairing for the entire rest of the document.
  for (const span of [...readme.matchAll(/`([^`\n]+)`/g)].map((m) => m[1])) {
    if (rootFiles.has(span)) {
      codePaths.push(span);
      continue;
    }
    if (repoRoots.some((rootDir) => span.startsWith(rootDir))) {
      codePaths.push(span);
    }
  }
  return [...linkTargets, ...codePaths];
}

/** References that are not on-disk paths and must never be existence-checked. */
function isNotARepoPath(reference: string): boolean {
  return (
    reference.startsWith("http://") ||
    reference.startsWith("https://") ||
    reference.startsWith("#") || // markdown anchors
    reference.startsWith("localhost") ||
    reference.includes("<") || // doc templates like data/knowledge-base/<id>.json
    reference.includes(">")
  );
}

describe("README consistency", () => {
  it("references only files that exist in the repository", () => {
    const candidates = readmeFileReferences().filter(
      (reference) => !isNotARepoPath(reference),
    );
    const missing = [...new Set(candidates)].filter(
      (reference) => !existsSync(join(root, reference)),
    );

    expect(
      missing,
      `README references files that do not exist: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("references only npm scripts that exist in package.json", () => {
    const referenced = [
      ...readme.matchAll(/\bnpm run\s+([a-z0-9][a-z0-9:-]*)/g),
    ].map((match) => match[1]);
    const scripts = pkg.scripts ?? {};
    const missing = [...new Set(referenced)].filter(
      (name) => !(name in scripts),
    );

    expect(
      missing,
      `README references npm scripts that are not defined in package.json: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("does not hardcode volatile snapshot counts", () => {
    // Each pattern matches a class of current-state snapshot number that the
    // README policy requires to be generated (see the snapshot-generator
    // table) rather than transcribed. The (?<![\w-]) guard keeps counts glued
    // to identifiers (e.g. the "33" in "ME-33 relationship") from matching.
    // Extend this list when a new volatile metric class appears; do not loosen
    // it to make a regression pass.
    const bannedPatterns: Array<{ name: string; pattern: RegExp }> = [
      {
        name: "published/draft split",
        pattern:
          /(?<![\w-])\d[\d,]*\s+published\b|(?<![\w-])\d[\d,]*\s+draft\b|(?<![\w-])\d[\d,]*\s+published\s*\/\s*\d[\d,]*\s+draft\b/,
      },
      {
        name: "relationship totals",
        pattern: /(?<![\w-])\d[\d,]*\+?\s+(?:authored\s+)?relationships?\b/,
      },
      {
        name: "mapping-file totals",
        pattern: /(?<![\w-])\d[\d,]*\s+mappings?\b/,
      },
      {
        name: "reference/verification totals",
        pattern:
          /(?<![\w-])\d[\d,]*\s+(?:live\s+)?(?:relationship-source\s+)?(?:source\s+)?(?:references|refs|verified|unverified)\b/,
      },
      {
        name: "test-suite totals",
        pattern:
          /(?<![\w-])\d[\d,]*\s+(?:tests|test files)\b|(?<![\w-])\d[\d,]*\s+files\s*\/\s*\d[\d,]*\s+tests\b/,
      },
    ];

    const hits = bannedPatterns.flatMap(({ name, pattern }) =>
      [...readme.matchAll(new RegExp(pattern.source, "gi"))].map(
        (match) => `${name}: "${match[0]}"`,
      ),
    );

    expect(
      hits,
      "README must not hardcode volatile snapshot counts; point at the generator CLI instead",
    ).toEqual([]);
  });

  it("keeps the generated-snapshot policy anchors visible", () => {
    // The snapshot table is the replacement for hardcoded counts; if these
    // anchors disappear the volatile-count ban above loses its rationale.
    for (const generator of [
      "npm run kb:validate",
      "npm run citations:audit",
      "npm run authoring:tracker",
    ]) {
      expect(readme).toContain(generator);
    }
    expect(readme).toMatch(/does not\s+hardcode snapshot counts/);
  });
});
