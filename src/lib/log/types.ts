/**
 * Data-minimized traceability record for a recommendation run.
 *
 * Health-condition identifiers, intake free text, symptoms, medications,
 * exposures, diagnoses, and recommendation identifiers must never be persisted
 * in this operational event stream. Only aggregate counts needed for basic
 * service diagnostics are retained.
 */
export interface RecommendationEvent {
  id: string;
  createdAt: string;
  recognizedPrimaryCount: number;
  unrecognizedPrimaryCount: number;
  recommendedConditionCount: number;
  engineVersion: string;
}

export interface EventLogger {
  record(event: RecommendationEvent): void;
  recent(limit: number): RecommendationEvent[];
}
