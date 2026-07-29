import { describe, it, expect } from 'vitest';
import { sanitizeAndValidateEventPayload } from '../src/lib/events/privacy-guard';

describe('Event Logger Privacy & Schema Evolution Suite', () => {
  it('detects and strips prohibited intake free text and PII fields', () => {
    const maliciousPayload = {
      eventType: 'WIZARD_STEP_VIEW',
      timestamp: new Date().toISOString(),
      freeText: 'Patient reports severe lumbar pain radiating down left leg',
      ssn: '123-45-6789',
      metadata: {
        rawNotes: 'Confidential doctor notes here',
        step: 2
      }
    };

    const result = sanitizeAndValidateEventPayload(maliciousPayload);

    expect(result.isValid).toBe(false);
    expect(result.violations).toContain('freeText');
    expect(result.violations).toContain('ssn');
    expect(result.violations).toContain('metadata.rawNotes');

    // Ensure sanitized payload has zero persistence of stripped fields
    expect(result.sanitizedPayload.freeText).toBeUndefined();
    expect(result.sanitizedPayload.ssn).toBeUndefined();
    expect((result.sanitizedPayload.metadata as Record<string, unknown>)?.rawNotes).toBeUndefined();
    expect(result.sanitizedPayload.metadata?.step).toBe(2);
  });

  it('allows clean, non-prohibited event payloads', () => {
    const cleanPayload = {
      eventType: 'CONDITION_SELECTED',
      timestamp: new Date().toISOString(),
      metadata: {
        conditionId: 'sleep-apnea',
        category: 'respiratory'
      }
    };

    const result = sanitizeAndValidateEventPayload(cleanPayload);
    expect(result.isValid).toBe(true);
    expect(result.violations.length).toBe(0);
    expect(result.sanitizedPayload).toEqual(cleanPayload);
  });
});
