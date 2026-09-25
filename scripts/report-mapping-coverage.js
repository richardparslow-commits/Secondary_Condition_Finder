#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Report — and, with `--write`, persist — how much of the condition catalog has
 * authored secondary-condition mappings.
 *
 *   npm run coverage:ledger            # print the table
 *   npm run coverage:ledger -- --write # refresh docs/mapping-coverage-ledger.json
 *
 * The ledger is one generated artifact, audited by
 * `tests/mapping-coverage-ratchet.test.ts` against the data and against the
 * ratchet floors recorded there. It is deliberately separate from the validator:
 * the validator decides whether the data is legal, this decides how much of the
 * work is done.
 */
const fs = require("fs");
const { computeMappingCoverage } = require("./lib/kb-coverage");

const LEDGER_PATH = "docs/mapping-coverage-ledger.json";
const BASELINE_UNMAPPED = 555;

const coverage = computeMappingCoverage(process.cwd());
const write = process.argv.includes("--write");

const ledger = {
  version: 1,
  generatedBy: "npm run coverage:ledger -- --write",
  description:
    "How much of the condition catalog carries authored secondary-condition mappings. " +
    "'Mapped' means the knowledge-base file holds at least one authored suggestion, whether " +
    "published or still draft; a file without suggestions is researched work not yet done.",
  ratchet: {
    note:
      "Floors. The test fails if coverage drops below these, so a change that removes " +
      "authored work has to argue for itself in the diff instead of passing quietly.",
    withoutSuggestionsMax: BASELINE_UNMAPPED,
    withAuthoredSuggestionsMin: coverage.withAuthoredSuggestions,
  },
  metrics: {
    catalogIdentities: coverage.catalogIdentities,
    withAuthoredSuggestions: coverage.withAuthoredSuggestions,
    publishedWithSuggestions: coverage.published,
    draftWithSuggestions: coverage.draft,
    withoutSuggestions: coverage.withoutSuggestions,
    suggestionEdges: coverage.suggestionEdges,
    catalogIdentitiesWithoutKnowledgeBaseFile: coverage.withoutKnowledgeBaseFile.length,
  },
  bodySystems: coverage.bodySystems,
  withoutSuggestionsIds: coverage.withoutSuggestionsIds,
};

if (coverage.withoutSuggestions > ledger.ratchet.withoutSuggestionsMax) {
  ledger.ratchet.withoutSuggestionsMax = coverage.withoutSuggestions;
  console.log(
    `ratchet: ${coverage.withoutSuggestions} conditions without authored mappings, above the ` +
      `previous ceiling; the new floor is recorded deliberately, in this diff`,
  );
}

if (write) {
  fs.writeFileSync(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`);
  console.log(`wrote ${LEDGER_PATH}`);
}

const rows = [
  ["body system", "catalog", "mapped", "published", "draft", "unmapped"],
  ...coverage.bodySystems.map((s) => [
    s.bodySystem,
    s.catalogIdentities,
    s.withAuthoredSuggestions,
    s.published,
    s.draft,
    s.withoutSuggestions,
  ]),
];
const widths = rows[0].map((_, column) =>
  Math.max(...rows.map((row) => String(row[column]).length)),
);
for (const [index, row] of rows.entries()) {
  console.log(row.map((cell, column) => String(cell).padEnd(widths[column])).join("  "));
  if (index === 0) console.log(widths.map((w) => "-".repeat(w)).join("  "));
}
console.log(
  `\n${coverage.withAuthoredSuggestions} of ${coverage.catalogIdentities} catalog identities ` +
    `carry authored mappings (${coverage.published} published, ${coverage.draft} draft); ` +
    `${coverage.withoutSuggestions} have none. ${coverage.suggestionEdges} relationship edges.`,
);
