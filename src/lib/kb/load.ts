import "server-only";

import fs from "node:fs";
import path from "node:path";

import { loadConditionCatalog } from "@/lib/catalog/load";

import {
  conditionMappingSchema,
  knowledgeBaseSchema,
  type ConditionMapping,
  type KnowledgeBase,
} from "./schema";
import { assertNoForbiddenPhrases, validateKnowledgeBaseAgainstCatalog } from "./validate";

const KB_DIR = path.join(process.cwd(), "data", "knowledge-base");

let cached: KnowledgeBase | null = null;

/**
 * Reads and validates every mapping file.
 *
 * Validation failures throw rather than degrade. A malformed mapping in a
 * claims tool is a correctness problem, not something to silently skip.
 */
export function loadKnowledgeBase(): KnowledgeBase {
  if (cached) return cached;

  const files = fs
    .readdirSync(KB_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort();

  const mappings: ConditionMapping[] = files.map((file) => {
    const raw = fs.readFileSync(path.join(KB_DIR, file), "utf8");
    const parsed = conditionMappingSchema.safeParse(JSON.parse(raw));

    if (!parsed.success) {
      throw new Error(`Invalid mapping in ${file}: ${parsed.error.message}`);
    }

    const expectedId = path.basename(file, ".json");
    if (parsed.data.id !== expectedId) {
      throw new Error(
        `Mapping id mismatch in ${file}: id is "${parsed.data.id}", expected "${expectedId}".`,
      );
    }

    return parsed.data;
  });

  const parsed = knowledgeBaseSchema.parse(mappings);
  validateKnowledgeBaseAgainstCatalog(loadConditionCatalog(), parsed);
  assertNoForbiddenPhrases(parsed);
  cached = parsed;
  return cached;
}

/** Test seam: clears the module-level cache. */
export function resetKnowledgeBaseCache(): void {
  cached = null;
}
