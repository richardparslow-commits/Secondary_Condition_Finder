"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

import { vaGovRecordWalkthroughStorageKey } from "@/lib/secondary-workflow/local-state";
import {
  VA_GOV_WALKTHROUGH_DISCLAIMER,
  VA_GOV_WALKTHROUGH_STEPS,
  formatVaGovRecordWalkthrough,
  type VaGovWalkthroughStep,
} from "@/lib/secondary-workflow/va-gov-record-walkthrough";

interface Props {
  /** Default anchor filename for the text export. */
  exportFilename?: string;
}

const CHANGE_EVENT = "secondary-condition-finder:va-gov-record-walkthrough-change";
const EMPTY_SNAPSHOT = "{}";

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function getSnapshot(): string {
  try {
    return window.sessionStorage.getItem(vaGovRecordWalkthroughStorageKey) ?? EMPTY_SNAPSHOT;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function parseLocatedState(raw: string): Record<string, true> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const state: Record<string, true> = {};
    // Only step ids from the authored walkthrough are honored, so stale or
    // foreign keys from earlier runs in the same tab are ignored.
    const authoredIds = new Set(VA_GOV_WALKTHROUGH_STEPS.map((step) => step.id));
    for (const [key, value] of Object.entries(parsed)) {
      if (value === true && authoredIds.has(key)) state[key] = true;
    }
    return state;
  } catch {
    return {};
  }
}

function writeLocatedState(state: Record<string, true>): boolean {
  try {
    window.sessionStorage.setItem(vaGovRecordWalkthroughStorageKey, JSON.stringify(state));
  } catch {
    // Browser storage may be unavailable. The caller keeps progress in memory
    // for this view and says it cannot be saved beyond the current tab state.
    return false;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return true;
}

function clearLocatedState(): boolean {
  try {
    window.sessionStorage.removeItem(vaGovRecordWalkthroughStorageKey);
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return true;
}

function StepLink({ step }: { step: VaGovWalkthroughStep }) {
  if (!step.url) return null;
  return (
    <p className="mt-2 text-sm">
      <a href={step.url} target="_blank" rel="noreferrer" className="underline">
        {step.urlLabel ?? "Open on VA.gov"} <span aria-hidden="true">↗</span>
      </a>
    </p>
  );
}

export function VaGovRecordWalkthrough({ exportFilename = "va-gov-records-download-walkthrough.txt" }: Props) {
  // Progress checkmarks persist in this browser tab's session storage (same
  // boundary as the evidence-gap review and pathway-record-checklist stores)
  // so they survive navigating away and back within the workflow, and are
  // cleared by Finish Review / Start a new review. Never in cookies or on the server.
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_SNAPSHOT);
  const storedLocated = useMemo(() => parseLocatedState(snapshot), [snapshot]);
  // If the browser refuses the sessionStorage write (quota, privacy settings),
  // keep checks in this component's memory so the step still visibly checks and
  // the counter stays truthful for this view. The notice below explains that
  // this fallback progress will not survive leaving or reloading the page.
  const [memoryLocated, setMemoryLocated] = useState<Record<string, true> | null>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const located = memoryLocated ?? storedLocated;

  const toggle = useCallback(
    (stepId: string) => {
      const next = { ...located };
      if (next[stepId]) delete next[stepId];
      else next[stepId] = true;
      if (writeLocatedState(next)) {
        setMemoryLocated(null);
        setStorageUnavailable(false);
      } else {
        setMemoryLocated(next);
        setStorageUnavailable(true);
      }
    },
    [located],
  );

  const clearAll = useCallback(() => {
    if (clearLocatedState()) {
      setMemoryLocated(null);
      setStorageUnavailable(false);
    } else {
      setMemoryLocated({});
      setStorageUnavailable(true);
    }
  }, []);

  const checkedCount = useMemo(
    () => VA_GOV_WALKTHROUGH_STEPS.reduce((sum, step) => (located[step.id] ? sum + 1 : sum), 0),
    [located],
  );

  function downloadWalkthrough() {
    downloadText(formatVaGovRecordWalkthrough(), exportFilename);
  }

  const allChecked = checkedCount === VA_GOV_WALKTHROUGH_STEPS.length;

  return (
    <section
      className="rounded-xl border border-blue-200 bg-white p-5"
      aria-labelledby="va-gov-record-walkthrough-heading"
    >
      <div className="ui-heading-row">
        <span className="ui-icon" aria-hidden="true">▣</span>
        <div>
          <h2 id="va-gov-record-walkthrough-heading" className="text-xl font-bold">
            Need your full VA medical record? Guided VA.gov download
          </h2>
          <p className="text-sm text-slate-600">
            Downloading your complete VA health record takes more than one click: VA.gov signs you in
            through ID.me with a password and a multi-factor code texted to your phone, then a
            multi-page download tool builds the report.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            These steps mirror that flow. Each link opens VA.gov in a new browser tab — you sign in
            there, and the app never sees your credentials, codes, or VA session.
          </p>
        </div>
      </div>

      <div className="ui-callout text-sm">
        <strong>Sign-in happens on VA.gov — not here.</strong> Enter your email, password, and MFA code
        only on VA.gov/ID.me pages in the tab each link opens. This application does not ask for, receive,
        or store any of it, and it cannot click through VA.gov for you. After the final step, the PDF lands
        in your browser&apos;s normal download location — you can add it to the local evidence analyzer on
        this page, where it is analyzed only in your browser.
      </div>

      <p className="mt-4 text-sm" aria-live="polite">
        <strong>{checkedCount}</strong> of <strong>{VA_GOV_WALKTHROUGH_STEPS.length}</strong> steps marked
        complete{allChecked ? " — you should now have your record PDF." : "."}
      </p>

      {storageUnavailable && (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
        >
          Browser storage is unavailable or full. Your checked steps stay visible for this view, but
          progress cannot be saved after you leave or reload this page.
        </p>
      )}

      <ol className="mt-4 space-y-4">
        {VA_GOV_WALKTHROUGH_STEPS.map((step, index) => {
          const isChecked = Boolean(located[step.id]);
          return (
            <li
              key={step.id}
              className={`rounded-lg border p-3 ${isChecked ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200 bg-white"}`}
            >
              <label className="flex gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0"
                  checked={isChecked}
                  onChange={() => toggle(step.id)}
                  aria-label={`Step ${index + 1}: ${step.label}`}
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="text-slate-900">
                      {index + 1}. {step.label}
                    </strong>
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-900">
                      {step.location}
                    </span>
                  </span>
                  <span className="mt-1 block leading-relaxed text-slate-700">{step.detail}</span>
                  {step.note && (
                    <span className="mt-1 block text-xs leading-relaxed text-muted">{step.note}</span>
                  )}
                  <StepLink step={step} />
                </span>
              </label>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" className="ui-button-secondary" onClick={downloadWalkthrough}>
          Download walkthrough as text
        </button>
        <p className="text-sm text-slate-600">
          Creates a text file in this browser only — the same steps and links, for printing or keeping.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="ui-button-secondary" onClick={clearAll} disabled={checkedCount === 0}>
          Clear progress
        </button>
        <p className="text-xs text-slate-600">
          Unchecks every step in this browser tab. Finish Review and Start a new review also clear this
          progress automatically.
        </p>
      </div>

      <p className="mt-3 text-xs text-slate-600">{VA_GOV_WALKTHROUGH_DISCLAIMER}</p>
    </section>
  );
}
