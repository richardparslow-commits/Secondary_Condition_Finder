import "server-only";

import fs from "node:fs";
import path from "node:path";

import {
  catalogFileSchema,
  conditionCatalogSchema,
  type CatalogCondition,
  type ConditionCatalog,
} from "./schema";

const CATALOG_DIR = path.join(process.cwd(), "data", "conditions");

let cached: ConditionCatalog | null = null;

/** Reads and validates every catalog file. Duplicate ids are a hard error. */
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
      throw new Error(`Invalid catalog file ${file}: ${parsed.error.message}`);
    }

    for (const condition of parsed.data.conditions) {
      const previous = seen.get(condition.id);
      if (previous) {
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

/** Test seam: clears the module-level cache. */
export function resetConditionCatalogCache(): void {
  cached = null;
}
