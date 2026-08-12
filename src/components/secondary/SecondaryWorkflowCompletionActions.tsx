"use client";

import {
  finishSecondaryWorkflow,
  restartSecondaryWorkflow,
} from "@/app/secondary/actions";
import { clearSecondaryWorkflowLocalState } from "@/lib/secondary-workflow/local-state";

function clearBrowserLocalWorkflowState(): void {
  try {
    clearSecondaryWorkflowLocalState(window.sessionStorage);
  } catch {
    // If browser storage is unavailable, the server action still clears the
    // encrypted workflow cookie. No local state is copied to another channel.
  }
}

export function SecondaryWorkflowCompletionActions() {
  return (
    <div className="ui-actions" aria-label="Complete or restart secondary workflow">
      <form action={restartSecondaryWorkflow} onSubmit={clearBrowserLocalWorkflowState}>
        <button type="submit" className="ui-button-secondary">
          Start a new review
        </button>
      </form>
      <form action={finishSecondaryWorkflow} onSubmit={clearBrowserLocalWorkflowState}>
        <button type="submit" className="ui-button">
          Finish Review <span aria-hidden="true">→</span>
        </button>
      </form>
    </div>
  );
}
