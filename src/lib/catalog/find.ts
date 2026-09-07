/**
 * Catalog lookup entry point.
 *
 * Re-exports the lookup helpers so callers can resolve a catalog condition
 * from either `@/lib/catalog/lookup` or `@/lib/catalog/find`.
 */
export {
  findCondition,
  groupByBodySystem,
  indexById,
  normalizeConditionName,
} from "./lookup";
