import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { PUBLIC_ROUTES, contrastRoutes, manualReviewRoutes } from "../scripts/lib/public-routes.mjs";
import {
  ROUTE_SURFACES,
  buildRouteInventoryReport,
  declaredRouteInventory,
  readContrastEvidence,
  readManualReviewMatrix,
  readProductionMatrix,
  renderRouteInventoryReport,
} from "../scripts/lib/route-inventory-report.mjs";

const ROOT = process.cwd();
const CONTRAST_SPEC = "e2e/a11y-contrast.mjs";
const CLI = "scripts/report-route-inventory.mjs";
const CI = ".github/workflows/ci.yml";

const TEMP_DIRS: string[] = [];
function tempDir(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "route-inventory-"));
  TEMP_DIRS.push(directory);
  return directory;
}

afterAll(() => {
  for (const directory of TEMP_DIRS) fs.rmSync(directory, { recursive: true, force: true });
});

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

/** A contrast evidence record shaped like the gate's own summary row. */
function contrastRecord(routePath: string, label: string, overrides: Record<string, unknown> = {}) {
  return {
    surface: "contrast",
    route: routePath,
    label,
    evidenceFile: `a11y-evidence/contrast-${label}.json`,
    evidenceFilePresent: true,
    keyboardSteps: 120,
    keyboardDistinctElements: 40,
    contrastPasses: 30,
    contrastViolations: 0,
    contrastIncomplete: 0,
    ...overrides,
  };
}

/** The shape the readers hand back, as TypeScript sees the JSDoc-typed module. */
type EvidenceRecord = {
  surface?: string;
  route?: string;
  label?: string | null;
  status?: string;
  evidenceFile?: string | null;
  evidenceFilePresent?: boolean;
  keyboardSteps?: number | null;
  keyboardDistinctElements?: number | null;
  keyboardTabbableElements?: number | null;
};

/** One record out of a reader's map, typed for assertions. */
function recordOf(records: Map<string, object>, key: string): EvidenceRecord | undefined {
  return records.get(key) as EvidenceRecord | undefined;
}

/** A complete, healthy contrast run: every declared contrast route recorded. */
function completeContrastRecords() {
  return new Map(
    contrastRoutes().map((entry) => [entry.path, contrastRecord(entry.path, entry.label)]),
  );
}

function contrastReport(records: Map<string, object>) {
  return buildRouteInventoryReport({ surface: "contrast", records });
}

function markdownRoutes(markdown: string): string[] {
  return [...markdown.matchAll(/^\| `(\/[A-Za-z0-9\-/]*)` \|/gm)].map((match) => match[1]);
}

/**
 * The per-run route inventory report.
 *
 * `scripts/lib/public-routes.mjs` made route coverage *declarable*; this module
 * is what makes the difference between a declaration and a record *reportable*.
 * The failure this suite exists to prevent is exactly the one the manifest
 * cannot see: a gate that keeps declaring a route while quietly stopping
 * producing evidence for it — a route the loop skipped, a summary row whose
 * evidence file was never written, a keyboard walk that recorded no advancement,
 * or a run that records evidence for a page the manifest no longer declares.
 *
 * So the assertions come in two halves, the same shape the manifest's own suite
 * uses: the reconciliation itself (with planted gaps, an undeclared route, a
 * claimed-but-absent evidence file, and the human-gated surface that must NOT
 * fail a machine run), and the wiring that publishes it per run — the gate that
 * writes it, the CLI that produces it for a saved matrix, and CI that surfaces
 * it in the run summary next to the artifact.
 */
describe("per-run route inventory report", () => {
  it("declares each route's surfaces from the manifest rather than a copy", () => {
    const declared = declaredRouteInventory();
    expect(declared.length).toBe(PUBLIC_ROUTES.length);
    for (const row of declared) {
      expect(Object.keys(row.surfaces).sort()).toEqual([...ROUTE_SURFACES].sort());
      for (const surface of ROUTE_SURFACES) expect(typeof row.surfaces[surface]).toBe("boolean");
    }
    const contrastDeclared = declared.filter((row) => row.surfaces.contrast).map((row) => row.path);
    expect([...contrastDeclared].sort()).toEqual(contrastRoutes().map((entry) => entry.path).sort());
  });

  it("accepts a healthy run: every declared route recorded, nothing degraded", () => {
    const report = contrastReport(completeContrastRecords());
    expect(report.problems).toEqual([]);
    expect(report.degraded).toEqual([]);
    expect(report.totals.recorded).toBe(report.totals.inSurface);
    expect(report.totals.missing).toBe(0);
    // The report is the run's inventory, so the published table carries a row
    // for every declared route — including the ones a surface leaves out.
    const markdown = renderRouteInventoryReport(report);
    expect(markdownRoutes(markdown).sort()).toEqual(PUBLIC_ROUTES.map((entry) => entry.path).sort());
    expect(markdown).toContain("None: every route this surface declares has evidence recorded for it in this run.");
  });

  it("names a declared route the run recorded no evidence for", () => {
    const records = completeContrastRecords();
    records.delete("/about");
    const report = contrastReport(records);
    expect(report.totals.missing).toBe(1);
    expect(report.problems).toContainEqual(
      expect.stringContaining("/about: declared for the contrast surface but this run recorded no evidence for it"),
    );
    const markdown = renderRouteInventoryReport(report);
    const row = markdown.split("\n").find((line) => line.startsWith("| `/about` |"));
    expect(row).toContain("| missing |");
    expect(markdown).toContain("## Problems (1)");
  });

  it("names evidence recorded for a route the manifest does not declare", () => {
    const records = completeContrastRecords();
    records.set("/ghost", contrastRecord("/ghost", "ghost"));
    const report = contrastReport(records);
    expect(report.totals.undeclared).toBe(1);
    expect(report.problems).toContainEqual(
      expect.stringContaining("/ghost: this run recorded contrast evidence for a route the manifest does not declare"),
    );
    expect(renderRouteInventoryReport(report)).toContain("Recorded evidence with no declared route");
  });

  it("refuses evidence for a route its own surface leaves out", () => {
    // /results is the manifest's declared contrast exclusion (a 307 shim): a run
    // that scanned it anyway is covering a route the surface says it does not.
    const records = completeContrastRecords();
    records.set("/results", contrastRecord("/results", "results"));
    const report = contrastReport(records);
    expect(report.totals.outOfSurface).toBe(1);
    expect(report.problems).toContainEqual(
      expect.stringContaining("/results: the manifest leaves it out of the contrast surface"),
    );
  });

  it("fails the keyboard walk that recorded no coverage at all", () => {
    const records = completeContrastRecords();
    records.set("/terms", contrastRecord("/terms", "terms", { keyboardSteps: 0, keyboardDistinctElements: 0 }));
    const report = contrastReport(records);
    expect(report.problems).toContainEqual(
      expect.stringContaining("/terms: the contrast gate recorded no keyboard walk"),
    );
  });

  it("reports a single-tabbable route as degraded, not as a missing walk", () => {
    // A page whose only tabbable element is the one the walk focuses records
    // 0 steps: the first Tab leaves the document, so the loop ends immediately.
    // That is recorded evidence of one target, not an empty probe — CI failed
    // /secondary/evidence on this and the run had walked the route.
    const records = completeContrastRecords();
    records.set(
      "/about",
      contrastRecord("/about", "about", {
        keyboardSteps: 0,
        keyboardDistinctElements: 1,
        keyboardTabbableElements: 1,
      }),
    );
    const report = contrastReport(records);
    expect(report.problems).toEqual([]);
    expect(report.degraded.join("\n")).toContain(
      "/about: the keyboard walk pressed Tab but focus never reached a second element (distinct=1)",
    );
  });

  it("fails a summary row that carries no keyboard result at all", () => {
    const records = completeContrastRecords();
    records.set("/terms", contrastRecord("/terms", "terms", { keyboardSteps: null, keyboardDistinctElements: null }));
    const report = contrastReport(records);
    expect(report.problems).toContainEqual(
      expect.stringContaining("/terms: the recorded contrast evidence carries no keyboard walk result"),
    );
  });

  it("reports hollow evidence as degraded rather than hiding it", () => {
    const records = completeContrastRecords();
    records.set("/about", contrastRecord("/about", "about", { keyboardDistinctElements: 1 }));
    records.set("/terms", contrastRecord("/terms", "terms", { contrastIncomplete: 3 }));
    const report = contrastReport(records);
    // Reported, and the run still fails if a violation is recorded — but a walk
    // that never moved and non-blocking incomplete nodes do not fail it.
    expect(report.problems).toEqual([]);
    expect(report.totals.degraded).toBe(2);
    expect(report.degraded.join("\n")).toContain("focus never reached a second element (distinct=1)");
    expect(report.degraded.join("\n")).toContain("3 incomplete node(s)");
  });

  it("fails recorded contrast violations", () => {
    const records = completeContrastRecords();
    records.set("/about", contrastRecord("/about", "about", { contrastViolations: 2 }));
    expect(contrastReport(records).problems).toContainEqual(
      expect.stringContaining("/about: axe reported 2 contrast violation(s)"),
    );
  });

  it("fails a production probe that did not answer 200", () => {
    const records = new Map([
      ["/", { surface: "productionProbe", route: "/", status: "200" }],
      ["/about", { surface: "productionProbe", route: "/about", status: "503" }],
    ]);
    const report = buildRouteInventoryReport({ surface: "productionProbe", records });
    expect(report.problems).toContainEqual(expect.stringContaining("/about: the production probe recorded HTTP 503"));
    // And every production route the matrix never reached is named too: the two
    // rows above are the run's whole record.
    expect(report.totals.missing).toBe(report.totals.inSurface - 2);
  });

  it("reports the human-gated manual review as awaiting evidence, never as a gap", () => {
    const empty = buildRouteInventoryReport({ surface: "manualReview", records: new Map() });
    expect(empty.problems).toEqual([]);
    expect(empty.totals.missing).toBe(0);
    expect(empty.totals.recorded).toBe(0);
    expect(empty.totals.awaitingHuman).toBe(manualReviewRoutes().length);
    expect(renderRouteInventoryReport(empty)).toContain("Human-gated rows awaiting evidence");

    // And a matrix row that exists but is still blank is the human gate waiting,
    // not evidence: it must not be counted as recorded coverage.
    const blank = new Map(
      manualReviewRoutes().map((routePath) => [
        routePath,
        { surface: "manualReview", route: routePath, status: "not-tested" },
      ]),
    );
    const untested = buildRouteInventoryReport({ surface: "manualReview", records: blank });
    expect(untested.problems).toEqual([]);
    expect(untested.totals.recorded).toBe(0);
    expect(untested.totals.awaitingHuman).toBe(manualReviewRoutes().length);

    // A ticked row is the one thing that moves the count.
    const ticked = new Map(blank);
    ticked.set("/about", { surface: "manualReview", route: "/about", status: "tested" });
    const partial = buildRouteInventoryReport({ surface: "manualReview", records: ticked });
    expect(partial.totals.recorded).toBe(1);
    expect(partial.totals.awaitingHuman).toBe(manualReviewRoutes().length - 1);
  });

  it("rejects an unknown surface instead of reporting on nothing", () => {
    expect(() => buildRouteInventoryReport({ surface: "nope", records: new Map() })).toThrow(
      /Unknown route surface "nope"/,
    );
  });

  describe("reading this run's evidence off disk", () => {
    it("attributes each summary row and checks the file it names is really there", () => {
      const directory = tempDir();
      const present = path.join(directory, "contrast-home.json");
      fs.writeFileSync(present, "{}", "utf8");
      fs.writeFileSync(
        path.join(directory, "summary.json"),
        JSON.stringify({
          generatedAt: "2026-10-15T00:00:00.000Z",
          routes: [
            {
              route: "/",
              label: "home",
              keyboardSteps: 120,
              keyboardDistinctElements: 40,
              contrastViolations: 0,
              contrastIncomplete: 1,
              evidenceFile: present,
            },
            {
              route: "/about",
              label: "about",
              keyboardSteps: 12,
              keyboardDistinctElements: 5,
              keyboardTabbableElements: 4,
              contrastViolations: 0,
              contrastIncomplete: 0,
              evidenceFile: path.join(directory, "contrast-about.json"),
            },
          ],
        }),
        "utf8",
      );

      const read = readContrastEvidence({ directory });
      expect(read.source).toBe("summary");
      expect(read.generatedAt).toBe("2026-10-15T00:00:00.000Z");
      expect([...read.records.keys()].sort()).toEqual(["/", "/about"]);
      expect(recordOf(read.records, "/")?.evidenceFilePresent).toBe(true);
      // The empty-probe rule keys on this count; dropping it from the reader
      // made every zero-step record look like a route with nothing to focus.
      expect(recordOf(read.records, "/about")?.keyboardTabbableElements).toBe(4);
      // The claim without the file is the failure this reader exists to catch.
      expect(recordOf(read.records, "/about")?.evidenceFilePresent).toBe(false);
      expect(read.problems).toContainEqual(
        expect.stringContaining("records evidence for /about but"),
      );
      expect(read.problems).toContainEqual(expect.stringContaining("is not on disk"));
    });

    it("distinguishes a missing summary from an unreadable one", () => {
      const empty = tempDir();
      const missing = readContrastEvidence({ directory: empty });
      expect(missing.source).toBe("missing");
      expect(missing.records.size).toBe(0);
      expect(missing.problems).toContainEqual(expect.stringContaining("no contrast evidence recorded"));

      const broken = tempDir();
      fs.writeFileSync(path.join(broken, "summary.json"), "{ not json", "utf8");
      const unreadable = readContrastEvidence({ directory: broken });
      expect(unreadable.source).toBe("unreadable");
      expect(unreadable.problems).toContainEqual(expect.stringContaining("is not valid JSON"));
    });

    it("reports a summary row that cannot be attributed rather than skipping it", () => {
      const directory = tempDir();
      fs.writeFileSync(
        path.join(directory, "summary.json"),
        JSON.stringify({ routes: [{ label: "home", evidenceFile: "a11y-evidence/contrast-home.json" }] }),
        "utf8",
      );
      const read = readContrastEvidence({ directory });
      expect(read.records.size).toBe(0);
      expect(read.problems).toContainEqual(expect.stringContaining("summary row with no route path"));
    });

    it("reads the production matrix in the workflow's own string shape and as JSON", () => {
      const fromString = readProductionMatrix("/=/200;/about=200;/terms=500;");
      expect([...fromString.records.keys()]).toEqual(["/", "/about", "/terms"]);
      expect(recordOf(fromString.records, "/terms")?.status).toBe("500");

      const fromJson = readProductionMatrix(JSON.stringify({ "/": "200", "/about": "200" }));
      expect([...fromJson.records.keys()]).toEqual(["/", "/about"]);

      expect(readProductionMatrix("").problems).toContainEqual(
        expect.stringContaining("the production route matrix is empty"),
      );
      expect(readProductionMatrix("[]").records.size).toBe(0);
      expect(readProductionMatrix("not json but not empty either").problems).toEqual([]);
    });

    it("reads the workbook's human matrix ticks", () => {
      const workbook = read("docs/section508-manual-review-workbook.md");
      const matrix = readManualReviewMatrix(workbook);
      // Every reviewed route has a row, and the whole matrix is in its
      // documented default state: untested, because no human has run it.
      for (const routePath of manualReviewRoutes()) {
        expect(recordOf(matrix.records, routePath)?.status, `${routePath} is missing from the matrix`).toBe(
          "not-tested",
        );
      }
      expect(matrix.problems).toEqual([]);
      // A route with several workbook rows is one route: tested once any of them
      // is ticked, not reported as a duplicate row.
      expect(matrix.records.size).toBe(manualReviewRoutes().length);

      const ticked = readManualReviewMatrix(
        "| Route / workflow | Tested | Notes |\n| `/about` | [x] | done |\n| `/terms` | [ ] | |",
      );
      expect(recordOf(ticked.records, "/about")?.status).toBe("tested");
      expect(recordOf(ticked.records, "/terms")?.status).toBe("not-tested");
    });
  });

  describe("the published artifact", () => {
    function runCli(args: string[]) {
      return spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: "utf8" });
    }

    /** A complete on-disk contrast run: summary rows plus the files they name. */
    function writeContrastFixture(directory: string, { omit } = { omit: [] as string[] }) {
      const routes = contrastRoutes().filter((entry) => !omit.includes(entry.path));
      const summary = {
        generatedAt: "2026-10-15T00:00:00.000Z",
        routes: routes.map((entry) => {
          const evidenceFile = path.join(directory, `contrast-${entry.label}.json`);
          fs.writeFileSync(evidenceFile, JSON.stringify({ passes: 1, violations: [], incomplete: 0 }), "utf8");
          return {
            route: entry.path,
            label: entry.label,
            contrastPasses: 20,
            contrastViolations: 0,
            contrastIncomplete: 0,
            keyboardSteps: 120,
            keyboardDistinctElements: 40,
            evidenceFile,
          };
        }),
      };
      fs.writeFileSync(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
    }

    it("publishes the JSON and markdown pair, and exits 0 on a covered run", () => {
      const directory = tempDir();
      writeContrastFixture(directory);
      const out = path.join(directory, "report");
      const result = runCli(["--surface=contrast", `--evidence-dir=${directory}`, `--out=${out}`, "--quiet"]);

      expect(result.status).toBe(0);
      expect(fs.existsSync(`${out}.json`)).toBe(true);
      expect(fs.existsSync(`${out}.md`)).toBe(true);
      const report = JSON.parse(fs.readFileSync(`${out}.json`, "utf8"));
      expect(report.totals.recorded).toBe(report.totals.inSurface);
      expect(report.problems).toEqual([]);
      expect(result.stdout).toContain(`${contrastRoutes().length}/${contrastRoutes().length} contrast route(s) recorded`);
    });

    it("still publishes the report on a gap, and exits 1 naming the route", () => {
      const directory = tempDir();
      writeContrastFixture(directory, { omit: ["/about"] });
      const out = path.join(directory, "report");
      const result = runCli(["--surface=contrast", `--evidence-dir=${directory}`, `--out=${out}`]);

      expect(result.status).toBe(1);
      const markdown = fs.readFileSync(`${out}.md`, "utf8");
      expect(markdown).toContain("| `/about` |");
      expect(markdown).toContain("missing");
      expect(result.stderr).toContain("coverage problem(s)");
      // The whole table is in the log, not just the failing row.
      expect(result.stdout).toContain("Declared routes:");
    });

    it("refuses an unknown surface and a missing matrix without publishing a half report", () => {
      const directory = tempDir();
      const out = path.join(directory, "report");
      const unknown = runCli(["--surface=nope", `--out=${out}`]);
      expect(unknown.status).toBe(2);
      expect(unknown.stderr).toContain("Unknown surface");
      expect(fs.existsSync(`${out}.json`)).toBe(false);

      const noMatrix = runCli(["--surface=productionProbe", `--out=${out}`]);
      expect(noMatrix.status).toBe(2);
      expect(noMatrix.stderr).toContain("--matrix=<file> is required");
    });

    it("publishes a production-surface report from a saved matrix", () => {
      const directory = tempDir();
      const matrixFile = path.join(directory, "matrix.txt");
      const statuses = PUBLIC_ROUTES.filter((entry) => entry.productionProbe)
        .map((entry) => `${entry.path}=200`)
        .join(";");
      fs.writeFileSync(matrixFile, statuses, "utf8");
      const out = path.join(directory, "report");
      const result = runCli(["--surface=productionProbe", `--matrix=${matrixFile}`, `--out=${out}`, "--quiet"]);

      expect(result.status).toBe(0);
      const report = JSON.parse(fs.readFileSync(`${out}.json`, "utf8"));
      expect(report.totals.recorded).toBe(report.totals.inSurface);
      // /runtime-readiness and /results are the declared production exclusions.
      expect(report.totals.missing).toBe(0);
      expect(report.totals.notInSurface).toBe(2);
    });
  });

  describe("per-run wiring", () => {
    it("has the R-05 gate publish the report for its own surface", () => {
      const spec = read(CONTRAST_SPEC);
      expect(spec).toContain("route-inventory-report.mjs");
      expect(spec).toContain("readContrastEvidence({ directory: EVIDENCE_DIR })");
      expect(spec).toContain('surface: "contrast"');
      expect(spec).toContain("route-inventory-report");
      // A gap must fail the gate: publishing a report nobody acts on would leave
      // the silent coverage loss exactly as invisible as before.
      expect(spec).toContain("report.problems.length > 0");
    });

    it("keeps the report discoverable in CI next to the uploaded evidence", () => {
      const ci = read(CI);
      // The report lives in a11y-evidence/, which the diagnostics artifact
      // already uploads — so it rides the run's evidence without a new path.
      expect(ci).toContain("a11y-evidence/");
      expect(ci).toContain("a11y-evidence/route-inventory-report.md");
      expect(ci).toContain("Per-run route inventory (R-05 contrast surface)");
      expect(ci).toContain("$GITHUB_STEP_SUMMARY");
      // The gate's own step still runs the gate and still fails the step on a
      // failing gate, so publishing the report cannot swallow the exit code.
      const step = ci.slice(ci.indexOf("Run real-browser contrast and keyboard gate (R-05)"));
      const block = step.slice(0, step.indexOf("continue-on-error"));
      expect(block).toContain("node e2e/a11y-contrast.mjs 2>&1 | tee ci-a11y-contrast.log");
      expect(block).toContain('exit "$status"');
    });

    it("is runnable as a script for a saved matrix", () => {
      const pkg = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
      expect(pkg.scripts?.["report:route-inventory"]).toBe("node scripts/report-route-inventory.mjs");
    });
  });
});
