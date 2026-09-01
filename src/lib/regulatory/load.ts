import "server-only";

import fs from "node:fs";
import path from "node:path";

import { regulatoryActionRegistrySchema, regulatoryActionSchema, type RegulatoryAction, type RegulatoryActionRegistry } from "./schema";

const REGULATORY_DIR = path.join(process.cwd(), "data", "regulatory-actions");
let cached: RegulatoryActionRegistry | null = null;

export function loadRegulatoryActionRegistry(): RegulatoryActionRegistry {
  if (cached) return cached;
  if (!fs.existsSync(REGULATORY_DIR)) return [];

  const files = fs.readdirSync(REGULATORY_DIR).filter((file) => file.endsWith(".json") && !file.startsWith("_")).sort();
  const actions: RegulatoryAction[] = files.map((file) => {
    const raw = JSON.parse(fs.readFileSync(path.join(REGULATORY_DIR, file), "utf8"));
    const parsed = regulatoryActionSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`Invalid regulatory action in ${file}: ${parsed.error.message}`);
    const expected = path.basename(file, ".json").toUpperCase();
    if (parsed.data.rin !== expected) throw new Error(`Regulatory action id mismatch in ${file}: RIN is ${parsed.data.rin}, expected ${expected}.`);
    return parsed.data;
  });

  cached = regulatoryActionRegistrySchema.parse(actions);
  return cached;
}

export function resetRegulatoryActionRegistryCache(): void {
  cached = null;
}
