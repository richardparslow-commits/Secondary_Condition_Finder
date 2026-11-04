"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { PrivacyDeletionCue } from "@/components/privacy/PrivacyDeletionCue";
import { clearSecondaryWorkflowLocalState } from "@/lib/secondary-workflow/local-state";
import { resetBrowserWorkflowContextSnapshot } from "@/lib/secondary-workflow/use-browser-context";

/**
 * Finish Review / Start a new review (PRIV-01 stage 2).
 *
 * The retired Server Actions cleared the workflow cookie; there is no
 * workflow cookie anymore. Completion now clears every browser-local workflow key
 * (context record, evidence excerpts, checklists, OCR transcripts, walkthrough
 * progress) and only navigates once cleanup is confirmed. If cleanup throws,
 * the review is not pretended to be finished — the user sees an actionable
 * error instead.
 *
 * The controls also carry the one privacy pointer a review cannot answer for
 * itself. Everything this component clears is browser-local, so a visitor who
 * wants the data the *application* holds deleted has no control on this surface
 * that can do it — the published intake is where that is answered, and
 * finishing a review is exactly when the question arises. Linking it here
 * (rather than leaving discovery to the policy) is the R-01 / B-02 promise
 * being reachable at the moment it is needed, and the cue's wording keeps the
 * two apart: clearing this browser is not deleting what the application keeps.
 *
 * The pointer itself is the shared `PrivacyDeletionCue`, which the presumptive
 * track's saved-service-history control renders too — one destination, one
 * statement of the distinction, two clearing surfaces. This component supplies
 * only the sentence about what *it* clears.
 * `tests/workflow-completion-privacy.test.ts` and
 * `tests/privacy-deletion-pointer.test.tsx` hold it in place.
 */
function useClearAndLeave() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const clearAndLeave = useCallback(
    (destination: string) => {
      try {
        clearSecondaryWorkflowLocalState(window.sessionStorage);
        // The clear-all removes the record from storage; the hook caches the
        // validated snapshot at module scope, so it must be invalidated before
        // the client-side navigation or the next step restores the old review.
        resetBrowserWorkflowContextSnapshot();
      } catch {
        setError(
          "Browser-local cleanup could not be confirmed, so this review was not cleared. Close this tab or clear site data, then try again.",
        );
        return;
      }
      setError(null);
      router.push(destination);
    },
    [router],
  );

  return { error, clearAndLeave };
}

function CleanupErrorAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="ui-callout text-sm">
      <strong>Cleanup failed:</strong> {message}
    </div>
  );
}

export function SecondaryWorkflowRestartButton({
  label = "Start a new review",
}: {
  label?: string;
}) {
  const { error, clearAndLeave } = useClearAndLeave();
  return (
    <div className="space-y-3">
      <button
        type="button"
        className="ui-button-secondary"
        onClick={() => clearAndLeave("/secondary/diagnosed")}
      >
        {label}
      </button>
      <CleanupErrorAlert message={error} />
    </div>
  );
}

export function SecondaryWorkflowCompletionActions() {
  const { error, clearAndLeave } = useClearAndLeave();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3" aria-label="Complete or restart secondary workflow">
        <SecondaryWorkflowRestartButton />
        <button type="button" className="ui-button" onClick={() => clearAndLeave("/secondary")}>
          Finish Review <span aria-hidden="true">→</span>
        </button>
        <CleanupErrorAlert message={error} />
      </div>
      <PrivacyDeletionCue clearedStatement="Finishing or restarting clears what this browser holds." />
    </div>
  );
}
