import "server-only";

import { readEmbeddedDataBundle, type EmbeddedDataDomain } from "./embedded-bundle";

/**
 * Build-time copy of the authored data domains, for runtimes without a
 * filesystem.
 *
 * `scripts/build-embedded-data.mjs` (postinstall + prebuild) serialises every
 * domain exactly as the loaders read it from disk: raw JSON text keyed by
 * filename, already filtered to the files each loader would accept. The
 * loaders still parse and validate these strings through the same schemas and
 * filename-identity checks they apply to disk reads — this artifact is a source
 * of bytes, never a second definition of what valid data is.
 *
 * The bytes are installed on `globalThis` by `embedded-bootstrap.ts` from the
 * instrumentation entry; see `embedded-bundle.ts` for why this module does not
 * import the generated artifact directly. `.generated.json` and `.generated.ts`
 * are gitignored install artifacts, not authored content.
 */
export type { EmbeddedDataDomain };

/**
 * `[filename, raw JSON text]` for one domain, sorted by filename.
 *
 * Sorting matches every loader's `readdir().filter().sort()` order, so the
 * embedded path produces the same condition, mapping and node order as the
 * disk path and cannot reorder a catalog or a published mapping list.
 */
export function embeddedDataFiles(
  domain: EmbeddedDataDomain,
): ReadonlyArray<readonly [string, string]> {
  const files = readEmbeddedDataBundle().domains[domain] ?? {};
  return Object.keys(files)
    .sort()
    .map((file) => [file, files[file]] as const);
}
