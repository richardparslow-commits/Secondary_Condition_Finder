/**
 * Pre-upload guard for the Cloudflare Sites deployment artifact.
 *
 * `freebuff-sites-build/` is generated output, not source, and it is the exact
 * set the Sites uploader reads through `manifest.json`: the listed Worker
 * modules, every file under the assets directory (recursively), and the private
 * cache entries. Two failures are invisible until a publish fails or a deploy
 * is oversized:
 *
 *   1. A folder-sync client duplicates a file it sees mid-write as
 *      `<name> 2.<ext>`. Inside `assets/` that copy is uploaded as a second
 *      asset; the 2026-10-22 checkout had six such copies totalling 6.4 MiB,
 *      which would have pushed this 28.21 MiB artifact over the 32 MiB limit.
 *      A forked *directory* (`assets/_next 2/`) is the same failure one level
 *      up: every file beneath it is uploaded, so the whole subtree is counted
 *      and reported once rather than per file.
 *   2. The upload exceeds that limit at all, for any reason.
 *
 * This guard reads the same manifest the uploader does rather than walking the
 * whole directory, so `worker/deploy-entry.js.map` (24 MiB, not uploaded) and
 * `build.log` are not counted. It fails with exit 1 on a forked path or an
 * over-budget upload, and exits 0 when the artifact is absent so a fresh
 * checkout or CI runner without generated output is not a false failure.
 *
 * Usage:
 *   node scripts/audit-sites-artifact.mjs [--dir=freebuff-sites-build]
 *     [--budget-bytes=33554432] [--json] [--quiet]
 *
 * Exit codes: 0 clean (or artifact absent), 1 audit found a problem,
 * 2 the manifest or a referenced file could not be read.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Sites' documented per-deployment limit: modules + assets + private cache. */
export const SITES_UPLOAD_BUDGET_BYTES = 32 * 1024 * 1024;

/** Same detector as `tests/checkout-fork-hygiene.test.ts`: `<name> 2.<ext>`. */
export const FORKED_NAME_PATTERN = / \d+(\.[A-Za-z0-9._-]+)?$/;

const MIB = 1024 * 1024;

function describeBytes(bytes) {
  return bytes >= 1024 ? `${(bytes / MIB).toFixed(2)} MiB` : `${bytes} bytes`;
}

/** Every file under `directory`, repo-relative to `root`; symlinks carry no bytes. */
function listFiles(directory, root) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    if (entry.isDirectory()) return listFiles(absolute, root);
    if (entry.isFile()) {
      return [{ absolute, relative, bytes: fs.lstatSync(absolute).size }];
    }
    // A symlink is not uploaded by Sites; report it instead of counting bytes
    // for a file the deployment will not contain.
    return [{ absolute, relative, bytes: 0, symlink: true }];
  });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * Audits one generated Sites directory.
 *
 * `budgetBytes` is injectable so tests can prove the over-budget branch without
 * writing 32 MiB. The returned `problems` are human-readable and each names the
 * file or the total it is about; `forked` carries the measured bytes so a
 * cleanup can be prioritised.
 */
export function auditSitesArtifact({
  directory = "freebuff-sites-build",
  budgetBytes = SITES_UPLOAD_BUDGET_BYTES,
} = {}) {
  const root = path.resolve(directory);
  const manifestPath = path.join(root, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return {
      status: "absent",
      directory: root,
      manifestPath,
      budgetBytes,
      modules: [],
      assets: [],
      cache: [],
      forked: [],
      forkedDirectories: [],
      totals: { modules: 0, assets: 0, cache: 0, total: 0 },
      problems: [],
    };
  }

  const manifest = readJson(manifestPath);
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error(`${manifestPath} is not a JSON object`);
  }
  if (!Array.isArray(manifest.modules) || manifest.modules.length === 0) {
    throw new Error(`${manifestPath} lists no modules`);
  }
  if (typeof manifest.assetsDirectory !== "string" || manifest.assetsDirectory === "") {
    throw new Error(`${manifestPath} names no assetsDirectory`);
  }

  const modules = manifest.modules.map((module, index) => {
    if (typeof module?.path !== "string" || module.path === "") {
      throw new Error(`${manifestPath} module ${index} has no path`);
    }
    const absolute = path.join(root, module.path);
    if (!fs.existsSync(absolute)) {
      throw new Error(`${manifestPath} module ${module.path} does not exist`);
    }
    return {
      path: module.path,
      relative: module.path,
      bytes: fs.statSync(absolute).size,
    };
  });

  const assetsRoot = path.join(root, manifest.assetsDirectory);
  if (!fs.existsSync(assetsRoot)) {
    throw new Error(`${manifestPath} assets directory ${manifest.assetsDirectory} does not exist`);
  }
  const assets = listFiles(assetsRoot, root);

  const cache = (Array.isArray(manifest.cache) ? manifest.cache : []).map((entry, index) => {
    if (typeof entry?.path !== "string" || entry.path === "") {
      throw new Error(`${manifestPath} cache entry ${index} has no path`);
    }
    const absolute = path.join(root, entry.path);
    if (!fs.existsSync(absolute)) {
      throw new Error(`${manifestPath} cache entry ${entry.path} does not exist`);
    }
    return { path: entry.path, relative: entry.path, bytes: fs.statSync(absolute).size };
  });

  const problems = [];
  const forked = [];
  /** A forked directory is one upload problem, not one per file beneath it. */
  const forkedDirectoryMap = new Map();
  for (const file of [...assets, ...cache, ...modules]) {
    const segments = file.relative.split("/");
    for (let index = 0; index < segments.length - 1; index += 1) {
      if (!FORKED_NAME_PATTERN.test(segments[index])) continue;
      const prefix = segments.slice(0, index + 1).join("/");
      const entry = forkedDirectoryMap.get(prefix) ?? { path: prefix, bytes: 0, files: 0 };
      entry.bytes += file.bytes;
      entry.files += 1;
      forkedDirectoryMap.set(prefix, entry);
      break;
    }
    if (FORKED_NAME_PATTERN.test(path.basename(file.relative))) {
      const bytes = file.bytes;
      forked.push({ path: file.relative, bytes });
      problems.push(
        `${file.relative}: forked path name (${describeBytes(bytes)}) — a folder-sync copy, not an asset; delete it before upload`,
      );
    }
    if (file.symlink) {
      problems.push(`${file.relative}: symlink in the upload set; Sites uploads regular files only`);
    }
  }

  const forkedDirectories = [...forkedDirectoryMap.values()].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
  for (const directory of forkedDirectories) {
    problems.push(
      `${directory.path}: forked directory name (${describeBytes(directory.bytes)} across ` +
        `${directory.files} file(s)) — a folder-sync copy, not an asset; delete it before upload`,
    );
  }

  const moduleBytes = modules.reduce((sum, file) => sum + file.bytes, 0);
  const assetBytes = assets.reduce((sum, file) => sum + file.bytes, 0);
  const cacheBytes = cache.reduce((sum, file) => sum + file.bytes, 0);
  const totals = {
    modules: moduleBytes,
    assets: assetBytes,
    cache: cacheBytes,
    total: moduleBytes + assetBytes + cacheBytes,
  };

  if (totals.total > budgetBytes) {
    problems.push(
      `upload is ${describeBytes(totals.total)}, exceeding the budget of ${describeBytes(budgetBytes)} ` +
        `by ${describeBytes(totals.total - budgetBytes)}`,
    );
  }

  return {
    status: "audited",
    directory: root,
    manifestPath,
    budgetBytes,
    modules,
    assets,
    cache,
    forked,
    forkedDirectories,
    totals,
    problems,
  };
}

function parseArguments(argv) {
  const values = new Map();
  const flags = new Set();
  for (const argument of argv) {
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument "${argument}"`);
    const separator = argument.indexOf("=");
    if (separator === -1) {
      flags.add(argument.slice(2));
    } else {
      values.set(argument.slice(2, separator), argument.slice(separator + 1));
    }
  }
  return { values, flags };
}

function main() {
  const { values, flags } = parseArguments(process.argv.slice(2));
  if (flags.has("help")) {
    console.log("Audits the generated Sites upload set. See the module header for usage.");
    return;
  }

  const budgetValue = values.get("budget-bytes");
  const budgetBytes = budgetValue === undefined ? SITES_UPLOAD_BUDGET_BYTES : Number(budgetValue);
  if (!Number.isSafeInteger(budgetBytes) || budgetBytes <= 0) {
    throw new Error(`--budget-bytes must be a positive integer, got ${budgetValue}`);
  }

  const report = auditSitesArtifact({
    directory: values.get("dir") ?? "freebuff-sites-build",
    budgetBytes,
  });

  if (flags.has("json")) {
    console.log(JSON.stringify(report, null, 2));
  } else if (flags.has("quiet")) {
    console.log(
      report.status === "absent"
        ? `[sites-artifact] ${report.directory}: no manifest, skipped`
        : `[sites-artifact] ${report.directory}: ${describeBytes(report.totals.total)} / ${describeBytes(budgetBytes)}, ` +
            `${report.forked.length} forked, ${report.problems.length} problem(s)`,
    );
  } else if (report.status === "absent") {
    console.log(`[sites-artifact] no manifest at ${report.manifestPath}; nothing to audit`);
  } else {
    console.log(
      `[sites-artifact] ${report.directory}: ${describeBytes(report.totals.total)} / ${describeBytes(budgetBytes)} ` +
        `(modules ${describeBytes(report.totals.modules)}, assets ${describeBytes(report.totals.assets)}, ` +
        `cache ${describeBytes(report.totals.cache)})`,
    );
    console.log(`[sites-artifact] ${report.assets.length} asset file(s), ${report.forked.length} forked`);
    for (const problem of report.problems) console.error(`[sites-artifact] PROBLEM: ${problem}`);
  }

  if (report.problems.length > 0) {
    console.error(`[sites-artifact] ${report.problems.length} problem(s); refusing the upload set.`);
    process.exitCode = 1;
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(`[sites-artifact] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}
