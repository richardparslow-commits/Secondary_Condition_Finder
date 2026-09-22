import { describe, expect, it } from "vitest";

import {
  collectNpmScripts,
  collectVolatileCounts,
  missingFileReferences,
  readRepoMarkdown,
} from "./helpers/doc-lint";

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
const readme = readRepoMarkdown(root, "README.md");
const pkg = JSON.parse(readRepoMarkdown(root, "package.json")) as {
  scripts?: Record<string, string>;
};

/*
 * Reference, script, and volatile-count extraction lives in the shared
 * doc-lint harness (./helpers/doc-lint) so the per-doc living-documentation
 * policy in tests/doc-lint.test.ts enforces the identical rules. The harness
 * doc-comments document the false-positive rationale in full.
 */

describe("README consistency", () => {
  it("references only files that exist in the repository", () => {
    const missing = missingFileReferences(readme, root);

    expect(
      missing,
      `README references files that do not exist: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("references only npm scripts that exist in package.json", () => {
    const referenced = collectNpmScripts(readme);
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
    const hits = collectVolatileCounts(readme);

    expect(
      hits.map(({ patternName, match }) => `${patternName}: "${match}"`),
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
