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
  "lymphoma",
  "melanoma",
  "leukemia",
  "multiple-myeloma"
]);

export function isExposureRelated(conditionId: string): boolean {
  return TOXIC_EXPOSURE_CONDITION_IDS.has(conditionId);
}
