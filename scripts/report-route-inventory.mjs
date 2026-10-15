/**
 * Publishes a per-run route inventory report: each route's declared surfaces
 * against the evidence actually recorded for it, as `<out>.json` + `<out>.md`.
 *
 * Usage:
 *   node scripts/report-route-inventory.mjs [--surface=<key>] [--evidence-dir=<dir>]
 *     [--matrix=<file>] [--workbook=<file>] [--out=<base>] [--run-label=<text>]
 *     [--run-id=<text>] [--commit=<sha>] [--json] [--quiet]
 *
 * Surfaces (the keys `scripts/lib/public-routes.mjs` pins):
 *   - contrast        — the R-05 real-browser gate's `a11y-evidence/` (default);
 *   - productionProbe — a saved production route matrix (the workflow's
 *                       `route=status;...` output, or the same data as JSON);
 *   - manualReview    — the Section 508 workbook's human matrix (never fails a
 *                       run: the human surface is awaiting evidence, not a
 *                       machine gate that stopped covering a route).
 *
 * Exit codes: 0 — the report was published and names no coverage problem;
 *             1 — the report was published and names at least one problem (a
 *                 declared route with no recorded evidence, evidence for an
 *                 undeclared route, a claim whose evidence file is absent);
 *             2 — the report could not be produced (bad arguments, unreadable
 *                 input).
 *
 * The report is written before the exit code is decided, so a failing run still
 * leaves the artifact that explains what stopped being covered.
 */

import fs from "node:fs";

import {
  CONTRAST_EVIDENCE_DIR,
  ROUTE_SURFACES,
  buildRouteInventoryReport,
  readContrastEvidence,
  readManualReviewMatrix,
  readProductionMatrix,
  writeRouteInventoryReport,
} from "./lib/route-inventory-report.mjs";

const WORKBOOK = "docs/section508-manual-review-workbook.md";

/** `--name=value` and bare `--flag` arguments, without a parser dependency. */
function parseArguments(argv) {
  const values = new Map();
  const flags = new Set();
  for (const argument of argv) {
    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument "${argument}"`);
    }
    const separator = argument.indexOf("=");
    if (separator === -1) {
      flags.add(argument.slice(2));
      continue;
    }
    values.set(argument.slice(2, separator), argument.slice(separator + 1));
  }
  return { values, flags };
}

function readTextFile(file, label) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error(`${label} was not found at ${file}`);
    }
    throw error;
  }
}

function main() {
  const { values, flags } = parseArguments(process.argv.slice(2));
  const surface = values.get("surface") ?? "contrast";

  if (flags.has("help")) {
    console.log("Publishes a per-run route inventory report. See the module header for usage.");
    return;
  }
  if (!ROUTE_SURFACES.includes(surface)) {
    throw new Error(`Unknown surface "${surface}" (expected one of ${ROUTE_SURFACES.join(", ")})`);
  }

  let read;
  if (surface === "contrast") {
    read = readContrastEvidence({
      directory: values.get("evidence-dir") ?? CONTRAST_EVIDENCE_DIR,
    });
  } else if (surface === "productionProbe") {
    const matrixFile = values.get("matrix");
    if (!matrixFile) {
      throw new Error("--matrix=<file> is required for the productionProbe surface");
    }
    const matrix = readProductionMatrix(readTextFile(matrixFile, "the production route matrix"));
    read = { ...matrix, generatedAt: null, source: matrixFile };
  } else {
    const workbookFile = values.get("workbook") ?? WORKBOOK;
    const matrix = readManualReviewMatrix(readTextFile(workbookFile, "the manual-review workbook"));
    read = { ...matrix, generatedAt: null, source: workbookFile };
  }

  const report = buildRouteInventoryReport({
    surface,
    records: read.records,
    evidenceProblems: read.problems,
    generatedAt: read.generatedAt ?? new Date().toISOString(),
    run: {
      id: values.get("run-id") ?? null,
      label: values.get("run-label") ?? null,
      commit: values.get("commit") ?? null,
    },
  });

  const base = values.get("out") ?? "route-inventory-report";
  const { jsonPath, markdownPath, markdown } = writeRouteInventoryReport({ report, base });

  if (flags.has("json")) {
    console.log(JSON.stringify(report, null, 2));
  } else if (flags.has("quiet")) {
    const { totals } = report;
    console.log(
      `${markdownPath}: ${totals.recorded}/${totals.inSurface} ${surface} route(s) recorded, ` +
        `${totals.missing} missing, ${totals.outOfSurface} out-of-surface, ` +
        `${totals.undeclared} undeclared, ${totals.degraded} degraded, ${report.problems.length} problem(s)`,
    );
  } else {
    console.log(markdown);
  }

  console.log(`Route inventory report: ${jsonPath} and ${markdownPath}`);

  if (report.problems.length > 0) {
    console.error(
      `Route inventory report names ${report.problems.length} coverage problem(s); see ${markdownPath}.`,
    );
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
