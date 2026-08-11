/**
 * Event Logging Privacy & Schema Evolution Guard
 * Ensures zero persistence of intake free text, health-condition identifiers,
 * clinical notes, or PII.
 */

export const PROHIBITED_LOG_FIELDS = [
  "freeText",
  "rawNotes",
  "patientName",
  "ssn",
  "diagnosisNotes",
  "medicalHistoryText",
  "userInputValue",
  "conditionId",
  "conditionIds",
  "diagnosis",
  "diagnoses",
  "primaryCondition",
  "primaryConditions",
  "recognizedPrimaries",
  "recommendedCondition",
  "recommendedConditions",
  "symptoms",
  "medications",
  "exposures",
  "notes",
] as const;

export interface EventPayload {
  eventType: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export function sanitizeAndValidateEventPayload(payload: EventPayload): {
  isValid: boolean;
  sanitizedPayload: EventPayload;
  violations: string[];
} {
  const violations: string[] = [];
  const sanitizedPayload: EventPayload = {
    ...payload,
    metadata: payload.metadata ? { ...payload.metadata } : undefined,
  };

  PROHIBITED_LOG_FIELDS.forEach((field) => {
    if (field in sanitizedPayload) {
      violations.push(field);
      delete sanitizedPayload[field];
    }
    if (sanitizedPayload.metadata && field in sanitizedPayload.metadata) {
      violations.push(`metadata.${field}`);
      delete sanitizedPayload.metadata[field];
    }
  });

  return {
    isValid: violations.length === 0,
    sanitizedPayload,
    violations,
  };
}
