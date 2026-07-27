import "server-only";

import fs from "node:fs";
import path from "node:path";

import {
  knowledgeBaseSchema,
  primaryConditionSchema,
  type KnowledgeBase,
  type PrimaryCondition,
} from "./schema";

const KB_DIR = path.join(process.cwd(), "data", "knowledge-base");

let cached: KnowledgeBase | null = null;

/**
 * Reads and validates every knowledge base file.
 *
 * Validation failures throw rather than degrade. A malformed condition entry in
 * a claims tool is a correctness problem, not something to silently skip.
 */
export function loadKnowledgeBase(): KnowledgeBase {
  if (cached) return cached;

  const files = fs
    .readdirSync(KB_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort();

  const conditions: PrimaryCondition[] = files.map((file) => {
    const raw = fs.readFileSync(path.join(KB_DIR, file), "utf8");
    const parsed = primaryConditionSchema.safeParse(JSON.parse(raw));

    if (!parsed.success) {
      throw new Error(
        `Invalid knowledge base entry in ${file}: ${parsed.error.message}`,
      );
    }

    const expectedId = path.basename(file, ".json");
    if (parsed.data.id !== expectedId) {
      throw new Error(
        `Knowledge base id mismatch in ${file}: id is "${parsed.data.id}", expected "${expectedId}".`,
      );
    }

    return parsed.data;
  });

  cached = knowledgeBaseSchema.parse(conditions);
  return cached;
}

/** Test seam: clears the module-level cache. */
export function resetKnowledgeBaseCache(): void {
  cached = null;
}
