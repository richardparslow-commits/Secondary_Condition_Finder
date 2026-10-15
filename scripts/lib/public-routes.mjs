/**
 * The single machine-checked inventory of the application's public routes.
 *
 * Why this module exists: the route set used to be enumerated by hand in four
 * independent places, and every one of them had drifted from `src/app`:
 *
 *   - `docs/section508-manual-review-workbook.md` listed 14 route entries against
 *     26 shipped routes, so a tester following it would have under-covered the
 *     surface issue #195 requires evidence for (the drift and its correction are
 *     recorded in `docs/external-manual-gates-status.md`);
 *   - `tests/accessibility-page-titles.test.ts` named 17 route paths;
 *   - the real-browser contrast and keyboard gate (`e2e/a11y-contrast.mjs`) scans 22;
 *   - the production route matrix in `.github/workflows/production-runtime-readiness.yml`
 *     probes 21.
 *
 * Each list was maintainable on its own, which is exactly why a page added to
 * `src/app` could ship while all four stayed green: the coverage each one claims
 * was not the coverage it had, and nothing in the suite compared any of them to
 * the filesystem. This module removes the copies. `discoverPageRoutes` reads the
 * shipped route set off disk and `manifestProblems` refuses any page that is not
 * declared here, so adding a route forces one *visible* decision — its document
 * title and the file that publishes it, its manual-review row, whether the
 * browser gate scans it, whether production probes it — instead of four silent
 * omissions.
 *
 * Who reads it:
 *   - `tests/public-route-manifest.test.ts` holds the inventory parity and the
 *     consumer parity (workbook matrix, accessibility audit scope, contrast gate,
 *     production matrix);
 *   - `tests/accessibility-page-titles.test.ts` derives its expected titles from
 *     `PUBLIC_ROUTES` and its owner files, and resolves each route's *effective*
 *     title from disk rather than trusting the declaration;
 *   - `e2e/a11y-contrast.mjs` builds its route list from `contrastRoutes()`;
 *   - `.github/workflows/production-runtime-readiness.yml` keeps a bash array
 *     (a workflow cannot import a module), pinned to `productionProbeRoutes()`.
 *
 * What it deliberately does not drive: the PRIV-01 acceptance sentinel. That
 * walk visits workflow steps in order rather than a list of URLs, and its change
 * trigger (`scripts/priv01-sentinel-scope.mjs`) matches repository paths, not
 * route paths, so there is no route list there for this manifest to own. Which
 * of its directories must stay in scope is pinned by
 * `tests/priv01-sentinel-gate-wiring.test.ts`; whether a page outside those
 * patterns holds browser-local veteran context is a per-page decision that gate
 * does not make, and this manifest does not claim it either.
 *
 * Dependency-free (`node:fs` / `node:path` only) and free of side effects on
 * import, so a plain `node` script, a CI step and a vitest suite can all read it.
 */

import fs from "node:fs";
import path from "node:path";

/**
 * A route surface: one of the lists that enumerates routes. Named so importing
 * TypeScript can index an entry by surface without an `any`.
 *
 * @typedef {"manualReview" | "contrast" | "productionProbe"} RouteSurface
 */

/**
 * One shipped route, with the decisions the hand-kept lists used to make
 * separately.
 *
 * @typedef {object} PublicRoute
 * @property {string} path URL path, e.g. `/secondary/evidence`.
 * @property {string} page Repository-relative `page.tsx` that ships it.
 * @property {string} title The document title a browser tab shows.
 * @property {string} titleOwner The file whose metadata publishes that title.
 * @property {string} label Evidence-file label for the contrast gate.
 * @property {boolean} manualReview Listed in the workbook route matrix.
 * @property {boolean} contrast Scanned by the real-browser contrast gate.
 * @property {boolean} productionProbe Probed by the production route matrix.
 * @property {string | null} exclusionReason Why a surface leaves it out.
 */

/** The App Router directory whose `page.tsx` files are the shipped route set. */
export const APP_DIR = "src/app";

/**
 * The root layout. It titles the application shell (and therefore the home
 * route), but it is not a route-group title: a route that inherited from it
 * alone would land in a browser tab reading only the site name, which is the
 * "route title or explicit route-group title" gap the title suite closes.
 */
export const ROOT_LAYOUT = `${APP_DIR}/layout.tsx`;

/**
 * The surfaces that enumerate routes. A route is in each of them unless its
 * entry records why it is not, and `manifestProblems` refuses an exclusion that
 * does not say why.
 *
 * @type {readonly RouteSurface[]}
 */
export const SURFACE_KEYS = Object.freeze(["manualReview", "contrast", "productionProbe"]);

/** True when a directory name is an App Router route group, e.g. `(marketing)`. */
function isRouteGroup(segment) {
  return segment.startsWith("(") && segment.endsWith(")");
}

/**
 * One shipped route, with the decisions the hand-kept lists used to make
 * separately. `titleOwner` defaults to the route's own `page.tsx`, which is the
 * arrangement the title suite requires: a route may inherit its document title
 * from an ancestor layout only where that inheritance is declared, and only the
 * home route may take the root layout's title.
 *
 * @param {string} path
 * @param {object} options
 * @param {string} options.page
 * @param {string} options.title
 * @param {string} [options.titleOwner]
 * @param {string} options.label
 * @param {boolean} [options.manualReview]
 * @param {boolean} [options.contrast]
 * @param {boolean} [options.productionProbe]
 * @param {string | null} [options.exclusionReason]
 * @returns {PublicRoute}
 */
function route(path, {
  page,
  title,
  titleOwner = page,
  label,
  manualReview = true,
  contrast = true,
  productionProbe = true,
  exclusionReason = null,
}) {
  return Object.freeze({
    path,
    page,
    title,
    titleOwner,
    label,
    manualReview,
    contrast,
    productionProbe,
    exclusionReason,
  });
}

/**
 * Every route the application ships, keyed by URL path.
 *
 * `label` is the evidence-file label the real-browser contrast gate writes per
 * route (`a11y-evidence/<label>.json`), so it is stable once recorded.
 *
 * @type {readonly PublicRoute[]}
 */
export const PUBLIC_ROUTES = Object.freeze([
  // Home and top-level content.
  route("/", {
    page: `${APP_DIR}/page.tsx`,
    title: "Secondary Condition Finder",
    titleOwner: ROOT_LAYOUT,
    label: "home",
  }),
  route("/about", {
    page: `${APP_DIR}/about/page.tsx`,
    title: "About | Secondary Condition Finder",
    label: "about",
  }),
  route("/get-records", {
    page: `${APP_DIR}/get-records/page.tsx`,
    title: "Get Your VA Medical Record | Secondary Condition Finder",
    label: "get-records",
  }),
  route("/scenarios", {
    page: `${APP_DIR}/scenarios/page.tsx`,
    title: "Demo Scenarios | Secondary Condition Finder",
    label: "scenarios",
  }),
  route("/pathways", {
    page: `${APP_DIR}/pathways/page.tsx`,
    title: "Claim Pathways | Secondary Condition Finder",
    label: "pathways",
  }),

  // Secondary workflow: the six intake/review steps, the two theory-specific
  // intakes, and the authority reference.
  route("/secondary", {
    page: `${APP_DIR}/secondary/page.tsx`,
    title: "Secondary Workflow | Secondary Condition Finder",
    label: "secondary",
  }),
  route("/secondary/diagnosed", {
    page: `${APP_DIR}/secondary/diagnosed/page.tsx`,
    title: "Diagnosed Conditions | Secondary Condition Finder",
    label: "secondary-diagnosed",
  }),
  route("/secondary/service-connected", {
    page: `${APP_DIR}/secondary/service-connected/page.tsx`,
    title: "Service-Connected Conditions | Secondary Condition Finder",
    label: "secondary-service-connected",
  }),
  route("/secondary/ratings", {
    page: `${APP_DIR}/secondary/ratings/page.tsx`,
    title: "Disability Ratings | Secondary Condition Finder",
    titleOwner: `${APP_DIR}/secondary/ratings/layout.tsx`,
    label: "secondary-ratings",
  }),
  route("/secondary/upload", {
    page: `${APP_DIR}/secondary/upload/page.tsx`,
    title: "Supporting Documents | Secondary Condition Finder",
    label: "secondary-upload",
  }),
  route("/secondary/suggestions", {
    page: `${APP_DIR}/secondary/suggestions/page.tsx`,
    title: "Connection Review | Secondary Condition Finder",
    titleOwner: `${APP_DIR}/secondary/suggestions/layout.tsx`,
    label: "secondary-suggestions",
  }),
  route("/secondary/evidence", {
    page: `${APP_DIR}/secondary/evidence/page.tsx`,
    title: "Evidence & Research Checklist | Secondary Condition Finder",
    titleOwner: `${APP_DIR}/secondary/evidence/layout.tsx`,
    label: "secondary-evidence",
  }),
  route("/secondary/condition-caused-by", {
    page: `${APP_DIR}/secondary/condition-caused-by/page.tsx`,
    title: "Secondary Condition Caused By | VA Secondary Connection Finder",
    label: "secondary-condition-caused-by",
  }),
  route("/secondary/condition-aggravation", {
    page: `${APP_DIR}/secondary/condition-aggravation/page.tsx`,
    title: "Secondary Condition via Aggravation | VA Secondary Connection Finder",
    label: "secondary-condition-aggravation",
  }),
  route("/secondary/legal", {
    page: `${APP_DIR}/secondary/legal/page.tsx`,
    // Inherits the workflow group's title: the reference page ships without a
    // layout of its own, and the declared inheritance is what keeps that visible.
    title: "Secondary Workflow | Secondary Condition Finder",
    titleOwner: `${APP_DIR}/secondary/layout.tsx`,
    label: "secondary-legal",
  }),

  // Legacy route, excluded everywhere: it is a redirect.
  route("/results", {
    page: `${APP_DIR}/results/page.tsx`,
    title: "Secondary Condition Finder",
    titleOwner: ROOT_LAYOUT,
    label: "results",
    manualReview: false,
    contrast: false,
    productionProbe: false,
    exclusionReason:
      "HTTP 307 redirect shim to /secondary. It renders no content of its own, so there is no title, " +
      "markup or layout to check; every consumer targets its destination (/secondary) instead, and the " +
      "workbook records the exclusion in its own table rather than leaving the route unlisted.",
  }),

  // Presumptive track.
  route("/presumptive", {
    page: `${APP_DIR}/presumptive/page.tsx`,
    title: "Presumptive Research | Secondary Condition Finder",
    label: "presumptive",
  }),
  route("/presumptive/results", {
    page: `${APP_DIR}/presumptive/results/page.tsx`,
    title: "Presumptive Research | Secondary Condition Finder",
    titleOwner: `${APP_DIR}/presumptive/layout.tsx`,
    label: "presumptive-results",
  }),

  // VA reference surfaces, the sandbox account, and the policy routes.
  route("/va-forms", {
    page: `${APP_DIR}/va-forms/page.tsx`,
    title: "VA Form Reference | Secondary Condition Finder",
    label: "va-forms",
  }),
  route("/va-forms/finder", {
    page: `${APP_DIR}/va-forms/finder/page.tsx`,
    title: "VA Form Finder | Secondary Condition Finder",
    label: "va-forms-finder",
  }),
  route("/va-reference", {
    page: `${APP_DIR}/va-reference/page.tsx`,
    title: "Disability Reference | Secondary Condition Finder",
    label: "va-reference",
  }),
  route("/va-reference/service-branches", {
    page: `${APP_DIR}/va-reference/service-branches/page.tsx`,
    title: "VA Service Branch Reference | Secondary Condition Finder",
    label: "va-reference-service-branches",
  }),
  route("/va-account", {
    page: `${APP_DIR}/va-account/page.tsx`,
    title: "Sandbox VA Account | Secondary Condition Finder",
    label: "va-account",
  }),
  route("/privacy", {
    page: `${APP_DIR}/privacy/page.tsx`,
    title: "Privacy | Secondary Condition Finder",
    titleOwner: `${APP_DIR}/privacy/layout.tsx`,
    label: "privacy",
  }),
  route("/privacy/request", {
    page: `${APP_DIR}/privacy/request/page.tsx`,
    title: "Privacy Request | Secondary Condition Finder",
    label: "privacy-request",
  }),
  route("/terms", {
    page: `${APP_DIR}/terms/page.tsx`,
    title: "Terms | Secondary Condition Finder",
    label: "terms",
  }),
  route("/runtime-readiness", {
    page: `${APP_DIR}/runtime-readiness/page.tsx`,
    title: "Runtime Readiness | Secondary Condition Finder",
    label: "runtime-readiness",
    productionProbe: false,
    exclusionReason:
      "Production probing is the dedicated \"Verify production runtime readiness\" step, which already " +
      "requests /runtime-readiness and additionally asserts the data-runtime-readiness marker; a route-matrix " +
      "probe would repeat that request without adding a check.",
  }),
]);

/**
 * The shipped route set, read off disk: every `src/app/**\/page.tsx`, its URL path
 * derived the way the App Router derives it (route groups do not appear in the
 * URL; a directory without a page is not a route).
 *
 * `path` is the URL path and `page` is repository-relative, both posix-style, so
 * the two can be compared with manifest entries and handed to a shell script.
 *
 * @param {{ root?: string, appDir?: string }} [options]
 * @returns {{ path: string, page: string }[]}
 */
export function discoverPageRoutes({ root = process.cwd(), appDir = APP_DIR } = {}) {
  const routes = [];

  const walk = (absoluteDir, segments) => {
    const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "page.tsx") {
        const urlSegments = segments.filter((segment) => !isRouteGroup(segment));
        routes.push({
          path: urlSegments.length === 0 ? "/" : `/${urlSegments.join("/")}`,
          page: `${appDir}/${[...segments, entry.name].join("/")}`,
        });
        continue;
      }
      // Symlinked directories are skipped rather than followed: a cycle here
      // would make the discovery walk hang instead of reporting a problem.
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      walk(path.join(absoluteDir, entry.name), [...segments, entry.name]);
    }
  };

  walk(path.join(root, appDir), []);
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * A route's metadata-title candidates, nearest first: its own page, then every
 * ancestor layout up to and including the root layout. The first file in this
 * chain that publishes `title:` is the title a browser tab actually shows, which
 * is why the title suite resolves the owner from disk instead of trusting the
 * manifest's declaration.
 *
 * @param {string} page Repository-relative `page.tsx`.
 * @returns {string[]}
 */
export function titleChain(page) {
  const segments = page.split("/");
  const chain = [page];
  for (let depth = segments.length - 1; depth >= 2; depth -= 1) {
    chain.push([...segments.slice(0, depth), "layout.tsx"].join("/"));
  }
  return chain;
}

/**
 * The `title:` string a file publishes in its metadata, or null.
 *
 * @param {string} file
 * @param {{ root?: string }} [options]
 * @returns {string | null}
 */
export function publishedTitle(file, { root = process.cwd() } = {}) {
  let source;
  try {
    source = fs.readFileSync(path.join(root, file), "utf8");
  } catch {
    return null;
  }
  const match = /title:\s*"([^"]+)"/.exec(source);
  return match ? match[1] : null;
}

/**
 * The nearest published title for a route: `{ owner, title }`, or null.
 *
 * @param {PublicRoute} entry
 * @param {{ root?: string }} [options]
 * @returns {{ owner: string, title: string } | null}
 */
export function effectiveTitle(entry, { root = process.cwd() } = {}) {
  for (const file of titleChain(entry.page)) {
    const title = publishedTitle(file, { root });
    if (title !== null) return { owner: file, title };
  }
  return null;
}

/**
 * Manifest entries that belong to a surface.
 *
 * @param {RouteSurface} surface
 * @returns {PublicRoute[]}
 */
export function routeEntriesFor(surface) {
  if (!SURFACE_KEYS.includes(surface)) {
    throw new Error(`Unknown route surface "${surface}" (expected one of ${SURFACE_KEYS.join(", ")})`);
  }
  return PUBLIC_ROUTES.filter((entry) => entry[surface] === true);
}

/**
 * The real-browser gate's route list: `{ path, label }` per scanned route.
 *
 * @returns {{ path: string, label: string }[]}
 */
export function contrastRoutes() {
  return routeEntriesFor("contrast").map(({ path, label }) => ({ path, label }));
}

/**
 * The production route matrix, as bare URL paths.
 *
 * @returns {string[]}
 */
export function productionProbeRoutes() {
  return routeEntriesFor("productionProbe").map((entry) => entry.path);
}

/**
 * The manual-review workbook's route rows, as bare URL paths.
 *
 * @returns {string[]}
 */
export function manualReviewRoutes() {
  return routeEntriesFor("manualReview").map((entry) => entry.path);
}

/**
 * Everything wrong with a route inventory, as a list of readable problems: empty
 * means the manifest describes exactly what ships and every declaration is
 * complete.
 *
 * `discovered` defaults to the real filesystem, and is a parameter so a test can
 * plant a route the manifest does not declare — the guard has to be provably
 * non-vacuous, not merely green.
 *
 * @param {{ discovered?: { path: string, page: string }[], manifest?: readonly PublicRoute[] }} [options]
 * @returns {string[]}
 */
export function manifestProblems({ discovered, manifest = PUBLIC_ROUTES } = {}) {
  const problems = [];
  const routes = discovered ?? discoverPageRoutes();
  const discoveredPathByPage = new Map(routes.map((route) => [route.page, route.path]));
  const declaredPathByPage = new Map();
  const seenPaths = new Set();
  const seenLabels = new Set();

  for (const entry of manifest) {
    if (seenPaths.has(entry.path)) problems.push(`duplicate manifest entry for ${entry.path}`);
    seenPaths.add(entry.path);

    if (!entry.page) {
      problems.push(`${entry.path} declares no page.tsx`);
    } else if (declaredPathByPage.has(entry.page)) {
      problems.push(
        `${entry.page} is declared by both ${declaredPathByPage.get(entry.page)} and ${entry.path}`,
      );
    } else {
      declaredPathByPage.set(entry.page, entry.path);
      const discoveredPath = discoveredPathByPage.get(entry.page);
      if (discoveredPath && discoveredPath !== entry.path) {
        problems.push(`${entry.path} declares ${entry.page}, which ships at ${discoveredPath}`);
      }
    }

    for (const field of /** @type {const} */ (["title", "titleOwner", "label"])) {
      if (!entry[field]) problems.push(`${entry.path} declares no ${field}`);
    }

    if (entry.label) {
      if (seenLabels.has(entry.label)) problems.push(`duplicate evidence label ${entry.label}`);
      seenLabels.add(entry.label);
    }

    const excludedFromASurface = SURFACE_KEYS.some((surface) => entry[surface] !== true);
    if (excludedFromASurface && !entry.exclusionReason) {
      problems.push(
        `${entry.path} is left out of a surface (${SURFACE_KEYS.filter((surface) => entry[surface] !== true).join(", ")}) without recording why`,
      );
    }
    if (!excludedFromASurface && entry.exclusionReason) {
      problems.push(`${entry.path} records an exclusion reason but participates in every surface`);
    }
  }

  for (const route of routes) {
    if (!declaredPathByPage.has(route.page)) {
      problems.push(
        `${route.path} ships as ${route.page} but is not declared in the public-route manifest`,
      );
    }
  }

  for (const [page, routePath] of declaredPathByPage) {
    if (!discoveredPathByPage.has(page)) {
      problems.push(`manifest entry ${routePath} points at ${page}, which ships no page`);
    }
  }

  return problems;
}
