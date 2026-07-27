import type { KnowledgeBase, ConditionMapping } from "./schema";

/** Published mappings, keyed by catalog id. Excludes drafts. */
export function publishedMappings(
  kb: KnowledgeBase,
): Map<string, ConditionMapping> {
  return new Map(
    kb.filter((mapping) => !mapping.draft).map((mapping) => [mapping.id, mapping]),
  );
}

/** Ids that have published mappings, so intake can show which are covered. */
export function mappedConditionIds(kb: KnowledgeBase): Set<string> {
  return new Set(
    kb.filter((mapping) => !mapping.draft).map((mapping) => mapping.id),
  );
}

/** Draft mappings awaiting human-authored content. For tooling and review. */
export function draftMappings(kb: KnowledgeBase): ConditionMapping[] {
  return kb.filter((mapping) => mapping.draft);
}
