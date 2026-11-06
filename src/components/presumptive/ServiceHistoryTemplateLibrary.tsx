"use client";

import { useState } from "react";

import type { PresumptiveTemplate } from "@/lib/presumptive/templates";

interface ServiceHistoryTemplateLibraryProps {
  templates: PresumptiveTemplate[];
}

export function ServiceHistoryTemplateLibrary({ templates }: ServiceHistoryTemplateLibraryProps) {
  const [appliedId, setAppliedId] = useState<string | null>(null);

  function applyTemplate(template: PresumptiveTemplate) {
    const form = document.querySelector<HTMLFormElement>('form[action]');
    // Work with named inputs directly; ServiceHistoryForm uses controlled checkboxes
    // so we fire a synthetic change by toggling the underlying input and dispatching events.
    const locationInputs = document.querySelectorAll<HTMLInputElement>('input[name="location"]');
    const startInput = document.querySelector<HTMLInputElement>('input[name="serviceStart"]');
    const endInput = document.querySelector<HTMLInputElement>('input[name="serviceEnd"]');

    // Clear existing location selections first, then check template locations.
    // Because the form is controlled via React state, we need to simulate clicks
    // rather than only setting .checked. Click simulation triggers onChange.
    const wanted = new Set(template.locations);
    locationInputs.forEach((input) => {
      const shouldBeChecked = wanted.has(input.value);
      if (input.checked !== shouldBeChecked) input.click();
    });

    // A template replaces the date preset. An omitted date means that bound is
    // open (the burn-pit templates run to present), so clear any value left by
    // a previously applied template rather than keeping it (Heal
    // s6-template-keeps-stale-end-date-1).
    const setDateInput = (input: HTMLInputElement | null, value?: string) => {
      if (!input) return;
      const next = value ?? "";
      if (input.value === next) return;
      input.value = next;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    setDateInput(startInput, template.serviceStart);
    setDateInput(endInput, template.serviceEnd);

    // Scroll form into view so user sees what changed.
    form?.scrollIntoView({ behavior: "smooth", block: "center" });
    setAppliedId(template.id);
    setTimeout(() => setAppliedId(null), 2200);
  }

  return (
    <section aria-label="Service history templates" className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h2 className="text-sm font-bold text-slate-900">Quick-start templates</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        Choose a template to pre-fill locations and dates. This only updates the form — nothing is saved until you
        submit. Narrow the dates to your actual DD-214 interval before running the match.
      </p>

      <div className="mt-3 grid gap-2">
        {templates.map((template) => (
          <div
            key={template.id}
            className={`rounded-lg border bg-white p-3 ${appliedId === template.id ? "border-emerald-300 ring-1 ring-emerald-200" : "border-slate-200"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight text-slate-900">{template.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{template.description}</p>
                <p className="mt-1.5 flex flex-wrap gap-1.5">
                  {template.locations.map((loc) => (
                    <span key={loc} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                      {loc}
                    </span>
                  ))}
                </p>
                <p className="mt-1.5 text-xs text-muted">
                  <span className="font-medium text-slate-700">{template.authorityNote}</span>
                  {template.serviceStart || template.serviceEnd ? (
                    <>
                      {" "}
                      · {template.serviceStart ?? "—"} to {template.serviceEnd ?? "present"}
                    </>
                  ) : null}
                </p>
                <p className="mt-1 text-xs italic text-muted">{template.hint}</p>
              </div>
              <button
                type="button"
                onClick={() => applyTemplate(template)}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  appliedId === template.id
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                }`}
                aria-label={`Apply template ${template.label}`}
              >
                {appliedId === template.id ? "Applied" : "Apply"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        Templates cover only the two categories currently authored locally (Agent Orange, burn pits). Camp Lejeune,
        radiation, and Gulf War illness presumptions are not yet covered in this app — see the results page note.
      </p>
    </section>
  );
}
