import { evidenceAnalysisStorageKey } from "@/lib/evidence/extract";

export const evidenceGapReviewStorageKey =
  "secondary-condition-finder:evidence-gap-review:v1";

export const secondaryWorkflowLocalStorageKeys = [
  evidenceAnalysisStorageKey,
  evidenceGapReviewStorageKey,
] as const;

export type RemovableStorage = Pick<Storage, "removeItem">;

/**
 * Clears only browser-local state owned by the secondary workflow.
 * Raw evidence/checklist content is never copied or sent anywhere while clearing.
 */
export function clearSecondaryWorkflowLocalState(storage: RemovableStorage): void {
  for (const key of secondaryWorkflowLocalStorageKeys) {
    storage.removeItem(key);
  }
}
