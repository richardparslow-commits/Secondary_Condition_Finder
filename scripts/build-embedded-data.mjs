#!/usr/bin/env node
/**
 * Emits the build-time copy of the authored data domains.
 *
 *   npm run build:embedded-data
 *
 * The four loaders (condition catalog, knowledge base, presumptive exposures,
 * regulatory actions) plus the adjacency-graph loader read `data/` from disk on
 * a Node host. Cloudflare Workers — the Sites target — runs the same server
 * bundle without a filesystem: every `readdir` under `data/` answers ENOENT
 * even though the files are in the repository, so `/terms`, `/presumptive` and
 * the catalog checks in `/api/health` failed there.
 *
 * This artifact is the fallback source for that runtime only: the loaders keep
 * their disk path on Node (tests, `next dev`, Electron, Azure) and read these
 * raw JSON texts when `hasDataFilesystem()` reports otherwise. Raw text — not
 * pre-parsed values — so the fallback runs through the exact same schema,
 * filename-identity and duplicate checks as the disk path instead of becoming a
 * second, drifting definition of what valid data is.
 *
 * Two outputs, one source:
 *   - `.generated.json` is the inspectable copy the parity suite compares with
 *     `data/` file-by-file.
 *   - `.generated.ts` holds the same corpus gzip-compressed and base64-encoded
 *     as one string literal. Only the instrumentation entry imports it, and it
 *     installs the parsed bundle on `globalThis` (`embedded-bootstrap.ts`). A
 *     JSON module imported by the loaders instead would be inlined into every
 *     route chunk that reaches a loader — Turbopack produced eight copies of
 *     this corpus that way, taking the Worker from 14.5 MB to 80 MB. One
 *     importing entry means one copy.
 *
 * Compression is not cosmetic: the Sites upload budget is 32 MiB for all
 * modules AND assets measured on decoded bytes, and this corpus is most of the
 * Worker. Raw JSON took the bundle to 32 MB and the upload was refused; the
 * gzip+base64 form is ~3 MB per copy, which fits with the OCR assets. workerd
 * implements `node:zlib` (verified with `gunzipSync` on the deployed compat
 * date), so decoding stays synchronous at startup.
 *
 * Non-JSON entries (`.DS_Store`, Finder duplicates) are never emitted, matching
 * the loaders' own `.json` filters. A file that does not parse fails the build;
 * emitting it would move the failure to every Worker request.
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = process.cwd();
// Outside `src/` on purpose: `tests/catalog-identity-admission.test.ts` copies
// `src/` (and `data/`) into throwaway fixtures, and an 11 MB install artifact
// inside `src/` turned every copy into a multi-second stall. This directory is
// gitignored and not part of any authored tree.
const OUT_DIR = join(ROOT, ".data-bundle");
const OUT_JSON = join(OUT_DIR, "embedded-data.generated.json");
const OUT_TS = join(OUT_DIR, "embedded-data.generated.ts");
const VERSION = 1;

/**
 * Domain key → [directory, filename predicate].
 *
 * `knowledgeBase` is top-level mappings only; graph nodes live in their own
 * subdirectory and are emitted under `graph`. The regulatory loader already
 * skips `_`-prefixed files, so the artifact must too.
 */
const DOMAINS = {
  catalog: [join(ROOT, "data", "conditions"), (name) => name.endsWith(".json")],
  knowledgeBase: [join(ROOT, "data", "knowledge-base"), (name) => name.endsWith(".json")],
  graph: [join(ROOT, "data", "knowledge-base", "graph"), (name) => name.endsWith(".json")],
  presumptives: [join(ROOT, "data", "presumptives"), (name) => name.endsWith(".json")],
  regulatoryActions: [
    join(ROOT, "data", "regulatory-actions"),
    (name) => name.endsWith(".json") && !name.startsWith("_"),
  ],
};

/**
 * Read one domain into `{ filename: rawJsonText }`, sorted by filename so the
 * artifact is deterministic across filesystems and checkouts.
 *
 * An absent directory is an empty domain: that is the loaders' own contract for
 * regulatory actions (and an absent graph directory yields an empty map), and
 * the artifact must not invent a stricter one. A present-but-empty directory
 * is likewise empty, not an error.
 */
function readDomain(label, [directory, accept]) {
  let names;
  try {
    if (!statSync(directory).isDirectory()) {
      throw new Error(`${directory} is not a directory`);
    }
    names = readdirSync(directory);
  } catch (error) {
    if (error && error.code === "ENOENT") return {};
    throw error;
  }

  const files = {};
  for (const name of names.filter(accept).sort()) {
    const raw = readFileSync(join(directory, name), "utf8");
    try {
      JSON.parse(raw);
    } catch {
      throw new Error(`${label}/${name}: not valid JSON`);
    }
    files[name] = raw;
  }
  return files;
}

const domains = {};
const summary = [];
for (const [label, spec] of Object.entries(DOMAINS)) {
  const files = readDomain(label, spec);
  domains[label] = files;
  summary.push(`${Object.keys(files).length} ${label}`);
}

mkdirSync(OUT_DIR, { recursive: true });
const serialized = JSON.stringify({ version: VERSION, domains });
writeFileSync(OUT_JSON, serialized);

// gzip first, then base64: one ASCII string literal whose bytes the runtime
// decodes with `node:zlib` before parsing. Raw text in the bundle is both
// larger and duplicated into the muted middleware bundle; the compressed form
// keeps the deployment inside the Sites upload budget.
const compressed = gzipSync(Buffer.from(serialized, "utf8"), { level: 9 }).toString("base64");
const source = [
  "// Generated by scripts/build-embedded-data.mjs — edit the script, not this file.",
  "// Gitignored install artifact: the gzip+base64 `data/` corpus for runtimes",
  "// without a filesystem. Imported only by src/lib/data/embedded-bootstrap.ts.",
  "// Generated outside src/ so fixture copies of src/ stay small.",
  `export const EMBEDDED_DATA_GZIP_BASE64: string = ${JSON.stringify(compressed)};`,
  "",
].join("\n");
writeFileSync(OUT_TS, source);

console.log(
  `wrote .data-bundle/embedded-data.generated.{json,ts} — ${summary.join(", ")}, ` +
    `${(serialized.length / 1024 / 1024).toFixed(1)} MB raw / ` +
    `${(compressed.length / 1024 / 1024).toFixed(1)} MB compressed`,
);
