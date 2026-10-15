import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  PUBLIC_ROUTES,
  SURFACE_KEYS,
  contrastRoutes,
  discoverPageRoutes,
  manifestProblems,
  manualReviewRoutes,
  productionProbeRoutes,
} from "../scripts/lib/public-routes.mjs";

/** The union the manifest module owns, read off its own key list. */
type RouteSurface = (typeof SURFACE_KEYS)[number];

const WORKBOOK = "docs/section508-manual-review-workbook.md";
const AUDIT = "docs/accessibility-audit.md";
const CONTRAST_SPEC = "e2e/a11y-contrast.mjs";
const TITLE_SUITE = "tests/accessibility-page-titles.test.ts";
const PRODUCTION_WORKFLOW = ".github/workflows/production-runtime-readiness.yml";
const MANIFEST_MODULE = "scripts/lib/public-routes.mjs";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function sectionBetween(source: string, startHeading: string, endHeading: string): string {
  const start = source.indexOf(startHeading);
  expect(start, `${startHeading} is missing`).toBeGreaterThan(-1);
  const end = source.indexOf(endHeading, start + startHeading.length);
  expect(end, `${endHeading} was not found after ${startHeading}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

/**
 * Rows of a markdown table, as trimmed cells. The header and its divider row
 * are dropped, so a table's rows are only its data.
 */
function tableRows(section: string): string[][] {
  const rows = section
    .split("\n")
    .filter((line) => line.trimStart().startsWith("|"))
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    );
  const divider = rows.findIndex(
    (cells) => cells.length > 1 && cells.every((cell) => /^:?-{2,}:?$/.test(cell)),
  );
  return divider === -1 ? rows : rows.slice(divider + 1);
}

/** Backticked URL paths in a stretch of prose, e.g. "`/secondary/upload`". */
function routeTokens(text: string): string[] {
  return [...text.matchAll(/`(\/[A-Za-z0-9\-/]*)`/g)].map((match) => match[1]);
}

/** The quoted entries of a bash array such as the production route matrix. */
function bashArrayEntries(source: string, marker: string): string[] {
  const start = source.indexOf(marker);
  expect(start, `${marker} is missing`).toBeGreaterThan(-1);
  const entries: string[] = [];
  for (const line of source.slice(start).split("\n").slice(1)) {
    if (line.trim() === ")") break;
    const quoted = /"([^"]+)"/.exec(line);
    if (quoted) entries.push(quoted[1]);
  }
  return entries;
}

const SHIPPED_PATHS = PUBLIC_ROUTES.map((entry) => entry.path);

/** The routes a surface's declarations leave out. */
function leftOutOf(surface: RouteSurface): string[] {
  return PUBLIC_ROUTES.filter((entry) => entry[surface] !== true).map((entry) => entry.path);
}

// Each surface can leave out a different route, so the exclusions are computed
// per surface rather than pooled: `/runtime-readiness` is scanned by the browser
// gate but probed by its own readiness step instead of the route matrix, and
// `/results` is left out of all three.

/** A well-formed entry for a page that does not ship, used to prove non-vacuity. */
function ghostRoute(overrides: Record<string, unknown> = {}) {
  return {
    path: "/ghost",
    page: "src/app/ghost/page.tsx",
    title: "Ghost | Secondary Condition Finder",
    titleOwner: "src/app/ghost/page.tsx",
    label: "ghost",
    manualReview: true,
    contrast: true,
    productionProbe: true,
    exclusionReason: null,
    ...overrides,
  };
}

function entryFor(routePath: string) {
  const entry = PUBLIC_ROUTES.find((candidate) => candidate.path === routePath);
  expect(entry, `the manifest does not declare ${routePath}`).toBeDefined();
  return entry!;
}

/**
 * One machine-checked manifest of the app's public routes.
 *
 * The failure this suite exists to prevent is not a wrong route in a list, it is
 * a *missing* one: the workbook, the title suite, the real-browser gate and the
 * production matrix each held their own copy of the route set, and each had
 * drifted from `src/app` (14 of 26 workbook rows, 17 titled routes, 22 scanned
 * routes, 21 probed routes). A page could ship while every list stayed green.
 *
 * So the assertions come in two halves:
 *
 *   1. inventory parity — the shipped route set, derived from disk, is exactly
 *      the declared set, and every declaration is complete;
 *   2. consumer parity — each of those four lists is *driven by* the manifest or
 *      checked against it, so a new page cannot be absent from all of them.
 *
 * The non-vacuity tests at the end plant a route that is not declared, a
 * manifest entry with no page behind it, and an undocumented exclusion: a guard
 * that cannot fail is not a guard.
 */
describe("public-route manifest", () => {
  it("declares exactly the pages that ship under src/app", () => {
    expect(manifestProblems()).toEqual([]);
  });

  it("derives the shipped route set from page files rather than from a list", () => {
    const discovered = discoverPageRoutes();
    expect(discovered.length).toBe(PUBLIC_ROUTES.length);
    expect(discovered.map((entry) => entry.path)).toEqual([...SHIPPED_PATHS].sort());
    // The route set is the App Router's, not a directory listing: `page.tsx` is
    // the only file that makes a route, and every route ships one.
    for (const entry of discovered) {
      expect(entry.page.endsWith("/page.tsx")).toBe(true);
      expect(fs.existsSync(path.join(process.cwd(), entry.page))).toBe(true);
    }
  });

  it("gives every route one evidence label and one title owner", () => {
    const labels = PUBLIC_ROUTES.map((entry) => entry.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    for (const entry of PUBLIC_ROUTES) {
      expect(entry.title.trim(), `${entry.path} has an empty title`).not.toBe("");
      expect(fs.existsSync(path.join(process.cwd(), entry.titleOwner))).toBe(true);
    }
  });

  it("records a reason for every route a surface leaves out", () => {
    for (const entry of PUBLIC_ROUTES) {
      const leftOut = SURFACE_KEYS.filter((surface) => entry[surface] !== true);
      if (leftOut.length === 0) {
        expect(entry.exclusionReason, `${entry.path} is in every surface`).toBeNull();
        continue;
      }
      expect(entry.exclusionReason, `${entry.path} is out of ${leftOut.join(", ")}`).toBeTruthy();
      expect(entry.exclusionReason!.length).toBeGreaterThan(40);
    }
  });

  describe("manual-review inventory", () => {
    const workbook = read(WORKBOOK);
    const coverageSection = sectionBetween(
      workbook,
      "## Required route and workflow coverage",
      "### Routes excluded from manual review",
    );
    const exclusionSection = sectionBetween(
      workbook,
      "### Routes excluded from manual review",
      "### Keeping this matrix current",
    );

    it("lists every reviewed route in the workbook matrix, and nothing else", () => {
      expect(coverageSection).toContain("| Route / workflow | Tested |");
      const rows = tableRows(coverageSection);
      const listed = new Set(rows.flatMap((cells) => routeTokens(cells[0])));
      expect([...listed].sort()).toEqual([...manualReviewRoutes()].sort());
      // Rows that are not a route (a workflow step, the footer disclaimer) are
      // allowed and expected: the matrix covers workflows, not only URLs.
      expect(rows.length).toBeGreaterThanOrEqual(listed.size);
    });

    it("keeps every matrix row in the not-yet-tested default state", () => {
      for (const cells of tableRows(coverageSection)) {
        expect(cells[1], `row "${cells[0]}" carries a result`).toBe("[ ]");
      }
    });

    it("records each route left out of the review, with a reason", () => {
      expect(exclusionSection).toContain("| Route | Reason for exclusion |");
      const rows = tableRows(exclusionSection);
      const excluded = rows.map((cells) => routeTokens(cells[0])[0]);
      expect([...excluded].sort()).toEqual([...leftOutOf("manualReview")].sort());
      for (const cells of rows) {
        expect(cells[1].length, `"${cells[0]}" records no reason`).toBeGreaterThan(40);
        // The reason has to be the real one, not a placeholder.
        expect(cells[1]).toMatch(/redirect|307/i);
      }
    });

    it("points the tester at the machine-checked inventory instead of a hand-kept count", () => {
      const currency = workbook.slice(workbook.indexOf("### Keeping this matrix current"));
      expect(currency).toContain(MANIFEST_MODULE);
      expect(currency).toContain("tests/public-route-manifest.test.ts");
      expect(coverageSection).toContain(MANIFEST_MODULE);
    });

    it("keeps the accessibility audit's scope section the same route set", () => {
      const auditScope = sectionBetween(
        read(AUDIT),
        "## Required manual route and workflow scope",
        "## Evidence matrix",
      );
      const auditScopeTokens = new Set(routeTokens(auditScope));
      const allowed = new Set([...manualReviewRoutes(), ...leftOutOf("manualReview")]);
      expect([...routeTokens(auditScope)].filter((token) => !allowed.has(token))).toEqual([]);
      expect(manualReviewRoutes().filter((routePath) => !auditScopeTokens.has(routePath))).toEqual([]);
      expect(auditScope).toContain(MANIFEST_MODULE);
    });
  });

  describe("real-browser contrast and keyboard gate", () => {
    it("builds its route list from the manifest instead of a copy", () => {
      const spec = read(CONTRAST_SPEC);
      expect(spec).toContain(MANIFEST_MODULE);
      expect(spec).toContain("contrastRoutes()");
      // A hand-kept `{ path: ..., label: ... }` list is what drifted before.
      expect(spec).not.toMatch(/const ROUTES = \[\s*\n\s*\{ path: "/);
    });

    it("scans every reviewed route, so none can be missing from the scan", () => {
      const scanned = contrastRoutes().map((entry) => entry.path);
      expect([...scanned].sort()).toEqual(
        SHIPPED_PATHS.filter((routePath) => !leftOutOf("contrast").includes(routePath)).sort(),
      );
      expect(scanned.length).toBeGreaterThanOrEqual(26);
    });

    it("labels each scanned route for its evidence artifact", () => {
      for (const entry of contrastRoutes()) {
        expect(entry.label).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(entry.label).not.toContain("/");
      }
    });

    it("keeps the title suite reading the same inventory", () => {
      expect(read(TITLE_SUITE)).toContain(MANIFEST_MODULE);
    });
  });

  describe("production route matrix", () => {
    it("probes exactly the routes the manifest marks for production", () => {
      const probed = bashArrayEntries(read(PRODUCTION_WORKFLOW), "routes=(");
      expect([...probed].sort()).toEqual([...productionProbeRoutes()].sort());
      expect([...productionProbeRoutes()].sort()).toEqual(
        SHIPPED_PATHS.filter((routePath) => !leftOutOf("productionProbe").includes(routePath)).sort(),
      );
    });
  });

  describe("non-vacuity", () => {
    it("fails a page that ships without a manifest entry", () => {
      const problems = manifestProblems({
        discovered: [
          ...discoverPageRoutes(),
          { path: "/not-declared", page: "src/app/not-declared/page.tsx" },
        ],
      });
      expect(problems).toContainEqual(
        expect.stringContaining(
          "/not-declared ships as src/app/not-declared/page.tsx but is not declared",
        ),
      );
    });

    it("fails a manifest entry with no page behind it", () => {
      const problems = manifestProblems({ manifest: [...PUBLIC_ROUTES, ghostRoute()] });
      expect(problems).toContainEqual(
        expect.stringContaining("/ghost points at src/app/ghost/page.tsx, which ships no page"),
      );
    });

    it("fails a declaration whose path is not the path that page ships at", () => {
      const moved = { ...entryFor("/about"), path: "/about-us" };
      const problems = manifestProblems({
        manifest: [...PUBLIC_ROUTES.filter((entry) => entry.path !== "/about"), moved],
      });
      expect(problems).toContainEqual(
        expect.stringContaining("/about-us declares src/app/about/page.tsx, which ships at /about"),
      );
    });

    it("fails an exclusion nobody explained, and an explanation nobody needed", () => {
      const silent = { ...entryFor("/about"), contrast: false };
      expect(
        manifestProblems({
          manifest: [...PUBLIC_ROUTES.filter((entry) => entry.path !== "/about"), silent],
        }),
      ).toContainEqual(
        expect.stringContaining("/about is left out of a surface (contrast) without recording why"),
      );

      const overExplained = { ...entryFor("/about"), exclusionReason: "no reason at all" };
      expect(
        manifestProblems({
          manifest: [...PUBLIC_ROUTES.filter((entry) => entry.path !== "/about"), overExplained],
        }),
      ).toContainEqual(
        expect.stringContaining("/about records an exclusion reason but participates in every surface"),
      );
    });

    it("fails duplicate paths, duplicate labels and duplicated pages", () => {
      expect(
        manifestProblems({ manifest: [...PUBLIC_ROUTES, entryFor("/about")] }),
      ).toContainEqual(expect.stringContaining("duplicate manifest entry for /about"));
      expect(
        manifestProblems({ manifest: [...PUBLIC_ROUTES, ghostRoute({ label: "home" })] }),
      ).toContainEqual(expect.stringContaining("duplicate evidence label home"));
      expect(
        manifestProblems({
          manifest: [...PUBLIC_ROUTES, ghostRoute({ page: "src/app/about/page.tsx" })],
        }),
      ).toContainEqual(
        expect.stringContaining(
          "src/app/about/page.tsx is declared by both /about and /ghost",
        ),
      );
    });
  });
});
