import { describe, expect, it } from "vitest";

import { sealSessionPayload, openSessionPayload, WORKFLOW_SESSION_MAX_AGE_SECONDS } from "@/lib/workflow-session-crypto";
import {
  parseStoredSecondaryWorkflowState,
  workflowSessionToQueryParams,
  type StoredSecondaryWorkflowState,
} from "@/lib/secondary-workflow/session";
import type { SecondaryWorkflowState } from "@/lib/secondary-workflow/state";

/**
 * Empirical round-trip for the Idea #6 surface: a symptom selected at Step 4
 * must survive the encrypted session write/read and reach the Step 5 page
 * parser intact. This pins the exact server path the E2E exercises:
 * parseDocumentsSelection → writeSecondaryWorkflowSession (seal) →
 * readSecondaryWorkflowSession (open) → workflowSessionToQueryParams →
 * parseWorkflowState → buildSymptomDiscussionPrompts.
 */
const SECRET = "round-trip-probe-secret-0123456789abcdef"; // 40 chars

function makeState(): SecondaryWorkflowState {
  return {
    diagnosedConditionIds: ["ptsd"],
    serviceConnectedConditionIds: ["ptsd"],
    ratingsByConditionId: { ptsd: 70 },
    documentsShared: false,
    symptomIds: ["daytime-sleepiness-snoring"],
  };
}

describe("symptom selection survives the encrypted session round-trip", () => {
  it("seal → open preserves symptomIds in the stored state", () => {
    const sealed = sealSessionPayload(makeState(), SECRET, { maxAgeSeconds: WORKFLOW_SESSION_MAX_AGE_SECONDS });
    const opened = openSessionPayload(sealed, SECRET);
    const stored = opened ? parseStoredSecondaryWorkflowState(opened) : null;

    expect(stored).not.toBeNull();
    expect(stored?.symptomIds).toEqual(["daytime-sleepiness-snoring"]);
  });

  it("maps the opened state's symptomIds into Step 5 query params", () => {
    // The suggestions page hydrates via
    // workflowSessionToQueryParams(readSecondaryWorkflowSession()) →
    // parseWorkflowState; this pins the mapping link of that chain.
    const sealed = sealSessionPayload(makeState(), SECRET, { maxAgeSeconds: WORKFLOW_SESSION_MAX_AGE_SECONDS });
    const opened = openSessionPayload(sealed, SECRET);
    const stored: StoredSecondaryWorkflowState | null = opened
      ? parseStoredSecondaryWorkflowState(opened)
      : null;
    expect(stored).not.toBeNull();

    const params = workflowSessionToQueryParams(stored!);
    expect(params.symptomIds).toEqual(["daytime-sleepiness-snoring"]);
  });
});
