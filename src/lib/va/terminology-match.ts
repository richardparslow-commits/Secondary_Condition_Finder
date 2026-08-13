export interface VaReferenceTerm {
  id: string;
  name: string;
}

function normalizeTerm(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function matchExactVaReferenceTerm(
  conditionName: string,
  items: VaReferenceTerm[],
): VaReferenceTerm | null {
  const normalized = normalizeTerm(conditionName);
  if (!normalized) return null;

  return items.find((item) => normalizeTerm(item.name) === normalized) ?? null;
}
