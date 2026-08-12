"use client";

import { launchDemoScenario } from "@/app/scenarios/actions";
import { clearSecondaryWorkflowLocalState } from "@/lib/secondary-workflow/local-state";

function clearPriorBrowserReviewState(): void {
  try {
    clearSecondaryWorkflowLocalState(window.sessionStorage);
  } catch {
    // Browser storage may be unavailable. The server action still replaces the
    // encrypted workflow cookie with validated synthetic scenario state.
  }
}

export function ScenarioLaunchForm({ scenarioId }: { scenarioId: string }) {
  return (
    <form action={launchDemoScenario} onSubmit={clearPriorBrowserReviewState} className="mt-4">
      <input type="hidden" name="scenarioId" value={scenarioId} />
      <button
        type="submit"
        className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Run scenario
      </button>
    </form>
  );
}
