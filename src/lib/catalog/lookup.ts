import type { CatalogCondition, ConditionCatalog } from "./schema";

const byIdCache = new WeakMap<ConditionCatalog, Map<string, CatalogCondition>>();

/** Collapses case, trims, and squeezes internal whitespace. */
export function normalizeConditionName(condition: string): string {
  return condition.trim().toLowerCase().split(/\s+/).filter(Boolean).join(" ");
}

/** Id-keyed index for resolving display names without repeated scans. */
export function indexById(
  catalog: ConditionCatalog,
): Map<string, CatalogCondition> {
  const cached = byIdCache.get(catalog);
  if (cached) return cached;
  const index = new Map(catalog.map((condition) => [condition.id, condition]));
  byIdCache.set(catalog, index);
  return index;
}

/**
 * Resolves free-text input to a catalog condition by id, name, or alias.
 * Exact match only. Fuzzy matching is deliberately out of scope: silently
 * resolving "knee" to the wrong entry is worse than returning nothing.
 */
export function findCondition(
  catalog: ConditionCatalog,
  input: string,
): CatalogCondition | null {
  const normalized = normalizeConditionName(input);
  if (!normalized) return null;

  return (
    catalog.find((condition) => {
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

/** Conditions grouped by body system, both sorted for stable display. */
export function groupByBodySystem(
  catalog: ConditionCatalog,
): [string, CatalogCondition[]][] {
  const groups = new Map<string, CatalogCondition[]>();
  for (const condition of catalog) {
    groups.set(condition.bodySystem, [
      ...(groups.get(condition.bodySystem) ?? []),
      condition,
    ]);
  }
  return [...groups.entries()]
    .map(
      ([system, items]) =>
        [system, [...items].sort((a, b) => a.name.localeCompare(b.name))] as [
          string,
          CatalogCondition[],
        ],
    )
    .sort((a, b) => a[0].localeCompare(b[0]));
}
