import "server-only";

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import { loadConditionCatalog, loadConditionCatalogAsync } from "@/lib/catalog/load";
import { hasDataFilesystem } from "@/lib/data/data-runtime";
import { embeddedDataFiles } from "@/lib/data/embedded-data";
import { parseDataJson } from "@/lib/data/parse-json";

import {
  conditionMappingSchema,
  knowledgeBaseSchema,
  type ConditionMapping,
  type KnowledgeBase,
} from "./schema";
import { assertNoForbiddenPhrases, validateKnowledgeBaseAgainstCatalog } from "./validate";

const KB_DIR = path.join(process.cwd(), "data", "knowledge-base");
// Reads below keep an explicit slash before each filename. Turbopack widens
// dynamic path joins to sibling directories during instrumentation tracing,
// which would ship retired mappings from knowledge-base-quarantine.

let cached: KnowledgeBase | null = null;
let publishedMappingIdsCached: Set<string> | null = null;
let inflightKb: Promise<KnowledgeBase> | null = null;
let inflightPublishedIds: Promise<Set<string>> | null = null;

/**
 * Parse and admit one mapping file into the shared accumulator.
 *
 * Shared by the disk and embedded sources so both enforce the same schema and
 * filename↔id identity, with the same fixed diagnostics. The id check is what
 * makes a mapping's filename part of its identity; skipping it on the embedded
 * path would ship a corpus whose files and ids could disagree.
 */
function appendMappingFile(file: string, raw: string, mappings: ConditionMapping[]): void {
  const parsed = conditionMappingSchema.safeParse(parseDataJson(raw));

  if (!parsed.success) {
    console.error("[knowledge-base] Invalid mapping data");
    throw new Error(`Invalid mapping in ${file}.`);
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

/**
 * Reads and validates every mapping file.
 *
 * Validation failures throw rather than degrade. A malformed mapping in a
 * claims tool is a correctness problem, not something to silently skip.
 */
async function readKnowledgeBase(): Promise<KnowledgeBase> {
  const mappings: ConditionMapping[] = [];

  if (!hasDataFilesystem()) {
    for (const [file, raw] of embeddedDataFiles("knowledgeBase")) {
      appendMappingFile(file, raw, mappings);
    }
  } else {
    const files = (await fsp.readdir(KB_DIR))
      .filter((file) => file.endsWith(".json"))
      .sort();

    for (const file of files) {
      const raw = await fsp.readFile(`${KB_DIR}/${file}`, "utf8");
      appendMappingFile(file, raw, mappings);
    }
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

  const mappings: ConditionMapping[] = [];

  if (!hasDataFilesystem()) {
    for (const [file, raw] of embeddedDataFiles("knowledgeBase")) {
      appendMappingFile(file, raw, mappings);
    }
  } else {
    const files = fs
      .readdirSync(KB_DIR)
      .filter((file) => file.endsWith(".json"))
      .sort();

    for (const file of files) {
      appendMappingFile(file, fs.readFileSync(`${KB_DIR}/${file}`, "utf8"), mappings);
    }
  }

  const parsed = knowledgeBaseSchema.parse(mappings);
  validateKnowledgeBaseAgainstCatalog(loadConditionCatalog(), parsed);
  assertNoForbiddenPhrases(parsed);
  cached = parsed;
  return cached;
}

/**
 * Admit one published id from raw mapping text.
 *
 * The published-index path deliberately skips the full schema: badges need only
 * `id` and `draft`, and a mapping the full loader would reject must not fail a
 * badge query. It still parses JSON, so malformed text throws exactly as it
 * does on the disk path.
 */
function appendPublishedId(raw: string, published: Set<string>): void {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;

  const id = (parsed as { id?: unknown }).id;
  const draft = (parsed as { draft?: unknown }).draft;
  if (typeof id !== "string" || id.length === 0) return;
  if (draft === true) return;
  published.add(id);
}

/**
 * Lightweight published-mapping index used by Step 1 "database mapped" badges.
 *
 * This avoids the full schema + cross-catalog validation path when callers only
 * need published ids. Full validation remains in loadKnowledgeBase().
 */
async function readPublishedMappingIds(): Promise<Set<string>> {
  const published = new Set<string>();

  if (!hasDataFilesystem()) {
    for (const [, raw] of embeddedDataFiles("knowledgeBase")) {
      appendPublishedId(raw, published);
    }
    return published;
  }

  const files = (await fsp.readdir(KB_DIR))
    .filter((file) => file.endsWith(".json"))
    .sort();

  for (const file of files) {
    const raw = await fsp.readFile(`${KB_DIR}/${file}`, "utf8");
    appendPublishedId(raw, published);
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

  const published = new Set<string>();

  if (!hasDataFilesystem()) {
    for (const [, raw] of embeddedDataFiles("knowledgeBase")) {
      appendPublishedId(raw, published);
    }
    publishedMappingIdsCached = published;
    return new Set(publishedMappingIdsCached);
  }

  const files = fs
    .readdirSync(KB_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort();

  for (const file of files) {
    appendPublishedId(fs.readFileSync(`${KB_DIR}/${file}`, "utf8"), published);
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
