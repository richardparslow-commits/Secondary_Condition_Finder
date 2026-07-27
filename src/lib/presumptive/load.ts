import "server-only";

import fs from "node:fs";
import path from "node:path";

import {
  exposureCatalogSchema,
  exposureCategorySchema,
  type ExposureCatalog,
  type ExposureCategory,
} from "./schema";

const PRESUMPTIVES_DIR = path.join(process.cwd(), "data", "presumptives");

let cached: ExposureCatalog | null = null;

/**
 * Reads and validates every exposure category. Validation failures throw
 * rather than degrade: a malformed date window would silently change who the
 * app tells a veteran they might be eligible under.
 */
export function loadExposureCatalog(): ExposureCatalog {
  if (cached) return cached;

  const files = fs
    .readdirSync(PRESUMPTIVES_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort();

  const categories: ExposureCategory[] = files.map((file) => {
    const raw = fs.readFileSync(path.join(PRESUMPTIVES_DIR, file), "utf8");
    const parsed = exposureCategorySchema.safeParse(JSON.parse(raw));

    if (!parsed.success) {
      throw new Error(
        `Invalid exposure category in ${file}: ${parsed.error.message}`,
      );
    }

    const expectedId = path.basename(file, ".json");
    if (parsed.data.id !== expectedId) {
      throw new Error(
        `Exposure category id mismatch in ${file}: id is "${parsed.data.id}", expected "${expectedId}".`,
      );
    }

    return parsed.data;
  });

  cached = exposureCatalogSchema.parse(categories);
  return cached;
}

/** Test seam: clears the module-level cache. */
export function resetExposureCatalogCache(): void {
  cached = null;
}
