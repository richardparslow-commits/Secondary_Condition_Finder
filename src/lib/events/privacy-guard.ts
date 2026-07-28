/**
 * Event Logging Privacy & Schema Evolution Guard
 * Ensures zero persistence of intake free text, clinical notes, or PII.
 */

export const PROHIBITED_LOG_FIELDS = [
  "freeText",
  "rawNotes",
  "patientName",
  "ssn",
  "diagnosisNotes",
  "medicalHistoryText",
  "userInputValue"
];

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
  const sanitizedPayload: EventPayload = { ...payload };

  PROHIBITED_LOG_FIELDS.forEach(field => {
    if (field in sanitizedPayload) {
      violations.push(field);
      delete sanitizedPayload[field];
    }
    if (sanitizedPayload.metadata && typeof sanitizedPayload.metadata === 'object') {
      if (field in sanitizedPayload.metadata) {
        violations.push(`metadata.${field}`);
        delete (sanitizedPayload.metadata as Record<string, unknown>)[field];
      }
    }
  });

  return {
    isValid: violations.length === 0,
    sanitizedPayload,
    violations
  };
}
