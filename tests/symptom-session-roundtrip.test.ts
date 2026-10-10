import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import {
  readBrowserWorkflowContext,
  writeBrowserWorkflowContext,
} from "@/lib/secondary-workflow/browser-context";
import {
  parseDocumentsSelection,
  parseWorkflowState,
  type QueryParams,
} from "@/lib/secondary-workflow/state";
import { buildSymptomDiscussionPrompts } from "@/lib/secondary-workflow/symptom-bridge";
import { workflowSessionToQueryParams } from "@/lib/secondary-workflow/transport";

/**
 * Browser-local successor of the legacy encrypted-session round trip
 * (PRIV-01 stage 3 retired the sealed cookie).
 *
 * The chain that must stay intact:
 * parseDocumentsSelection → writeBrowserWorkflowContext → read (browser
 * storage) → workflowSessionToQueryParams → parseWorkflowState →
 * buildSymptomDiscussionPrompts.
 */
const catalog = loadConditionCatalog();

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    raw: data,
  };
}

function stepFourParams(symptomId = "daytime-sleepiness-snoring"): QueryParams {
  return {
    diagnosed: ["ptsd", "sleep-apnea"],
    serviceConnected: "ptsd",
    "rating-ptsd": "70",
    documentsShared: "yes",
    symptomIds: symptomId,
  };
}

describe("symptom selection survives the browser-local round-trip", () => {
  it("stores and re-reads symptomIds from the browser-local record", () => {
    const storage = fakeStorage();
    const state = parseDocumentsSelection(stepFourParams(), catalog);
    writeBrowserWorkflowContext(storage, state);

    const record = readBrowserWorkflowContext(storage);
    expect(record).not.toBeNull();
    expect(record?.symptomIds).toEqual(["daytime-sleepiness-snoring"]);
  });

  it("maps the stored record into Step 5 parser input and prompt output", () => {
    const storage = fakeStorage();
    writeBrowserWorkflowContext(storage, parseDocumentsSelection(stepFourParams(), catalog));

    const record = readBrowserWorkflowContext(storage)!;
    const parsed = parseWorkflowState(workflowSessionToQueryParams(record), catalog);
    expect(parsed.symptomIds).toEqual(["daytime-sleepiness-snoring"]);

    const prompts = buildSymptomDiscussionPrompts(
      parsed.symptomIds ?? [],
      new Map(catalog.map((condition) => [condition.id, condition.name])),
    );
    expect(prompts.map((entry) => entry.symptomId)).toEqual(["daytime-sleepiness-snoring"]);
  });
});
