#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * README snapshot-generator table generator (npm run readme:snapshot).
 *
 * The README's "Knowledge-base snapshot" table maps each snapshot metric to
 * the CLI that produces it. Hand-maintaining that table reintroduced exactly
 * the drift problem the generated-snapshot policy exists to prevent: a script
 * could be renamed (leaving a dead `npm run` reference) or a row edited away
 * (losing a generator) with nothing failing.
 *
 * The single source of truth is the `snapshotGenerators` metadata block in
 * package.json — keys are npm script names, values are the metric
 * descriptions. This script renders the table from that metadata into a
 * marker-fenced region of README.md:
 *
 *   npm run readme:snapshot          # regenerate the region in place
 *   npm run readme:snapshot -- --check  # exit 1 if the region is stale
 *
 * tests/readme-consistency.test.ts runs the --check surface as part of the
 * doc-lint gate (verify-doc-lint), so neither the metadata nor the README
 * copy can drift from the other.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const README_PATH = path.join(ROOT, "README.md");
const PKG_PATH = path.join(ROOT, "package.json");

const REGION_START = "<!-- generated:snapshot-generators:start -->";
const REGION_END = "<!-- generated:snapshot-generators:end -->";

/**
 * Load and validate the snapshotGenerators metadata. Throws with an
 * actionable message so a bad edit fails at generation time, not silently.
 */
function loadSnapshotGenerators(pkg) {
  const metadata = pkg.snapshotGenerators;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error(
      "package.json is missing the \"snapshotGenerators\" metadata object (script name -> metric description).",
    );
  }
  const entries = Object.entries(metadata);
  if (entries.length === 0) {
    throw new Error("package.json \"snapshotGenerators\" must list at least one generator.");
  }
  const scripts = pkg.scripts ?? {};
  return entries.map(([name, description]) => {
    if (typeof description !== "string" || description.trim() === "") {
      throw new Error(`snapshotGenerators["${name}"] must be a non-empty metric description.`);
    }
    if (description.includes("|") || description.includes("`")) {
      throw new Error(
        `snapshotGenerators["${name}"] description must not contain "|" or backticks (table safety).`,
      );
    }
    if (!(name in scripts)) {
      throw new Error(
        `snapshotGenerators["${name}"] does not correspond to a script in package.json; the generated table would reference a command that does not exist.`,
      );
    }
    return { name, description };
  });
}

/** Render the markdown table exactly as it appears in the README region. */
function renderSnapshotTable(generators) {
  const lines = [
    "| Snapshot metric | Generator |",
    "|-----------------|-----------|",
    ...generators.map(
      ({ name, description }) => `| ${description} | \`npm run ${name}\` |`,
    ),
  ];
  return lines.join("\n");
}

/**
 * Replace the marker-fenced region in the README with the rendered table.
 * Throws when the markers are missing, duplicated, or misordered so a broken
 * fence is a loud failure instead of a silent regeneration elsewhere.
 */
function applyToReadme(regionContent) {
  const text = fs.readFileSync(README_PATH, "utf8");
  const lines = text.split("\n");
  const starts = lines.reduce(
    (acc, line, index) => (line.trim() === REGION_START ? [...acc, index] : acc),
    [],
  );
  const ends = lines.reduce(
    (acc, line, index) => (line.trim() === REGION_END ? [...acc, index] : acc),
    [],
  );
  if (starts.length !== 1 || ends.length !== 1) {
    throw new Error(
      `README.md must contain exactly one ${REGION_START} and one ${REGION_END} marker (found ${starts.length} start / ${ends.length} end).`,
    );
  }
  const [startLine] = starts;
  const [endLine] = ends;
  if (endLine <= startLine) {
    throw new Error("README.md snapshot-table region markers are misordered.");
  }
  const next = [
    ...lines.slice(0, startLine + 1),
    regionContent,
    ...lines.slice(endLine),
  ].join("\n");
  fs.writeFileSync(README_PATH, next);
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf8"));
  const generators = loadSnapshotGenerators(pkg);
  const table = renderSnapshotTable(generators);

  const readme = fs.readFileSync(README_PATH, "utf8");
  const regionPattern = new RegExp(
    `${REGION_START.replace(/[/*]/g, "\\$&")}\\n([\\s\\S]*?)\\n\\s*${REGION_END.replace(/[/*]/g, "\\$&")}`,
  );
  const match = readme.match(regionPattern);
  if (!match) {
    throw new Error(
      `README.md is missing the ${REGION_START} / ${REGION_END} generated region.`,
    );
  }
  const current = match[1];

  if (checkOnly) {
    if (current.trim() !== table) {
      console.error(
        "README snapshot-generator table is stale. Regenerate with: npm run readme:snapshot",
      );
      console.error("--- expected (from package.json snapshotGenerators) ---");
      console.error(table);
      console.error("--- found in README ---");
      console.error(current.trim());
      process.exit(1);
    }
    console.log(
      `README snapshot-generator table is in sync (${generators.length} generators).`,
    );
    return;
  }

  applyToReadme(table);
  console.log(
    `README snapshot-generator table regenerated from ${generators.length} package.json snapshotGenerators entries.`,
  );
}

module.exports = {
  REGION_END,
  REGION_START,
  applyToReadme,
  loadSnapshotGenerators,
  main,
  renderSnapshotTable,
};

if (require.main === module) {
  main();
}
