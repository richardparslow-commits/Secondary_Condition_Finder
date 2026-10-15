/**
 * Per-run route inventory report: a route's *declared* surfaces against the
 * evidence a gate *actually recorded* for it.
 *
 * Why this module exists: `scripts/lib/public-routes.mjs` made the route set
 * machine-checked, so a page can no longer ship without a visible decision about
 * which surfaces cover it. What that guard cannot see is whether a gate that
 * *declares* a route quietly stopped producing evidence for it. The failure
 * shapes are all real and all silent:
 *
 *   - a route is declared for a surface and this run recorded nothing for it
 *     (the gate's loop skipped it, a write failed, or the summary was never
 *     rewritten);
 *   - the summary *claims* evidence but the file it names is not on disk;
 *   - the contrast gate records a route it audited but its keyboard walk never
 *     got a tabbable element, so keyboard coverage for that route stopped
 *     without any assertion noticing;
 *   - a run records evidence for a route the manifest does not declare (a
 *     removed page, or a stale artifact from an earlier run).
 *
 * The manifest made coverage *declarable*; this module makes the difference
 * between the declaration and the record *reportable*, per run, for both the
 * published artifact and the gate that consumes it. A gate fails when a route it
 * declares has no recorded evidence — that is the "silently stops covering a
 * route" case — while honest-but-weak evidence (a keyboard walk that recorded no
 * advancement, axe `incomplete` nodes) is reported as `degraded` rather than
 * hidden, and the human-gated manual-review surface is reported as awaiting its
 * evidence instead of failing a machine gate that cannot produce it.
 *
 * Dependency-free (`node:fs` / `node:path` only) and free of side effects on
 * import, so the report can be built in-process by a gate, by a CLI and by a
 * vitest suite. The evaluator is pure: every filesystem read happens in the
 * `read*` helpers, so a suite can plant evidence records that never existed on
 * disk.
 */

import fs from "node:fs";
import path from "node:path";

import { PUBLIC_ROUTES, SURFACE_KEYS } from "./public-routes.mjs";

/**
 * The route surfaces, in the manifest's own order. Re-exported so a report
 * reader does not have to know that `public-routes.mjs` owns the key list.
 */
export const ROUTE_SURFACES = SURFACE_KEYS;

/**
 * Surfaces whose evidence a machine run cannot legitimately produce: the manual
 * review is human Section 508 evidence (issue #195). An absent record on these
 * surfaces is *awaiting* evidence, not a gate that stopped covering a route, so
 * it is reported and never fails a run.
 *
 * @type {readonly string[]}
 */
export const HUMAN_GATED_SURFACES = Object.freeze(["manualReview"]);

/** Human-readable surface names, used in the published markdown. */
const SURFACE_LABELS = Object.freeze({
  manualReview: "manual review",
  contrast: "contrast",
  productionProbe: "production probe",
});

/** Repository-relative, posix-style, for report text a reader can click. */
function relativeToRoot(file, root) {
  const relative = path.relative(root, file);
  return relative.split(path.sep).join("/");
}

/** A finite number, or null — never a silent 0 for a field that was absent. */
function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** The contrast evidence a run of `e2e/a11y-contrast.mjs` left behind. */
const CONTRAST_SUMMARY = "summary.json";

/**
 * One route's declaration, with the surfaces it participates in.
 *
 * @param {readonly object[]} [manifest]
 * @returns {{ path: string, label: string, page: string, surfaces: Record<string, boolean>, exclusionReason: string | null }[]}
 */
export function declaredRouteInventory(manifest = PUBLIC_ROUTES) {
  return manifest.map((entry) => ({
    path: entry.path,
    label: entry.label,
    page: entry.page,
    surfaces: Object.fromEntries(SURFACE_KEYS.map((surface) => [surface, entry[surface] === true])),
    exclusionReason: entry.exclusionReason ?? null,
  }));
}

/**
 * Reads the contrast gate's recorded evidence for one run: the `summary.json`
 * row it wrote per route, plus whether the evidence file that row names is still
 * on disk. A row that names a file which is not there is a *claim* of evidence,
 * not evidence, and is reported as such.
 *
 * Records are keyed by route path (the summary's `route` field), so every
 * surface's records share one key space.
 *
 * `directory` may be repository-relative (the gate's default) or absolute (a
 * caller pointing at a run's evidence elsewhere), and is resolved before the
 * summary path is built — `path.join` would otherwise fold an absolute
 * directory back under the working directory and report a healthy run as
 * missing.
 *
 * @param {{ directory: string, root?: string }} options
 * @returns {{ source: string, summaryFile: string, generatedAt: string | null, records: Map<string, object>, problems: string[] }}
 */
export function readContrastEvidence({ directory, root = process.cwd() }) {
  const base = path.isAbsolute(directory) ? directory : path.join(root, directory);
  const summaryFile = path.join(base, CONTRAST_SUMMARY);
  const shownSummary = relativeToRoot(summaryFile, root);
  /** @type {Map<string, object>} */
  const records = new Map();
  const problems = [];

  let raw;
  try {
    raw = fs.readFileSync(summaryFile, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {
        source: "missing",
        summaryFile,
        generatedAt: null,
        records,
        problems: [`no contrast evidence recorded: ${shownSummary} does not exist`],
      };
    }
    throw error;
  }

  let summary;
  try {
    summary = JSON.parse(raw);
  } catch {
    return {
      source: "unreadable",
      summaryFile,
      generatedAt: null,
      records,
      problems: [`${shownSummary} is not valid JSON, so this run's recorded evidence could not be read`],
    };
  }

  const generatedAt = typeof summary?.generatedAt === "string" ? summary.generatedAt : null;
  const rows = Array.isArray(summary?.routes) ? summary.routes : null;
  if (!rows) {
    return {
      source: "malformed",
      summaryFile,
      generatedAt,
      records,
      problems: [`${shownSummary} records no routes array, so no per-route evidence can be attributed`],
    };
  }

  for (const row of rows) {
    const routePath = typeof row?.route === "string" && row.route !== "" ? row.route : null;
    if (!routePath) {
      problems.push(`${shownSummary} holds a summary row with no route path`);
      continue;
    }
    if (records.has(routePath)) {
      problems.push(`${shownSummary} holds two summary rows for ${routePath}`);
      continue;
    }
    const evidenceFile = typeof row.evidenceFile === "string" && row.evidenceFile !== "" ? row.evidenceFile : null;
    const absolute = evidenceFile === null
      ? null
      : path.isAbsolute(evidenceFile)
        ? evidenceFile
        : path.join(root, evidenceFile);
    const evidenceFilePresent = absolute !== null && fs.existsSync(absolute);
    if (!evidenceFilePresent) {
      problems.push(
        `${shownSummary} records evidence for ${routePath} but ${evidenceFile ?? "(no path)"} is not on disk`,
      );
    }
    records.set(routePath, {
      surface: "contrast",
      route: routePath,
      label: typeof row.label === "string" ? row.label : null,
      evidenceFile,
      evidenceFilePresent,
      keyboardSteps: finiteNumber(row.keyboardSteps),
      keyboardDistinctElements: finiteNumber(row.keyboardDistinctElements),
      contrastPasses: finiteNumber(row.contrastPasses),
      contrastViolations: finiteNumber(row.contrastViolations),
      contrastIncomplete: finiteNumber(row.contrastIncomplete),
    });
  }

  return { source: "summary", summaryFile, generatedAt, records, problems };
}

/**
 * Reads a production route matrix — the probe status per route — from either the
 * workflow's own `route=status;...` string or a JSON object/array of the same
 * data.
 *
 * The production gate deliberately records status codes only, so this reader
 * never reports a response body: the report carries the code, nothing else.
 *
 * @param {string} text
 * @returns {{ records: Map<string, object>, problems: string[] }}
 */
export function readProductionMatrix(text) {
  /** @type {Map<string, object>} */
  const records = new Map();
  const problems = [];
  const trimmed = String(text ?? "").trim();
  if (trimmed === "") return { records, problems: ["the production route matrix is empty"] };

  /** @type {{ route: string, status: unknown }[]} */
  let entries = [];
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { records, problems: ["the production route matrix is not valid JSON"] };
    }
    if (Array.isArray(parsed)) {
      entries = parsed.map((row) => ({ route: row?.route, status: row?.status }));
    } else if (parsed && typeof parsed === "object") {
      entries = Object.entries(parsed).map(([route, status]) => ({ route, status }));
    }
  } else {
    entries = trimmed
      .split(";")
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const separator = chunk.lastIndexOf("=");
        return separator === -1
          ? { route: chunk, status: null }
          : { route: chunk.slice(0, separator), status: chunk.slice(separator + 1) };
      });
  }

  for (const { route, status } of entries) {
    const routePath = typeof route === "string" ? route.trim() : "";
    if (routePath === "") {
      problems.push("the production route matrix holds an entry with no route path");
      continue;
    }
    if (records.has(routePath)) {
      problems.push(`the production route matrix holds two entries for ${routePath}`);
      continue;
    }
    records.set(routePath, {
      surface: "productionProbe",
      route: routePath,
      label: null,
      status: status === null || status === undefined ? null : String(status),
      evidenceFile: null,
      evidenceFilePresent: true,
    });
  }

  return { records, problems };
}

/**
 * Reads the manual-review workbook's route matrix: which route rows exist, and
 * whether each has been ticked by a human. An untick is `not-tested`, the
 * workbook's documented default state — reported, never treated as a machine
 * gate that failed.
 *
 * @param {string} text
 * @returns {{ records: Map<string, object>, problems: string[] }}
 */
export function readManualReviewMatrix(text) {
  /** @type {Map<string, object>} */
  const records = new Map();
  const problems = [];
  const lines = String(text ?? "").split("\n");

  for (const line of lines) {
    if (!line.trimStart().startsWith("|")) continue;
    const cells = line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length < 2) continue;
    // Only data rows of the coverage matrix: the first cell names a route and
    // the second is a checkbox cell. Workflow rows (no route token) are skipped
    // rather than mis-reported as routes.
    const routeToken = /`(\/[A-Za-z0-9\-/]*)`/.exec(cells[0]);
    if (!routeToken) continue;
    const tick = /^\[\s*([xX])?\s*\]$/.exec(cells[1]);
    if (!tick) continue;
    const routePath = routeToken[1];
    // The workbook legitimately devotes several rows to one route (a plain row
    // plus per-interaction rows such as the presumptive DD-214 upload states),
    // so a repeat is *rows*, not a second route: the route is tested once any of
    // its rows is ticked, and untested only while every row is still blank.
    const existing = records.get(routePath);
    const status = tick[1] ? "tested" : "not-tested";
    if (existing) {
      if (status === "tested") existing.status = "tested";
      continue;
    }
    records.set(routePath, {
      surface: "manualReview",
      route: routePath,
      label: null,
      status,
      evidenceFile: null,
      evidenceFilePresent: true,
    });
  }

  return { records, problems };
}

/** True when a surface's evidence must exist for the gate to keep its claim. */
function isMachineGated(surface) {
  return !HUMAN_GATED_SURFACES.includes(surface);
}

/**
 * Inspects one recorded evidence record against its surface's contract, feeding
 * the report's `problems` (the run must fail) and `degraded` (reported, not a
 * failure) lists.
 */
function inspectRecord(surface, record, { routePath, pushProblem, pushDegraded }) {
  if (surface === "contrast") {
    if (record.keyboardSteps === 0) {
      pushProblem(
        `${routePath}: the contrast gate recorded no keyboard walk (its tabbable-element probe came back empty), ` +
          "so keyboard coverage for this route stopped without any assertion noticing",
      );
    } else if (record.keyboardSteps === null || record.keyboardDistinctElements === null) {
      pushProblem(
        `${routePath}: the recorded contrast evidence carries no keyboard walk result, so the keyboard half of the ` +
          "surface is unrecorded",
      );
    }
    if (record.keyboardDistinctElements === 1) {
      pushDegraded(
        `${routePath}: the keyboard walk pressed Tab but focus never reached a second element (distinct=1), ` +
          "so traversal is recorded but not demonstrated",
      );
    }
    if (record.contrastIncomplete !== null && record.contrastIncomplete > 0) {
      pushDegraded(
        `${routePath}: axe reported ${record.contrastIncomplete} incomplete node(s) (recorded, non-blocking)`,
      );
    }
    if (record.contrastViolations !== null && record.contrastViolations > 0) {
      pushProblem(`${routePath}: axe reported ${record.contrastViolations} contrast violation(s)`);
    }
    return;
  }
  if (surface === "productionProbe") {
    if (record.status !== "200") {
      pushProblem(`${routePath}: the production probe recorded HTTP ${record.status ?? "(no status)"}`);
    }
    return;
  }
}

/**
 * The report: every declared route, its declared surfaces, what this run
 * recorded for the gated surface, and everything that is wrong with the
 * difference.
 *
 * `records` and `evidenceProblems` are parameters (not reads) so a suite can
 * plant a route the run never covered and prove the gap is reported, and so the
 * two "no evidence at all" and "claimed but absent" shapes are both reachable
 * without a browser.
 *
 * @param {{ surface: string, records: Map<string, object>, manifest?: readonly object[], run?: object, generatedAt?: string | null, evidenceProblems?: string[] }} options
 */
export function buildRouteInventoryReport({
  surface,
  records,
  manifest = PUBLIC_ROUTES,
  run = {},
  generatedAt = null,
  evidenceProblems = [],
}) {
  if (!SURFACE_KEYS.includes(surface)) {
    throw new Error(`Unknown route surface "${surface}" (expected one of ${SURFACE_KEYS.join(", ")})`);
  }

  const machineGated = isMachineGated(surface);
  const humanGated = !machineGated;
  const declared = declaredRouteInventory(manifest);
  const declaredPaths = new Set(declared.map((entry) => entry.path));
  const problems = [...evidenceProblems];
  const degraded = [];
  const pushProblem = (message) => problems.push(message);
  const pushDegraded = (message) => degraded.push(message);

  const rows = declared.map((entry) => {
    const gateDeclared = entry.surfaces[surface] === true;
    const record = records.get(entry.path) ?? null;

    for (const message of validateRecordShape(entry.path, record)) problems.push(message);

    if (record) inspectRecord(surface, record, { routePath: entry.path, pushProblem, pushDegraded });

    // A human-gated surface is only *recorded* once a human has ticked the row:
    // a matrix row that exists but reads `not-tested` is the human gate waiting,
    // not evidence — reporting it as recorded would let the published table claim
    // coverage that does not exist yet.
    const humanEvidence = !humanGated || record?.status === "tested";
    let status;
    if (gateDeclared && record && humanEvidence) status = "recorded";
    else if (gateDeclared) status = machineGated ? "missing" : "awaiting-human";
    else if (record) status = "out-of-surface";
    else status = "not-in-surface";

    if (status === "missing") {
      pushProblem(
        `${entry.path}: declared for the ${SURFACE_LABELS[surface]} surface but this run recorded no evidence for it`,
      );
    }
    if (status === "out-of-surface") {
      pushProblem(
        `${entry.path}: the manifest leaves it out of the ${SURFACE_LABELS[surface]} surface, yet this run recorded ` +
          "evidence for it (an excluded route must not be covered by the gate it was excluded from)",
      );
    }

    return { path: entry.path, label: entry.label, declared: entry.surfaces, gateDeclared, record, status };
  });

  /** Evidence for a route the manifest does not declare at all. */
  const undeclared = [];
  for (const [routePath, record] of records) {
    if (declaredPaths.has(routePath)) continue;
    undeclared.push({ path: routePath, record });
    problems.push(
      `${routePath}: this run recorded ${SURFACE_LABELS[surface]} evidence for a route the manifest does not declare`,
    );
  }

  const totals = {
    declared: declared.length,
    inSurface: rows.filter((row) => row.gateDeclared).length,
    recorded: rows.filter((row) => row.status === "recorded").length,
    missing: rows.filter((row) => row.status === "missing").length,
    outOfSurface: rows.filter((row) => row.status === "out-of-surface").length,
    notInSurface: rows.filter((row) => row.status === "not-in-surface").length,
    awaitingHuman: rows.filter((row) => row.status === "awaiting-human").length,
    undeclared: undeclared.length,
    degraded: degraded.length,
  };

  return {
    generatedAt,
    surface,
    run: {
      id: typeof run.id === "string" ? run.id : null,
      label: typeof run.label === "string" ? run.label : null,
      commit: typeof run.commit === "string" ? run.commit : null,
    },
    totals,
    rows,
    undeclared,
    degraded,
    problems,
  };
}

/**
 * Structural validation for a record, kept separate from the surface contract:
 * a record that does not say which route or surface it belongs to cannot be
 * attributed, and silently attributing it would hide exactly the gap this
 * report exists to show.
 */
function validateRecordShape(routePath, record) {
  if (!record) return [];
  const messages = [];
  if (record.route !== undefined && record.route !== routePath) {
    messages.push(`${routePath}: an evidence record keyed to it names route ${record.route}`);
  }
  return messages;
}

/**
 * Renders the report as the published artifact: a headline with the per-run
 * counts, one row per declared route (so a route cannot be absent from the
 * published table), and the problem/degraded lists in full.
 *
 * @param {ReturnType<typeof buildRouteInventoryReport>} report
 */
export function renderRouteInventoryReport(report) {
  const lines = [];
  lines.push(`# Per-run route inventory — ${SURFACE_LABELS[report.surface] ?? report.surface} surface`);
  lines.push("");
  lines.push(
    `Declared routes: **${report.totals.declared}** · in this surface: **${report.totals.inSurface}** · ` +
      `recorded this run: **${report.totals.recorded}** · missing: **${report.totals.missing}** · ` +
      `out-of-surface: **${report.totals.outOfSurface}** · undeclared evidence: **${report.totals.undeclared}** · ` +
      `degraded: **${report.totals.degraded}**`,
  );
  if (report.totals.awaitingHuman > 0) {
    lines.push("");
    lines.push(
      `Human-gated rows awaiting evidence (the manual review is a human gate, not a machine gate): ` +
        `**${report.totals.awaitingHuman}**.`,
    );
  }
  lines.push("");
  const meta = [
    report.generatedAt ? `generated ${report.generatedAt}` : null,
    report.run.id ? `run ${report.run.id}` : null,
    report.run.label ? `trigger ${report.run.label}` : null,
    report.run.commit ? `commit ${report.run.commit}` : null,
  ].filter(Boolean);
  if (meta.length > 0) {
    lines.push(meta.join(" · "));
    lines.push("");
  }
  lines.push("| Route | Declared surfaces | Recorded this run | Status | Evidence |");
  lines.push("|---|---|---|---|---|");
  for (const row of report.rows) {
    const declaredSurfaces = SURFACE_KEYS.filter((surface) => row.declared[surface] === true)
      .map((surface) => (surface === report.surface ? `**${surface}**` : surface))
      .join(", ");
    lines.push(
      `| \`${row.path}\` | ${declaredSurfaces || "—"} | ${row.record ? row.record.surface : "—"} | ` +
        `${row.status} | ${describeRecord(row.record)} |`,
    );
  }
  if (report.undeclared.length > 0) {
    lines.push("");
    lines.push("Recorded evidence with no declared route:");
    for (const entry of report.undeclared) lines.push(`- \`${entry.path}\` (${entry.record.surface})`);
  }
  lines.push("");
  lines.push(`## Problems (${report.problems.length})`);
  lines.push("");
  if (report.problems.length === 0) {
    lines.push("None: every route this surface declares has evidence recorded for it in this run.");
  } else {
    for (const problem of report.problems) lines.push(`- ${problem}`);
  }
  lines.push("");
  lines.push(`## Degraded evidence (${report.degraded.length})`);
  lines.push("");
  if (report.degraded.length === 0) {
    lines.push("None.");
  } else {
    for (const entry of report.degraded) lines.push(`- ${entry}`);
  }
  lines.push("");
  return lines.join("\n");
}

/** One route's recorded evidence, short enough for a table cell. */
function describeRecord(record) {
  if (!record) return "—";
  const parts = [];
  if (record.surface === "contrast") {
    const steps = record.keyboardSteps === null ? "unknown" : String(record.keyboardSteps);
    const distinct = record.keyboardDistinctElements === null ? "unknown" : String(record.keyboardDistinctElements);
    parts.push(`keyboard ${steps} steps/${distinct} distinct`);
    parts.push(`axe violations ${record.contrastViolations ?? "unknown"}, incomplete ${record.contrastIncomplete ?? "unknown"}`);
    if (record.evidenceFile) {
      parts.push(`${record.evidenceFile}${record.evidenceFilePresent ? "" : " (MISSING ON DISK)"}`);
    }
  } else if (record.surface === "productionProbe") {
    parts.push(`HTTP ${record.status ?? "(no status)"}`);
  } else {
    parts.push(record.status ?? "recorded");
  }
  return parts.join("; ").replaceAll("|", "\\|");
}

/**
 * Convenience: read + evaluate in one call, for a gate that just ran. Kept thin
 * so the two steps remain independently testable.
 *
 * @param {{ surface: string, read: { records: Map<string, object>, problems: string[], generatedAt?: string | null }, run?: object, manifest?: readonly object[] }} options
 */
export function routeInventoryReportFor({ surface, read, run = {}, manifest = PUBLIC_ROUTES }) {
  return buildRouteInventoryReport({
    surface,
    records: read.records,
    evidenceProblems: read.problems,
    generatedAt: read.generatedAt ?? null,
    run,
    manifest,
  });
}

/**
 * Writes the report pair (`<base>.json` and `<base>.md`) and returns both paths.
 * The gate and the CLI publish through this one function, so the artifact a
 * reader opens is byte-identical in shape whichever entry point produced it.
 *
 * @param {{ report: object, base: string }} options
 */
export function writeRouteInventoryReport({ report, base }) {
  const jsonPath = `${base}.json`;
  const markdownPath = `${base}.md`;
  const markdown = renderRouteInventoryReport(report);
  fs.mkdirSync(path.dirname(base), { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(markdownPath, markdown, "utf8");
  return { jsonPath, markdownPath, markdown };
}

/** The default evidence directory the R-05 contrast gate writes into. */
export const CONTRAST_EVIDENCE_DIR = "a11y-evidence";
/** The default report base name, inside the evidence directory. */
export const ROUTE_INVENTORY_REPORT_BASE = `${CONTRAST_EVIDENCE_DIR}/route-inventory-report`;
