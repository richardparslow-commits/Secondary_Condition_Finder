import { describe, it, expect } from "vitest";
import { sanitizeAndValidateEventPayload } from "../src/lib/events/privacy-guard";

describe("Event Logger Privacy & Schema Evolution Suite", () => {
  it("detects and strips prohibited intake free text, PII, and health identifiers", () => {
    const maliciousPayload = {
      eventType: "WIZARD_STEP_VIEW",
      timestamp: new Date().toISOString(),
      freeText: "Patient reports severe lumbar pain radiating down left leg",
      ssn: "123-45-6789",
      metadata: {
        rawNotes: "Confidential doctor notes here",
        conditionId: "sleep-apnea",
        medications: ["escitalopram"],
        step: 2,
      },
    };

    const result = sanitizeAndValidateEventPayload(maliciousPayload);

    expect(result.isValid).toBe(false);
    expect(result.violations).toContain("freeText");
    expect(result.violations).toContain("ssn");
    expect(result.violations).toContain("metadata.rawNotes");
    expect(result.violations).toContain("metadata.conditionId");
    expect(result.violations).toContain("metadata.medications");

    expect(result.sanitizedPayload.freeText).toBeUndefined();
    expect(result.sanitizedPayload.ssn).toBeUndefined();
    expect(result.sanitizedPayload.metadata?.rawNotes).toBeUndefined();
    expect(result.sanitizedPayload.metadata?.conditionId).toBeUndefined();
    expect(result.sanitizedPayload.metadata?.medications).toBeUndefined();
    expect(result.sanitizedPayload.metadata?.step).toBe(2);
  });

  it("allows aggregate, non-health operational metrics", () => {
    const cleanPayload = {
      eventType: "RECOMMENDATION_RUN",
      timestamp: new Date().toISOString(),
      metadata: {
        recognizedPrimaryCount: 1,
        recommendedConditionCount: 3,
        step: 5,
      },
    };

    const result = sanitizeAndValidateEventPayload(cleanPayload);
    expect(result.isValid).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.sanitizedPayload).toEqual(cleanPayload);
  });

  it("does not mutate the caller's metadata object while sanitizing", () => {
    const payload = {
      eventType: "CONDITION_SELECTED",
      timestamp: new Date().toISOString(),
      metadata: { conditionId: "ptsd", step: 1 },
    };

    const result = sanitizeAndValidateEventPayload(payload);

    expect(payload.metadata.conditionId).toBe("ptsd");
    expect(result.sanitizedPayload.metadata?.conditionId).toBeUndefined();
  });
});
