// PACT Act Master List (Public Law 117-168)
export const PACT_ACT_CONDITIONS = new Set([
  "asthma", "chronic-bronchitis", "chronic-rhinitis", "chronic-sinusitis",
  "copd", "emphysema", "granulomatous-disease", "interstitial-lung-disease",
  "pleuritis", "pulmonary-fibrosis", "sarcoidosis", "brain-cancer",
  "gastrointestinal-cancer", "glioblastoma", "head-cancer", "kidney-cancer",
  "lymphoma", "melanoma", "neck-cancer", "pancreatic-cancer",
  "reproductive-cancer", "respiratory-cancer", "urinary-bladder-cancer"
]);

// 38 U.S.C. § 1119 Covered Locations
export const COVERED_PACT_LOCATIONS = [
  "iraq", "afghanistan", "kuwait", "saudi arabia", "djibouti",
  "syria", "jordan", "egypt", "lebanon", "yemen", "oman", "uae",
  "bahrain", "qatar", "somalia", "uzbekistan"
];

export interface PactActPresumptiveMatch {
  conditionId: string;
  isPresumptive: boolean;
  exposureCategory: 'burn_pit';
  cfrCitation: string;
  requiresTeraReview: boolean;
}

export function evaluatePactActEligibility(
  conditionId: string,
  serviceLocations: string[]
): PactActPresumptiveMatch | null {
  if (!PACT_ACT_CONDITIONS.has(conditionId)) return null;

  const isCoveredLocation = serviceLocations.some(loc => 
    COVERED_PACT_LOCATIONS.includes(loc.toLowerCase())
  );

  return {
    conditionId,
    isPresumptive: isCoveredLocation,
    exposureCategory: 'burn_pit',
    cfrCitation: '38 U.S.C. § 1119 / 38 CFR § 3.320',
    // If they have the condition but not the geographic location, 
    // it mandates a Toxic Exposure Risk Activity (TERA) review.
    requiresTeraReview: !isCoveredLocation 
  };
}
