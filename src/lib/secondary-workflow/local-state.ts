import { evidenceAnalysisStorageKey } from "@/lib/evidence/extract";
import { OCR_CHECKPOINT_STORAGE_KEY } from "@/lib/evidence/ocr-session";

import { browserWorkflowContextStorageKey } from "./browser-context";

export const evidenceDepthStorageKey = "secondary-condition-finder:evidence-depth:v1";

export const evidenceGapReviewStorageKey =
  "secondary-condition-finder:evidence-gap-review:v1";

export const pathwayRecordChecklistStorageKey =
  "secondary-condition-finder:pathway-record-checklist:v1";

export const vaGovRecordWalkthroughStorageKey =
  "secondary-condition-finder:va-gov-record-walkthrough:v1";

export const secondaryWorkflowLocalStorageKeys = [
  browserWorkflowContextStorageKey,
  evidenceAnalysisStorageKey,
  evidenceGapReviewStorageKey,
  pathwayRecordChecklistStorageKey,
  vaGovRecordWalkthroughStorageKey,
  OCR_CHECKPOINT_STORAGE_KEY,
  evidenceDepthStorageKey,
] as const;

export type RemovableStorage = Pick<Storage, "removeItem">;

/**
 * Clears only browser-local state owned by the secondary workflow
 * (browser-local workflow context, evidence excerpts, evidence-gap review
 * checkmarks, pathway-record-checklist selections, VA.gov walkthrough
 * progress, OCR transcripts, and depth preference).
 * Raw evidence/checklist
 * content is never copied or sent anywhere while clearing.
 */
const auxiliaryLocalStorageKeys = secondaryWorkflowLocalStorageKeys.filter(
  (key) => key !== browserWorkflowContextStorageKey,
);

function clearLocalStorageKeys(
  storage: RemovableStorage,
  keys: readonly string[],
): void {
  let failed = false;
  for (const key of keys) {
    try { storage.removeItem(key); } catch { failed = true; }
  }
  if (failed) throw new Error("Browser-local cleanup could not be confirmed.");
}

export function clearSecondaryWorkflowLocalState(storage: RemovableStorage): void {
  clearLocalStorageKeys(storage, secondaryWorkflowLocalStorageKeys);
}

/**
 * Clears the workflow's supporting browser-local keys without deleting the
 * workflow context. Scenario launch persists the new context first, then uses
 * this so a failed save cannot erase the review already open.
 */
export function clearSecondaryWorkflowAuxiliaryState(storage: RemovableStorage): void {
  clearLocalStorageKeys(storage, auxiliaryLocalStorageKeys);
}
