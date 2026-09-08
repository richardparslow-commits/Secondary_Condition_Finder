export const TOXIC_EXPOSURE_CONDITION_IDS = new Set([
  "asthma",
  "chronic-bronchitis",
  "copd",
  "chronic-rhinitis",
  "chronic-sinusitis",
  "bronchiolitis",
  "emphysema",
  "pulmonary-fibrosis",
  "sarcoidosis",
  "brain-cancer",
  "kidney-cancer",
  "hodgkins-lymphoma",
  "non-hodgkins-lymphoma",
  // Melanoma is a PACT Act-covered skin cancer; the catalog entry for skin
  // cancer is the closest id that resolves.
  "skin-cancer",
  "leukemia",
  "multiple-myeloma",
]);

export function isExposureRelated(conditionId: string): boolean {
  return TOXIC_EXPOSURE_CONDITION_IDS.has(conditionId);
}