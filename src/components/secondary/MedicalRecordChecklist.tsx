"use client";

import { useCallback, useState } from "react";

import {
  CHECKLIST_CATEGORY_LABEL,
  formatMedicalRecordChecklist,
  type ChecklistGroup,
} from "@/lib/secondary-workflow/medical-record-checklist";

interface Props {
  groups: ChecklistGroup[];
}

function storageKeyForGroup(groups: ChecklistGroup[]): string {
  // Deterministic key not persisted — simple in-memory toggle for this review.
  // Checklist state intentionally does NOT use sessionStorage to avoid conflating
  // with the EvidenceGapReview store. A page reload resets it.
  return groups.map((group) => group.conditionId).join(",");
}

export function MedicalRecordChecklist({ groups }: Props) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  // Keep derived key so React doesn't warn if groups identity changes across renders
  void storageKeyForGroup(groups);

  const toggle = useCallback((key: string) => {
    setChecked((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (groups.length === 0) return null;

  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
  const checkedCount = checked.size;

  function downloadChecklist() {
    const content = formatMedicalRecordChecklist(groups);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "medical-record-checklist.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <section
      className="mt-6 rounded-xl border border-blue-200 bg-white p-5"
      aria-labelledby="medical-record-checklist-heading"
    >
      <div className="ui-heading-row">
        <span className="ui-icon" aria-hidden="true">☰</span>
        <div>
          <h2 id="medical-record-checklist-heading" className="text-xl font-bold">
            Medical Record Checklist
          </h2>
          <p className="text-sm text-slate-600">
            Pathway-typed checklist drawn from authored <code>evidenceGaps</code> — not a VA form. Use it when requesting records from providers or VA.
          </p>
        </div>
      </div>

      <div className="ui-callout text-sm">
        <strong>Research aid, not proof:</strong> Each item names records that may help a qualified clinician evaluate the authored relationship. A checked item means you found material to discuss — not that the evidence is sufficient, competent, credible, or accepted by VA.
      </div>

      <p className="mt-4 text-sm" aria-live="polite">
        <strong>{checkedCount}</strong> of <strong>{totalItems}</strong> checklist items marked as located for discussion.
      </p>

      <div className="mt-4 space-y-6">
        {groups.map((group) => (
          <fieldset key={group.conditionId} className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-bold text-blue-900">
              {group.conditionName}
              <span className="ml-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-normal text-slate-600">
                {group.bodySystem}
              </span>
              <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-normal text-amber-900">
                {group.etiologicalConsensus}
              </span>
            </legend>
            <p className="mt-1 text-xs text-slate-600">
              Primaries: {group.contributingPrimaryNames.join(", ")}
            </p>
            <div className="mt-3 space-y-3">
              {group.items.map((item) => {
                const key = `${group.conditionId}:${item.gap}`;
                const isChecked = checked.has(key);
                return (
                  <label key={key} className="flex gap-3 rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0"
                      checked={isChecked}
                      onChange={() => toggle(key)}
                      aria-label={`${group.conditionName}: ${item.gap}`}
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <strong className="text-slate-900">{item.gap}</strong>
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-900">
                          {CHECKLIST_CATEGORY_LABEL[item.category]}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-600">{item.why}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" className="ui-button" onClick={downloadChecklist}>
          Download checklist
        </button>
        <p className="text-sm text-slate-600">
          Creates a text file in this browser only. It mirrors the consultation summary export — authored gaps, typed by evidence kind — without raw excerpts or medication/treatment context.
        </p>
      </div>

      <p className="mt-3 text-sm text-slate-600">
        Checklist is generated from the current published mappings only. If no published relationship exists for a diagnosis, no checklist is shown for it. Confirm current VA guidance with a qualified provider or accredited representative.
      </p>
    </section>
  );
}
