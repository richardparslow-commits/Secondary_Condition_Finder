import type { KnowledgeBase, PrimaryCondition } from "./schema";

/** Collapses case, trims, and squeezes internal whitespace. */
export function normalizeConditionName(condition: string): string {
  return condition.trim().toLowerCase().split(/\s+/).filter(Boolean).join(" ");
}

/**
 * Resolves free-text input to a primary condition by id, name, or alias.
 * Exact match only. Fuzzy matching is deliberately out of scope for Phase 1:
 * silently resolving "knee" to the wrong entry is worse than returning nothing.
 */
export function findPrimaryCondition(
  kb: KnowledgeBase,
  input: string,
): PrimaryCondition | null {
  const normalized = normalizeConditionName(input);
  if (!normalized) return null;

  return (
    kb.find((condition) => {
      const candidates = [
        condition.id,
        condition.id.replace(/-/g, " "),
        condition.name,
        ...condition.aliases,
      ];
      return candidates.some(
        (candidate) => normalizeConditionName(candidate) === normalized,
      );
    }) ?? null
  );
}

/** All supported primary conditions, sorted by display name. */
export function listPrimaryConditions(kb: KnowledgeBase): PrimaryCondition[] {
  return [...kb].sort((a, b) => a.name.localeCompare(b.name));
}
