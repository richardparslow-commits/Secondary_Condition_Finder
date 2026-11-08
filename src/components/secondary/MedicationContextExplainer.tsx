"use client";

import { useState } from "react";

interface MedicationContextExplainerProps {
  matchedTerms: string[];
  variant?: "card" | "inline";
  medicationsCount?: number;
  treatmentsCount?: number;
}

/**
 * Compliant re-scoping of the former \"Medication-to-Secondary Mapper\" idea.
 *
 * What this does NOT do (by design):
 * - Does NOT generate secondary conditions from medications.
 * - Does NOT infer drug classes, mechanisms, or iatrogenic pathways.
 * - Does NOT change recommendation ranking, filtering, or prevalence.
 * - Does NOT establish causation, aggravation, or medical nexus.
 *
 * What it does:
 * - Explains that any highlighted medication/treatment/history term is a
 *   literal, case-insensitive substring overlap between the Veteran-entered
 *   term and already-authored recommendation text (condition name, rationale,
 *   evidence gaps). Pathway-intelligence fields are deliberately excluded.
 *   This is a research cue only.
 */
export function MedicationContextExplainer({
  matchedTerms,
  variant = "card",
  medicationsCount,
  treatmentsCount,
}: MedicationContextExplainerProps) {
  const [open, setOpen] = useState(matchedTerms.length > 0);

  if (variant === "inline" && matchedTerms.length === 0) return null;

  const hasContext = (medicationsCount ?? 0) > 0 || (treatmentsCount ?? 0) > 0;

  return (
    <section
      aria-label="Medication and treatment context — how matches work"
      className={
        variant === "card"
          ? "rounded-xl border border-slate-200 bg-slate-50 p-4"
          : "rounded-lg border border-slate-200 bg-slate-50 p-3"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold text-slate-600">
            Reported treatment context appearing in authored mapping text
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Medication, treatment, and history entries are <strong>research cues only</strong>. A term is highlighted
            only when its exact text literally appears in already-authored mapping content for this recommendation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="shrink-0 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          {open ? "Hide" : "Learn more"}
        </button>
      </div>

      {matchedTerms.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-700">Literal overlaps in this recommendation:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {matchedTerms.map((item) => (
              <span
                key={item}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : hasContext ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs leading-relaxed text-amber-900">
          No literal overlap was found between your reported medication/treatment terms and the authored text for this
          recommendation. That is not a negative finding — it only means the exact terms did not appear in this mapping.
          No new diagnosis was generated from your medications, and recommendation ranking did not change.
        </p>
      ) : null}

      {open && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-700">
          <p className="font-semibold text-slate-900">What this is and is not</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Does:</strong> Compare each Veteran-entered term (case-insensitive, ≥3 characters) against the
              authored text for this exact service-connected → non-service-connected edge (condition name, rationale,
              evidence gaps). This uses literal substring matching.
            </li>
            <li>
              <strong>Does not:</strong> Infer drug classes (e.g., “NSAID → cardiovascular”), hypothesize side-effects,
              suggest a diagnosis you did not report in Step&nbsp;1, or change which recommendations are shown or how
              they are ordered.
            </li>
            <li>
              <strong>Why literal only?</strong> Any inference would overstate the evidence and violate the
              non-adjudicative boundary. Pathway-intelligence fields are deliberately excluded from matching so that
              adding richer Step&nbsp;5 explanation cannot create new medication matches.
            </li>
            <li>
              <strong>Limit:</strong> Spelling variants, brand vs. generic names, and abbreviations must match exactly to
              be highlighted. Absence of a highlight does not rule out a real pharmacologic effect — discuss it with a
              qualified clinician.
            </li>
          </ul>
          <p className="mt-3 rounded bg-blue-50 px-2.5 py-2 text-blue-900">
            This is not proof of individual causation, aggravation, or medical nexus. It is a prompt to discuss the
            highlighted term — if any — with a qualified provider who can review your records and current VA guidance.
          </p>
        </div>
      )}

      <p className="mt-3 text-xs text-muted">
        Your medication/treatment entries are optional, bounded, and stored only in this browser tab for this review.
        They are not sent to the application server or VA APIs, or written to recommendation logs or telemetry.
      </p>
    </section>
  );
}

/**
 * Compact explainer for the upload form where no recommendation context exists yet.
 */
export function MedicationContextUploadExplainer() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">How medication context will be used</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            If you enter medications or treatments above, the next step will highlight any term that literally appears
            in authored mapping text. That highlight does not create a new diagnosis or prove a side-effect.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="shrink-0 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          {open ? "Hide" : "Details"}
        </button>
      </div>
      {open && (
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-slate-700">
          <li>No new condition will be added to Step&nbsp;5 because of what you type here.</li>
          <li>Recommendation order and eligibility are not changed by these entries.</li>
          <li>Only an exact text overlap (≥3 chars, case-insensitive) between your term and authored rationale/gaps will be flagged.</li>
          <li>Spelling must match; “ibuprofen” will not match “NSAID” and “SSRI” will not match a specific drug name unless the authored text contains that exact string.</li>
          <li>This is a discussion prompt for a clinician — not a medical conclusion or VA determination.</li>
        </ul>
      )}
    </div>
  );
}
