import "server-only";

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import { loadConditionCatalog, loadConditionCatalogAsync } from "@/lib/catalog/load";

import {
  conditionMappingSchema,
  knowledgeBaseSchema,
  type ConditionMapping,
  type KnowledgeBase,
} from "./schema";
import { assertNoForbiddenPhrases, validateKnowledgeBaseAgainstCatalog } from "./validate";

const KB_DIR = path.join(process.cwd(), "data", "knowledge-base");

let cached: KnowledgeBase | null = null;
let publishedMappingIdsCached: Set<string> | null = null;
let inflightKb: Promise<KnowledgeBase> | null = null;
let inflightPublishedIds: Promise<Set<string>> | null = null;

/**
 * Reads and validates every mapping file.
 *
 * Validation failures throw rather than degrade. A malformed mapping in a
 * claims tool is a correctness problem, not something to silently skip.
 */
async function readKnowledgeBase(): Promise<KnowledgeBase> {
  const files = (await fsp.readdir(KB_DIR))
    .filter((file) => file.endsWith(".json"))
    .sort();

  const mappings: ConditionMapping[] = [];
  for (const file of files) {
    const raw = await fsp.readFile(path.join(KB_DIR, file), "utf8");
    const parsed = conditionMappingSchema.safeParse(JSON.parse(raw));

    if (!parsed.success) {
      console.error(`[knowledge-base] Invalid mapping in ${file}:`, parsed.error.message);
      throw new Error(`Invalid mapping in ${file}: ${parsed.error.message}`);
    }

    const expectedId = path.basename(file, ".json");
    if (parsed.data.id !== expectedId) {
      console.error(`[knowledge-base] Mapping id mismatch in ${file}: id is "${parsed.data.id}", expected "${expectedId}".`);
      throw new Error(
        `Mapping id mismatch in ${file}: id is "${parsed.data.id}", expected "${expectedId}".`,
      );
    }

    mappings.push(parsed.data);
  }

  const parsed = knowledgeBaseSchema.parse(mappings);
  validateKnowledgeBaseAgainstCatalog(await loadConditionCatalogAsync(), parsed);
  assertNoForbiddenPhrases(parsed);
  return parsed;
}

export function loadKnowledgeBaseAsync(): Promise<KnowledgeBase> {
  if (cached) return Promise.resolve(cached);
  if (inflightKb) return inflightKb;
  inflightKb = readKnowledgeBase().then(
    (kb) => {
      cached = kb;
      inflightKb = null;
      return kb;
    },
    (error) => {
      inflightKb = null;
      throw error;
    },
  );
  return inflightKb;
}

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
      console.error(`[knowledge-base] Invalid mapping in ${file}:`, parsed.error.message);
      throw new Error(`Invalid mapping in ${file}: ${parsed.error.message}`);
    }

    const expectedId = path.basename(file, ".json");
    if (parsed.data.id !== expectedId) {
      console.error(`[knowledge-base] Mapping id mismatch in ${file}: id is "${parsed.data.id}", expected "${expectedId}".`);
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

/**
 * Lightweight published-mapping index used by Step 1 "database mapped" badges.
 *
 * This avoids the full schema + cross-catalog validation path when callers only
 * need published ids. Full validation remains in loadKnowledgeBase().
 */
async function readPublishedMappingIds(): Promise<Set<string>> {
  const files = (await fsp.readdir(KB_DIR))
    .filter((file) => file.endsWith(".json"))
    .sort();

  const published = new Set<string>();
  for (const file of files) {
    const raw = await fsp.readFile(path.join(KB_DIR, file), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;

    const id = (parsed as { id?: unknown }).id;
    const draft = (parsed as { draft?: unknown }).draft;
    if (typeof id !== "string" || id.length === 0) continue;
    if (draft === true) continue;
    published.add(id);
  }

  return published;
}

export function loadPublishedMappingIdsAsync(): Promise<Set<string>> {
  if (publishedMappingIdsCached) return Promise.resolve(new Set(publishedMappingIdsCached));
  if (inflightPublishedIds) return inflightPublishedIds.then((s) => new Set(s));
  inflightPublishedIds = readPublishedMappingIds().then(
    (published) => {
      publishedMappingIdsCached = published;
      inflightPublishedIds = null;
      return published;
    },
    (error) => {
      inflightPublishedIds = null;
      throw error;
    },
  );
  return inflightPublishedIds.then((s) => new Set(s));
}

export function loadPublishedMappingIds(): Set<string> {
  if (publishedMappingIdsCached) return new Set(publishedMappingIdsCached);

  const files = fs
    .readdirSync(KB_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort();

  const published = new Set<string>();
  for (const file of files) {
    const raw = fs.readFileSync(path.join(KB_DIR, file), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;

    const id = (parsed as { id?: unknown }).id;
    const draft = (parsed as { draft?: unknown }).draft;
    if (typeof id !== "string" || id.length === 0) continue;
    if (draft === true) continue;
    published.add(id);
  }

  publishedMappingIdsCached = published;
  return new Set(publishedMappingIdsCached);
}

/** Test seam: clears the module-level cache (sync + async). */
export function resetKnowledgeBaseCache(): void {
  cached = null;
  publishedMappingIdsCached = null;
  inflightKb = null;
  inflightPublishedIds = null;
}
