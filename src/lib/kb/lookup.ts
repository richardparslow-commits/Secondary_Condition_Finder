import type { KnowledgeBase, ConditionMapping } from "./schema";

const publishedMappingsCache = new WeakMap<KnowledgeBase, Map<string, ConditionMapping>>();
const mappedConditionIdsCache = new WeakMap<KnowledgeBase, Set<string>>();
const secondaryTargetIndexCache = new WeakMap<KnowledgeBase, Map<string, string[]>>();

/** Published mappings, keyed by catalog id. Excludes drafts. */
export function publishedMappings(
  kb: KnowledgeBase,
): Map<string, ConditionMapping> {
  const cached = publishedMappingsCache.get(kb);
  if (cached) return cached;
  const mappings = new Map(
    kb.filter((mapping) => !mapping.draft).map((mapping) => [mapping.id, mapping]),
  );
  publishedMappingsCache.set(kb, mappings);
  return mappings;
}

/** Ids that have published mappings, so intake can show which are covered. */
export function mappedConditionIds(kb: KnowledgeBase): Set<string> {
  const cached = mappedConditionIdsCache.get(kb);
  if (cached) return cached;
  const ids = new Set(
    kb.filter((mapping) => !mapping.draft).map((mapping) => mapping.id),
  );
  mappedConditionIdsCache.set(kb, ids);
  return ids;
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
  if (cached) return cached;
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
  secondaryTargetIndexCache.set(kb, index);
  return index;
}
