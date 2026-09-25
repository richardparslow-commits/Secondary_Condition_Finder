/* eslint-disable @typescript-eslint/no-require-imports */
// Deterministic D1 zero-edge authoring backlog report.
//
// Historically each D1 batch re-derived this filter by hand (and the recorded
// continuity series drifted from any reproducible walk). This script is the
// single definition. A knowledge-base mapping is in the backlog when all four
// hold:
//
//   1. draft          — `draft: true`
//   2. zero-edge      — `suggestions` is empty
//   3. unmarked       — no `governanceNotes` AND every `todo` entry is template
//                       text, i.e. starts with "Author condition-specific" or
//                       "Review ". Todo entries beginning "Rebuild …" or
//                       "Obtain qualified-human …" are prior-disposition or
//                       withdrawal markers, so files carrying them are marked.
//   4. undispositioned — the id appears under no `id`/`conditionId` key at any
//                       depth of the approved-disposition ledgers below.
//
// Deferral records (governance notes / non-template todos) therefore remove an
// identity from the backlog automatically, matching the batch-14 precedent:
// closures live in the knowledge-base files, not in batches' working notes.
//
// The next-five is simply the first five backlog ids alphabetically — the
// catalog walk is alphabetical, so this is the next batch's window.
//
// Usage:
//   node scripts/report-authoring-backlog.js           human-readable report
//   node scripts/report-authoring-backlog.js --json     machine-readable report

const fs = require("fs");
const path = require("path");

const KB_DIR = path.join("data", "knowledge-base");
const DISPOSITION_FILES = [
  path.join("docs", "clinical-mapping-master-2026-approved-disposition.json"),
  path.join("docs", "clinical-mapping-master-resolution-2026-approved-disposition.json"),
];
const TEMPLATE_TODO_PREFIXES = ["Author condition-specific", "Review "];

function collectIds(value, into) {
  if (Array.isArray(value)) {
    for (const item of value) collectIds(item, into);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if ((key === "id" || key === "conditionId") && typeof child === "string") into.add(child);
      collectIds(child, into);
    }
  }
}

function isTemplateTodo(todo) {
  return TEMPLATE_TODO_PREFIXES.some(prefix => todo.startsWith(prefix));
}

function computeBacklog() {
  const dispositioned = new Set();
  for (const file of DISPOSITION_FILES) {
    collectIds(JSON.parse(fs.readFileSync(file, "utf8")), dispositioned);
  }

  const files = fs.readdirSync(KB_DIR).filter(name => name.endsWith(".json")).sort();
  const backlogIds = [];
  let draftMappings = 0;
  let zeroEdgeDrafts = 0;
  let markedZeroEdgeDrafts = 0;
  let unmarkedZeroEdgeDrafts = 0;
  let dispositionedUnmarkedZeroEdgeDrafts = 0;

  for (const name of files) {
    const data = JSON.parse(fs.readFileSync(path.join(KB_DIR, name), "utf8"));
    if (data.draft !== true) continue;
    draftMappings++;
    if ((data.suggestions ?? []).length > 0) continue;
    zeroEdgeDrafts++;

    const todos = data.todo ?? [];
    const unmarked =
      (data.governanceNotes ?? []).length === 0 &&
      todos.length > 0 &&
      todos.every(isTemplateTodo);
    if (!unmarked) {
      markedZeroEdgeDrafts++;
      continue;
    }
    unmarkedZeroEdgeDrafts++;

    if (dispositioned.has(data.id)) {
      dispositionedUnmarkedZeroEdgeDrafts++;
      continue;
    }
    backlogIds.push(data.id);
  }

  backlogIds.sort();
  return {
    knowledgeBaseFiles: files.length,
    draftMappings,
    zeroEdgeDrafts,
    markedZeroEdgeDrafts,
    unmarkedZeroEdgeDrafts,
    dispositionedUnmarkedZeroEdgeDrafts,
    backlogCount: backlogIds.length,
    nextFive: backlogIds.slice(0, 5),
    backlogIds,
  };
}

const report = computeBacklog();

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("D1 zero-edge authoring backlog (deterministic filter)");
  console.log(`  knowledge-base files:                        ${report.knowledgeBaseFiles}`);
  console.log(`  draft mappings:                              ${report.draftMappings}`);
  console.log(`  zero-edge drafts (suggestions: []):          ${report.zeroEdgeDrafts}`);
  console.log(`    marked (deferral/withdrawal records):      ${report.markedZeroEdgeDrafts}`);
  console.log(`    unmarked zero-edge drafts:                 ${report.unmarkedZeroEdgeDrafts}`);
  console.log(`    dispositioned in approved ledgers:         ${report.dispositionedUnmarkedZeroEdgeDrafts}`);
  console.log(`  backlog (undispositioned zero-edge drafts):  ${report.backlogCount}`);
  console.log("");
  console.log("Next five (alphabetical):");
  report.nextFive.forEach((id, index) => console.log(`  ${index + 1}. ${id}`));
}
