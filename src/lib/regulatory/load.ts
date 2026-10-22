import "server-only";

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import { hasDataFilesystem } from "@/lib/data/data-runtime";
import { embeddedDataFiles } from "@/lib/data/embedded-data";
import { parseDataJson } from "@/lib/data/parse-json";

import { regulatoryActionRegistrySchema, regulatoryActionSchema, type RegulatoryAction, type RegulatoryActionRegistry } from "./schema";

const REGULATORY_DIR = path.join(process.cwd(), "data", "regulatory-actions");
let cached: RegulatoryActionRegistry | null = null;
let inflight: Promise<RegulatoryActionRegistry> | null = null;

/**
 * Parse one regulatory action file and return it.
 *
 * Shared by the disk and embedded sources: same schema, same filename↔RIN
 * refusal, same fixed diagnostics. The filename is upper-cased for the RIN
 * comparison because the authored files are lower-case (`va-2024-vba-01.json`).
 */
function parseRegulatoryAction(file: string, raw: string): RegulatoryAction {
  const parsed = regulatoryActionSchema.safeParse(parseDataJson(raw));
  if (!parsed.success) { console.error("[regulatory] Invalid regulatory action data"); throw new Error(`Invalid regulatory action in ${file}.`); }
  const expected = path.basename(file, ".json").toUpperCase();
  if (parsed.data.rin !== expected) { console.error("[regulatory] Regulatory action identity mismatch"); throw new Error(`Regulatory action identity mismatch in ${file}.`); }
  return parsed.data;
}

async function readRegulatoryActionRegistry(): Promise<RegulatoryActionRegistry> {
  if (!hasDataFilesystem()) {
    return regulatoryActionRegistrySchema.parse(
      embeddedDataFiles("regulatoryActions").map(([file, raw]) => parseRegulatoryAction(file, raw)),
    );
  }

  try {
    await fsp.access(REGULATORY_DIR);
  } catch {
    return [];
  }

  const files = (await fsp.readdir(REGULATORY_DIR)).filter((file) => file.endsWith(".json") && !file.startsWith("_")).sort();
  const actions: RegulatoryAction[] = [];
  for (const file of files) {
    const raw = await fsp.readFile(path.join(REGULATORY_DIR, file), "utf8");
    actions.push(parseRegulatoryAction(file, raw));
  }

  return regulatoryActionRegistrySchema.parse(actions);
}

export function loadRegulatoryActionRegistryAsync(): Promise<RegulatoryActionRegistry> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = readRegulatoryActionRegistry().then(
    (registry) => {
      cached = registry;
      inflight = null;
      return registry;
    },
    (error) => {
      inflight = null;
      throw error;
    },
  );
  return inflight;
}

export function loadRegulatoryActionRegistry(): RegulatoryActionRegistry {
  if (cached) return cached;

  if (!hasDataFilesystem()) {
    cached = regulatoryActionRegistrySchema.parse(
      embeddedDataFiles("regulatoryActions").map(([file, raw]) => parseRegulatoryAction(file, raw)),
    );
    return cached;
  }

  if (!fs.existsSync(REGULATORY_DIR)) return [];

  const files = fs.readdirSync(REGULATORY_DIR).filter((file) => file.endsWith(".json") && !file.startsWith("_")).sort();
  const actions: RegulatoryAction[] = files.map((file) => parseRegulatoryAction(file, fs.readFileSync(path.join(REGULATORY_DIR, file), "utf8")));

  cached = regulatoryActionRegistrySchema.parse(actions);
  return cached;
}

export function resetRegulatoryActionRegistryCache(): void {
  cached = null;
  inflight = null;
}
