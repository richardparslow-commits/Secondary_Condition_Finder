import "server-only";

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import {
  catalogFileSchema,
  conditionCatalogSchema,
  type CatalogCondition,
  type ConditionCatalog,
} from "./schema";

const CATALOG_DIR = path.join(process.cwd(), "data", "conditions");

let cached: ConditionCatalog | null = null;
let inflight: Promise<ConditionCatalog> | null = null;

async function readCatalog(): Promise<ConditionCatalog> {
  const files = (await fsp.readdir(CATALOG_DIR))
    .filter((file) => file.endsWith(".json"))
    .sort();

  const conditions: CatalogCondition[] = [];
  const seen = new Map<string, string>();

  for (const file of files) {
    const raw = await fsp.readFile(path.join(CATALOG_DIR, file), "utf8");
    const parsed = catalogFileSchema.safeParse(JSON.parse(raw));

    if (!parsed.success) {
      console.error(`[catalog] Invalid catalog file ${file}:`, parsed.error.message);
      throw new Error(`Invalid catalog file ${file}: ${parsed.error.message}`);
    }

    for (const condition of parsed.data.conditions) {
      const previous = seen.get(condition.id);
      if (previous) {
        console.error(`[catalog] Duplicate condition id "${condition.id}" in ${file}; already defined in ${previous}.`);
        throw new Error(
          `Duplicate condition id "${condition.id}" in ${file}; already defined in ${previous}.`,
        );
      }
      seen.set(condition.id, file);
      conditions.push(condition);
    }
  }

  return conditionCatalogSchema.parse(conditions);
}

/**
 * Async, non-blocking variant for startup preload (instrumentation warmup).
 *
 * Shares the same module-level `cached` as the sync `loadConditionCatalog()`
 * so a warmup that completes before the first request makes that request a
 * cache hit with zero filesystem work.  Concurrent calls dedupe on a single
 * `inflight` promise so a cold-start burst does not fan out to `N × 800`
 * parallel file reads.
 */
export function loadConditionCatalogAsync(): Promise<ConditionCatalog> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = readCatalog().then(
    (catalog) => {
      cached = catalog;
      inflight = null;
      return catalog;
    },
    (error) => {
      inflight = null;
      throw error;
    },
  );
  return inflight;
}

/**
 * Sync read with cache — remains the request-path entry point so existing
 * callers (`force-dynamic` pages, `kb:validate` scripts, `vitest` suites)
 * keep their current sync contract without an `await` migration.
 *
 * After an `instrumentation.ts` warmup, this is a pure memory return.
 */
export function loadConditionCatalog(): ConditionCatalog {
  if (cached) return cached;

  const files = fs
    .readdirSync(CATALOG_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort();

  const conditions: CatalogCondition[] = [];
  const seen = new Map<string, string>();

  for (const file of files) {
    const raw = fs.readFileSync(path.join(CATALOG_DIR, file), "utf8");
    const parsed = catalogFileSchema.safeParse(JSON.parse(raw));

    if (!parsed.success) {
      console.error(`[catalog] Invalid catalog file ${file}:`, parsed.error.message);
      throw new Error(`Invalid catalog file ${file}: ${parsed.error.message}`);
    }

    for (const condition of parsed.data.conditions) {
      const previous = seen.get(condition.id);
      if (previous) {
        console.error(`[catalog] Duplicate condition id "${condition.id}" in ${file}; already defined in ${previous}.`);
        throw new Error(
          `Duplicate condition id "${condition.id}" in ${file}; already defined in ${previous}.`,
        );
      }
      seen.set(condition.id, file);
      conditions.push(condition);
    }
  }

  cached = conditionCatalogSchema.parse(conditions);
  return cached;
}

/** Test seam: clears the module-level cache (sync + async). */
export function resetConditionCatalogCache(): void {
  cached = null;
  inflight = null;
}
