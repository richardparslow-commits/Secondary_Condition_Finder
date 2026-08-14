import { matchExactVaReferenceTerm, type VaReferenceTerm } from "./terminology-match";

export interface LocalConditionReferenceKey {
  id: string;
  name: string;
}

export type VaConditionReferenceMatchKind = "exact" | "alias";

export interface VaConditionReferenceMatch {
  conditionId: string;
  conditionName: string;
  term: VaReferenceTerm | null;
  matchKind: VaConditionReferenceMatchKind | null;
}

export type VaReferenceAliasMap = Readonly<Record<string, readonly string[]>>;

/**
 * Curated aliases belong here only when a local label is known to correspond to
 * an administrative VA reference label. Keep this list explicit; do not add
 * fuzzy or semantic matching because a terminology match must not be mistaken
 * for medical or legal evidence.
 */
export const VA_REFERENCE_TERM_ALIASES: VaReferenceAliasMap = {};

export function mapConditionToVaReference(
  condition: LocalConditionReferenceKey,
  items: VaReferenceTerm[],
  aliases: VaReferenceAliasMap = VA_REFERENCE_TERM_ALIASES,
): VaConditionReferenceMatch {
  const exact = matchExactVaReferenceTerm(condition.name, items);
  if (exact) {
    return {
      conditionId: condition.id,
      conditionName: condition.name,
      term: exact,
      matchKind: "exact",
    };
  }

  for (const alias of aliases[condition.id] ?? []) {
    const aliasMatch = matchExactVaReferenceTerm(alias, items);
    if (aliasMatch) {
      return {
        conditionId: condition.id,
        conditionName: condition.name,
        term: aliasMatch,
        matchKind: "alias",
      };
    }
  }

  return {
    conditionId: condition.id,
    conditionName: condition.name,
    term: null,
    matchKind: null,
  };
}

export function buildConditionVaReferenceMap(
  conditions: LocalConditionReferenceKey[],
  items: VaReferenceTerm[],
  aliases: VaReferenceAliasMap = VA_REFERENCE_TERM_ALIASES,
): Map<string, VaConditionReferenceMatch> {
  return new Map(
    conditions.map((condition) => [
      condition.id,
      mapConditionToVaReference(condition, items, aliases),
    ]),
  );
}
