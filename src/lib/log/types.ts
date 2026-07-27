/**
 * Traceability record for a single recommendation run.
 *
 * Phase 1 stores no personally identifying information. Intake free text is
 * NOT persisted: only the resolved condition names and counts, which is
 * enough to explain why a given set of suggestions was produced.
 */
export interface RecommendationEvent {
  id: string;
  createdAt: string;
  recognizedPrimaries: string[];
  unrecognizedPrimaryCount: number;
  recommendedConditions: string[];
  engineVersion: string;
}

export interface EventLogger {
  record(event: RecommendationEvent): void;
  recent(limit: number): RecommendationEvent[];
}
