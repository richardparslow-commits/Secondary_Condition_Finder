#!/usr/bin/env node
/**
 * Deployment-artifact gate over Next.js output-file traces (REL-03).
 *
 *   npm run audit:traces
 *
 * Next records, per server entry point, the exact set of files that must be
 * present for that entry point to run (`.next/server/**\/*.nft.json`, plus the
 * standalone bundle when one is built). Two classes of defect are invisible to
 * a successful build and only show up in a deployment:
 *
 *   1. **Unrelated project files.** A dynamic filesystem access (`fs` calls on
 *      a computed path) makes Turbopack trace the whole project, so source,
 *      tests, docs, scripts and scratch output get shipped into the artifact.
 *      That is unnecessary data exposure and deployment weight, and it is what
 *      REL-03 fixed for `data/knowledge-base/graph`. The fix is fragile: any new
 *      dynamic read re-introduces it, and nothing else fails when it does.
 *   2. **Missing required runtime data.** A trace that omits a file the runtime
 *      reads produces a build that succeeds and a deployment that fails at the
 *      first request. Because the data directory is an application-wide server
 *      dependency (`outputFileTracingIncludes` in `next.config.ts`), every App
 *      Router trace must carry the whole required data set.
 *
 * The gate fails closed: no traces, no required data, or an unreadable trace is
 * a failure, never a vacuous pass — a green gate that checked nothing is worse
 * than no gate, because it is trusted.
 *
 * Usage:
 *   node scripts/audit-artifact-traces.mjs [--root=<dir>] [--json=<path>]
 *
 * `--root` defaults to the current directory and must contain both `.next` and
 * `data`; it exists so a test (or an isolated build) can be audited without
 * touching the working copy.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const argument = (name, fallback = null) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;

const ROOT = resolve(argument("root", process.cwd()));
const JSON_PATH = argument("json");

/**
 * Directories under `data/` that the runtime must not ship.
 *
 * `data/knowledge-base-quarantine/` holds retired and unapproved mappings kept
 * byte-for-byte as a record (REL-01). Nothing loads them, and shipping them
 * would put unreviewed clinical drafts into the artifact. Excluded explicitly
 * and by name so the exclusion is reviewable — and so that a traced quarantine
 * file is reported as *unrelated*, which is what it is.
 */
const RETIRED_DATA_DIRS = ["data/knowledge-base-quarantine/"];

/**
 * Paths a trace may legitimately contain.
 *
 * `node_modules/` is a dependency (including a stripped `src/` inside a package
 * — that is package content, not project source). `.next/` is the build output.
 * `data/` is the app-wide runtime data include. `public/` is static assets. The
 * bare `node_modules` (no slash) is the symlinked directory itself in an
 * isolated build. Anything else inside the project is a leak.
 */
const ALLOWED_PROJECT_PREFIXES = ["node_modules/", ".next/", "data/", "public/"];
const ALLOWED_PROJECT_FILES = new Set(["package.json", "node_modules"]);

/** The generated standalone entrypoint, which sits at the app root. */
const STANDALONE_ENTRYPOINT = "server.js";

/** How many examples of each finding to print before summarizing the rest. */
const EXAMPLES = 5;
/** Hard cap on how much a single trace may add to one example list. */
const MAX_SCAN_LINES = 20_000;

/**
 * Every regular file under `directory`, never following symlinks.
 *
 * Symlinks are skipped deliberately: a standalone bundle symlinks its
 * node_modules back to the dependency root, and following that would walk the
 * entire dependency tree (and double-count). Enumeration is also non-fatal — a
 * malformed artifact should produce a finding, not a stack trace — so an
 * unreadable directory is reported to the caller through `walkErrors` instead
 * of throwing mid-audit.
 */
const walkErrors = [];
function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    walkErrors.push(`${directory}: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
  return entries.flatMap((entry) => {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(full);
    return entry.isFile() ? [full] : [];
  });
}

/** Trace files for the built server, excluding any nested standalone copy. */
function findTraces(buildDir) {
  return walkFiles(buildDir)
    .filter((file) => file.endsWith(".nft.json") && !file.includes(`${sep}standalone${sep}`))
    .sort();
}

/**
 * Required runtime data: every JSON file under `data/`, minus the retired
 * directories above. The contract is app-wide, so it is the same set for every
 * App Router trace; narrowing `outputFileTracingIncludes` per domain is a
 * deliberate change that must update this list and its test together.
 */
function requiredDataFiles() {
  const dataDir = join(ROOT, "data");
  return walkFiles(dataDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => relative(ROOT, file))
    .filter((file) => !RETIRED_DATA_DIRS.some((prefix) => file.startsWith(prefix)))
    .sort();
}

/** Classify one trace entry as a project-relative path, or null when external. */
/**
 * Whether a project-relative trace entry is a legitimate part of the artifact.
 *
 * `data/` is allowed because the app-wide include is deliberate — but the
 * retired directories are carved back out: a quarantined file appearing in a
 * trace means unreviewed content would ship, which is a finding, not a pass.
 */
function isAllowedProjectPath(relativePath) {
  if (relativePath === STANDALONE_ENTRYPOINT) return true;
  if (ALLOWED_PROJECT_FILES.has(relativePath)) return true;
  if (RETIRED_DATA_DIRS.some((prefix) => relativePath.startsWith(prefix))) return false;
  return ALLOWED_PROJECT_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

function projectRelative(entry, traceDir) {
  const absolute = resolve(traceDir, entry);
  const relativePath = relative(ROOT, absolute);
  // An entry outside the project root (a shared or hoisted dependency) is not
  // project content; the caller decides whether its location is acceptable.
  if (relativePath.startsWith("..") || relativePath === "") return null;
  return relativePath.split(sep).join("/");
}

function describe(paths) {
  const lines = paths.slice(0, EXAMPLES).map((path) => `    ${path}`);
  if (paths.length > EXAMPLES) lines.push(`    … and ${paths.length - EXAMPLES} more`);
  return lines;
}

const dataFiles = requiredDataFiles();
const traces = findTraces(join(ROOT, ".next"));

const failures = [];
const report = {
  root: ROOT,
  traces: [],
  standalone: null,
  requiredDataFiles: dataFiles.length,
};

if (traces.length === 0) {
  failures.push(
    `no .nft.json traces under ${relative(process.cwd(), join(ROOT, ".next")) || ".next"} — ` +
      "build before running this gate; a vacuous pass is not accepted",
  );
}
if (dataFiles.length === 0) {
  failures.push(
    "no required runtime data found under data/ — the trace contract cannot be validated, so the gate fails closed",
  );
}

const existsCache = new Map();
function exists(path) {
  if (!existsCache.has(path)) existsCache.set(path, existsSync(path));
  return existsCache.get(path);
}

for (const trace of traces) {
  const route = relative(join(ROOT, ".next"), trace).split(sep).join("/");
  let entries;
  try {
    const parsed = JSON.parse(readFileSync(trace, "utf8"));
    entries = Array.isArray(parsed?.files) ? parsed.files : null;
  } catch (error) {
    failures.push(`${route}: unreadable trace — ${error instanceof Error ? error.message : String(error)}`);
    continue;
  }
  if (!entries) {
    failures.push(`${route}: trace has no "files" array`);
    continue;
  }

  const unrelated = [];
  const outsideProject = [];
  const missingDependencies = [];
  const present = new Set();

  for (const entry of entries.slice(0, MAX_SCAN_LINES)) {
    const absolute = resolve(dirname(trace), entry);
    const relativePath = projectRelative(entry, dirname(trace));
    if (relativePath === null) {
      // Outside the project: dependency internals are fine, anything else is a
      // path the artifact should not depend on.
      if (!absolute.includes(`${sep}node_modules${sep}`)) outsideProject.push(absolute);
    } else {
      present.add(relativePath);
      if (!isAllowedProjectPath(relativePath)) unrelated.push(relativePath);
    }
    if (!exists(absolute)) missingDependencies.push(relativePath ?? absolute);
  }
  if (entries.length > MAX_SCAN_LINES) {
    failures.push(
      `${route}: ${entries.length} entries exceeds the ${MAX_SCAN_LINES}-entry scan cap — raise the cap deliberately rather than auditing part of a trace`,
    );
  }

  // App Router entries render pages and run the loaders, so each one must carry
  // the whole app-wide data set. Infrastructure traces (instrumentation, the
  // minimal server) do not render and are exempt.
  const isAppTrace = route.startsWith("server/app/");
  const missingData = isAppTrace ? dataFiles.filter((file) => !present.has(file)) : [];

  report.traces.push({
    route,
    entries: entries.length,
    unrelated: unrelated.length,
    outsideProject: outsideProject.length,
    missingDependencies: missingDependencies.length,
    missingData: missingData.length,
  });

  if (unrelated.length > 0) {
    failures.push(
      `${route}: ${unrelated.length} unrelated project file(s) traced — the deployment would ship them:`,
      ...describe([...new Set(unrelated)].sort()),
    );
  }
  if (outsideProject.length > 0) {
    failures.push(
      `${route}: ${outsideProject.length} trace dependency outside the project and outside node_modules:`,
      ...describe([...new Set(outsideProject)].sort()),
    );
  }
  if (missingDependencies.length > 0) {
    failures.push(
      `${route}: ${missingDependencies.length} traced file(s) do not exist on disk — the artifact is incomplete:`,
      ...describe([...new Set(missingDependencies)].sort()),
    );
  }
  if (missingData.length > 0) {
    failures.push(
      `${route}: ${missingData.length} of ${dataFiles.length} required runtime data file(s) missing from this trace:`,
      ...describe(missingData),
      "    every App Router trace carries the app-wide data include; restore it or narrow the include and this contract together",
    );
  }
}

/**
 * The standalone bundle, when this profile builds one. Azure's legacy profile
 * sets `output: "standalone"`; the Vercel-native build does not, and saying so
 * explicitly is the point — "no standalone was built" must not read as a pass.
 */
const standaloneDir = join(ROOT, ".next", "standalone");
if (!existsSync(standaloneDir)) {
  report.standalone = { built: false };
} else {
  const serverEntrypoints = walkFiles(standaloneDir).filter((file) => file.endsWith(`${sep}server.js`));
  // The app root is the directory holding `server.js` and its `.next` output —
  // for a nested standalone build that is not the standalone directory itself.
  const appRoots = serverEntrypoints
    .map((file) => dirname(file))
    .filter((dir) => existsSync(join(dir, ".next", "BUILD_ID")));
  if (appRoots.length === 0) {
    failures.push(
      `standalone bundle at ${relative(ROOT, standaloneDir)} has no entry point alongside a .next/BUILD_ID — it cannot be audited`,
    );
    report.standalone = { built: true, appRoots: 0 };
  } else {
    const unrelated = [];
    const missingData = [];
    for (const appRoot of appRoots) {
      for (const file of walkFiles(appRoot)) {
        const relativePath = relative(appRoot, file).split(sep).join("/");
        if (!isAllowedProjectPath(relativePath)) unrelated.push(relativePath);
      }
      for (const file of dataFiles) {
        if (!exists(join(appRoot, file))) missingData.push(file);
      }
    }
    report.standalone = {
      built: true,
      appRoots: appRoots.length,
      unrelated: unrelated.length,
      missingData: missingData.length,
    };
    if (unrelated.length > 0) {
      failures.push(
        `standalone bundle: ${unrelated.length} unrelated project file(s) shipped:`,
        ...describe([...new Set(unrelated)].sort()),
      );
    }
    if (missingData.length > 0) {
      failures.push(
        `standalone bundle: ${missingData.length} of ${dataFiles.length} required runtime data file(s) missing:`,
        ...describe([...new Set(missingData)].sort()),
      );
    }
  }
}

for (const error of walkErrors) {
  failures.push(`could not enumerate the artifact — the gate cannot certify what it cannot read: ${error}`);
}

if (JSON_PATH) {
  mkdirSync(dirname(resolve(JSON_PATH)), { recursive: true });
  writeFileSync(resolve(JSON_PATH), `${JSON.stringify({ ...report, failures }, null, 2)}\n`);
}

const appTraces = report.traces.filter((trace) => trace.route.startsWith("server/app/")).length;
console.log(
  `audit-traces: inspected ${report.traces.length} trace(s) (${appTraces} App Router) with ` +
    `${dataFiles.length} required data file(s); standalone ${
      report.standalone?.built ? "audited" : "not built in this profile"
    }.`,
);

if (failures.length > 0) {
  console.error(`audit-traces: FAIL — ${failures.length} finding(s):`);
  for (const line of failures) console.error(line.startsWith("    ") || line.startsWith("audit-") ? line : `  - ${line}`);
  process.exit(1);
}

console.log("audit-traces: PASS — no unrelated project files, no missing dependencies, required runtime data present.");
