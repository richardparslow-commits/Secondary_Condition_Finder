"use client";

import { useClientCorpus } from "@/lib/client-corpus";

interface ScenarioCorpusNoticeProps {
  /** Test seam; production reloads the page so every launcher retries. */
  onRetry?: () => void;
}

/**
 * The scenario launchers disable their buttons until the public condition
 * corpus loads. Without this notice a failed corpus fetch left every button
 * greyed out with no explanation (Heal s1-scenarios-corpus-failure-hidden-1).
 * One page-level alert covers all launchers; the retry reloads so each hook
 * refetches the corpus instead of only the alert recovering.
 */
export function ScenarioCorpusNotice({
  onRetry,
}: ScenarioCorpusNoticeProps = {}) {
  const { error } = useClientCorpus();
  if (!error) return null;

  return (
    <div
      role="alert"
      className="mt-6 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900"
    >
      <p className="font-semibold">Demo scenarios could not be loaded.</p>
      <p className="mt-1">
        The condition data needed to run a scenario is unavailable: {error}
      </p>
      <button
        type="button"
        onClick={onRetry ?? (() => window.location.reload())}
        className="ui-button-secondary mt-3"
      >
        Try again
      </button>
    </div>
  );
}
