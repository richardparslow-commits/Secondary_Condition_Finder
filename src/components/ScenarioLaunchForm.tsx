"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import scenarios from "../../data/demo-scenarios.json";
import { useClientCorpus } from "@/lib/client-corpus";
import type { BrowserWorkflowContextInput } from "@/lib/secondary-workflow/browser-context";
import { clearSecondaryWorkflowAuxiliaryState } from "@/lib/secondary-workflow/local-state";
import { parseWorkflowState } from "@/lib/secondary-workflow/state";
import { workflowSessionToQueryParams } from "@/lib/secondary-workflow/transport";
import { useBrowserWorkflowContext } from "@/lib/secondary-workflow/use-browser-context";
import type { TransportableWorkflowState } from "@/lib/secondary-workflow/transport";

/**
 * Demo scenario launcher (PRIV-01 stage 2).
 *
 * Scenario state is synthetic and public (bundled JSON), and the launcher
 * writes it straight into the browser-local context — no Server Action, no
 * cookie, no request carrying workflow state. The state is still validated
 * through the same current-workflow contract before it is persisted.
 */
export function ScenarioLaunchForm({ scenarioId }: { scenarioId: string }) {
  const router = useRouter();
  const { corpus, loading } = useClientCorpus();
  const { persist } = useBrowserWorkflowContext();
  const [error, setError] = useState<string | null>(null);

  function launch() {
    if (!corpus) return;
    const scenario = scenarios.find((candidate) => candidate.id === scenarioId);
    if (!scenario) {
      setError("Unknown demo scenario.");
      return;
    }

    const workflow = scenario.workflow as unknown as TransportableWorkflowState;
    try {
      // Parse through the same current-workflow contract used by the wizard
      // before persisting any synthetic demo state.
      parseWorkflowState(workflowSessionToQueryParams(workflow), corpus.conditions);
    } catch {
      setError("This scenario's state failed validation and was not loaded.");
      return;
    }

    try {
      // Save first. If storage refuses the write, the review already open and
      // its supporting state are untouched.
      persist(workflow as BrowserWorkflowContextInput);
    } catch {
      setError("This scenario could not be saved. Your existing review is unchanged.");
      return;
    }

    try {
      // The new context is safely stored. Clear only the old supporting state,
      // not the context that was just written.
      clearSecondaryWorkflowAuxiliaryState(window.sessionStorage);
    } catch {
      setError("The scenario was saved, but the previous local evidence could not be cleared. Reload before continuing.");
      return;
    }

    setError(null);
    router.push("/secondary/suggestions");
  }

  return (
    <div className="mt-4 space-y-3">
      <button
        type="button"
        className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        onClick={launch}
        disabled={loading || !corpus}
      >
        Run scenario
      </button>
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
