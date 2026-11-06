import type { CatalogCondition, ConditionCatalog } from "./schema";

const byNameCache = new WeakMap<ConditionCatalog, Map<string, CatalogCondition>>();
const byIdEntriesCache = new WeakMap<ConditionCatalog, [string, CatalogCondition][]>();

/** Collapses case, trims, and squeezes internal whitespace. */
export function normalizeConditionName(condition: string): string {
  return condition.trim().toLowerCase().split(/\s+/).filter(Boolean).join(" ");
}

/** Id-keyed index for resolving display names without repeated scans. */
export function indexById(
  catalog: ConditionCatalog,
): Map<string, CatalogCondition> {
  const cachedEntries = byIdEntriesCache.get(catalog);
  if (cachedEntries) return new Map(cachedEntries);
  const entries = catalog.map((condition) => [condition.id, condition] as [string, CatalogCondition]);
  byIdEntriesCache.set(catalog, entries);
  return new Map(entries);
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

  let index = byNameCache.get(catalog);
  if (!index) {
    index = new Map();
    for (const condition of catalog) {
      const names = [
        condition.id,
        condition.id.replace(/-/g, " "),
        condition.name,
        ...condition.aliases,
      ];
      for (const name of names) {
        const key = normalizeConditionName(name);
        // Keep the first catalog match, including aliases shared by custom catalogs.
        if (!index.has(key)) index.set(key, condition);
      }
    }
    byNameCache.set(catalog, index);
  }
  return index.get(normalized) ?? null;
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
