"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { clearSecondaryWorkflowLocalState } from "@/lib/secondary-workflow/local-state";

/**
 * Finish Review / Start a new review (PRIV-01 stage 2).
 *
 * The retired Server Actions cleared the encrypted workflow cookie; there is
 * no cookie anymore. Completion now clears every browser-local workflow key
 * (context record, evidence excerpts, checklists, OCR transcripts, walkthrough
 * progress) and only navigates once cleanup is confirmed. If cleanup throws,
 * the review is not pretended to be finished — the user sees an actionable
 * error instead.
 */
function useClearAndLeave() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const clearAndLeave = useCallback(
    (destination: string) => {
      try {
        clearSecondaryWorkflowLocalState(window.sessionStorage);
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
    <div className="flex flex-wrap gap-3" aria-label="Complete or restart secondary workflow">
      <SecondaryWorkflowRestartButton />
      <button type="button" className="ui-button" onClick={() => clearAndLeave("/secondary")}>
        Finish Review <span aria-hidden="true">→</span>
      </button>
      <CleanupErrorAlert message={error} />
    </div>
  );
}
