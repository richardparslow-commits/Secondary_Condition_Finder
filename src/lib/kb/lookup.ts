import type { KnowledgeBase, ConditionMapping } from "./schema";

const publishedMappingsCache = new WeakMap<KnowledgeBase, [string, ConditionMapping][]>();
const mappedConditionIdsCache = new WeakMap<KnowledgeBase, string[]>();
const secondaryTargetIndexCache = new WeakMap<KnowledgeBase, [string, string[]][]>();

/** Published mappings, keyed by catalog id. Excludes drafts. */
export function publishedMappings(
  kb: KnowledgeBase,
): Map<string, ConditionMapping> {
  const cached = publishedMappingsCache.get(kb);
  if (cached) return new Map(cached);
  const mappings = kb
    .filter((mapping) => !mapping.draft)
    .map((mapping) => [mapping.id, mapping] as [string, ConditionMapping]);
  publishedMappingsCache.set(kb, mappings);
  return new Map(mappings);
}

/** Ids that have published mappings, so intake can show which are covered. */
export function mappedConditionIds(kb: KnowledgeBase): Set<string> {
  const cached = mappedConditionIdsCache.get(kb);
  if (cached) return new Set(cached);
  const ids = kb.filter((mapping) => !mapping.draft).map((mapping) => mapping.id);
  mappedConditionIdsCache.set(kb, ids);
  return new Set(ids);
}

/** Draft mappings awaiting human-authored content. For tooling and review. */
export function draftMappings(kb: KnowledgeBase): ConditionMapping[] {
  return kb.filter((mapping) => mapping.draft);
}

/**
 * Secondary-target index: for each condition id that appears as a published
 * secondary suggestion, the sorted ids of the published primaries mapping to
 * it. Draft mappings are excluded, matching recommendation output. This is a
 * display-only index for research-cue surfaces (e.g. the presumptive results
 * cross-link panel); it is never fed into recommend().
 */
export function secondaryTargetIndex(kb: KnowledgeBase): Map<string, string[]> {
  const cached = secondaryTargetIndexCache.get(kb);
  if (cached) {
    return new Map(cached.map(([conditionId, primaryIds]) => [conditionId, [...primaryIds]]));
  }
  const index = new Map<string, string[]>();
  for (const mapping of kb) {
    if (mapping.draft) continue;
    for (const suggestion of mapping.suggestions) {
      const entry = index.get(suggestion.conditionId);
      if (entry) {
        if (!entry.includes(mapping.id)) entry.push(mapping.id);
      } else {
        index.set(suggestion.conditionId, [mapping.id]);
      }
    }
  }
  for (const entry of index.values()) entry.sort();
  const entries: [string, string[]][] = [...index.entries()]
    .map(([conditionId, primaryIds]) => [conditionId, [...primaryIds]]);
  secondaryTargetIndexCache.set(kb, entries);
  return new Map(entries.map(([conditionId, primaryIds]) => [conditionId, [...primaryIds]]));
}
