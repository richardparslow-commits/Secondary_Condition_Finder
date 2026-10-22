import "server-only";

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import { hasDataFilesystem } from "@/lib/data/data-runtime";
import { embeddedDataFiles } from "@/lib/data/embedded-data";
import { parseDataJson } from "@/lib/data/parse-json";

import {
  exposureCatalogSchema,
  exposureCategorySchema,
  type ExposureCatalog,
  type ExposureCategory,
} from "./schema";

const PRESUMPTIVES_DIR = path.join(process.cwd(), "data", "presumptives");

let cached: ExposureCatalog | null = null;
let inflight: Promise<ExposureCatalog> | null = null;

/**
 * Parse one exposure category into the shared accumulator.
 *
 * Shared by the disk and embedded sources so both apply the same schema and
 * filename↔id refusal, with the identity message the disk path has always
 * produced.
 */
function appendExposureFile(file: string, raw: string, categories: ExposureCategory[]): void {
  const parsed = exposureCategorySchema.safeParse(parseDataJson(raw));

  if (!parsed.success) {
    console.error("[presumptive] Invalid exposure category data");
    throw new Error(`Invalid exposure category in ${file}.`);
  }

  const expectedId = path.basename(file, ".json");
  if (parsed.data.id !== expectedId) {
    console.error("[presumptive] Exposure category identity mismatch");
    throw new Error(`Exposure category identity mismatch in ${file}.`);
  }

  categories.push(parsed.data);
}

/**
 * Reads and validates every exposure category. Validation failures throw
 * rather than degrade: a malformed date window would silently change who the
 * app tells a veteran they might be eligible under.
 */
async function readExposureCatalog(): Promise<ExposureCatalog> {
  const categories: ExposureCategory[] = [];

  if (!hasDataFilesystem()) {
    for (const [file, raw] of embeddedDataFiles("presumptives")) {
      appendExposureFile(file, raw, categories);
    }
    return exposureCatalogSchema.parse(categories);
  }

  const files = (await fsp.readdir(PRESUMPTIVES_DIR))
    .filter((file) => file.endsWith(".json"))
    .sort();

  for (const file of files) {
    const raw = await fsp.readFile(path.join(PRESUMPTIVES_DIR, file), "utf8");
    appendExposureFile(file, raw, categories);
  }

  return exposureCatalogSchema.parse(categories);
}

export function loadExposureCatalogAsync(): Promise<ExposureCatalog> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = readExposureCatalog().then(
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

export function loadExposureCatalog(): ExposureCatalog {
  if (cached) return cached;

  const categories: ExposureCategory[] = [];

  if (!hasDataFilesystem()) {
    for (const [file, raw] of embeddedDataFiles("presumptives")) {
      appendExposureFile(file, raw, categories);
    }
    cached = exposureCatalogSchema.parse(categories);
    return cached;
  }

  const files = fs
    .readdirSync(PRESUMPTIVES_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort();

  for (const file of files) {
    const raw = fs.readFileSync(path.join(PRESUMPTIVES_DIR, file), "utf8");
    appendExposureFile(file, raw, categories);
  }

  cached = exposureCatalogSchema.parse(categories);
  return cached;
}

/** Test seam: clears the module-level cache (sync + async). */
export function resetExposureCatalogCache(): void {
  cached = null;
  inflight = null;
}
