import Link from "next/link";

import { DisclaimerFooter } from "@/components/Disclaimer";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { mappedConditionIds } from "@/lib/kb/lookup";
import { readSecondaryWorkflowSession } from "@/lib/secondary-workflow/session";
import { saveDiagnosedSelection } from "../actions";

export const dynamic = "force-dynamic";
const DATABASE_MAPPED_EXPLANATION =
  "Database mapped means this condition already has authored secondary-condition relationships in the knowledge base.";

export default async function DiagnosedConditionsPage() {
  const catalog = loadConditionCatalog();
  const mapped = mappedConditionIds(loadKnowledgeBase());
  const conditions = [...catalog].sort((a, b) => a.name.localeCompare(b.name));
  const session = await readSecondaryWorkflowSession();
  const selectedDiagnosed = new Set(session.diagnosedConditionIds ?? []);
  const selectedConditions = conditions.filter((condition) => selectedDiagnosed.has(condition.id));

  return (
    <main>
      <header className="page-hero text-center">
        <p className="ui-kicker">Step 1 of 6</p>
        <h1>Diagnosed Conditions</h1>
        <p className="mx-auto mt-3 max-w-3xl text-lg">Select conditions you have been formally diagnosed with and want to evaluate in this research session.</p>
      </header>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Workflow progress">
        <strong className="text-blue-700">1 Diagnosed</strong><span>2 Service-connected</span><span>3 Ratings</span><span>4 Documents</span><span>5 Suggestions</span><span>6 Evidence</span>
      </div>

      <form action={saveDiagnosedSelection}>
        <div className="ui-grid">
          <aside className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">i</span><h2 className="text-xl font-bold">How to Use This Step</h2></div>
            <div className="space-y-5 text-sm">
              <div><h3 className="font-bold">Search or browse</h3><p className="mt-1">Browse the condition catalog and select each diagnosis you want to research.</p></div>
              <div><h3 className="font-bold">Select diagnosed conditions</h3><p className="mt-1">Choose only conditions you have actually been diagnosed with by a qualified medical professional.</p></div>
              <div><h3 className="font-bold">Review your selections</h3><p className="mt-1">Previously selected conditions are summarized on the right and can be changed before continuing.</p></div>
            </div>
            <div className="ui-callout mt-6"><strong>Important note:</strong><p className="mt-1 text-sm">Do not include a condition solely because you suspect it. This tool does not diagnose conditions.</p></div>
          </aside>

          <fieldset className="ui-card min-w-0 p-5">
            <legend className="sr-only">Diagnosed conditions</legend>
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><div><h2 className="text-xl font-bold">Select Diagnosed Conditions</h2><p className="text-sm text-slate-600">Choose one or more, then continue.</p></div></div>
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Browse {conditions.length} catalog conditions. The list does not infer diagnoses from free text.</div>
            <ul className="max-h-[36rem] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
              {conditions.map((condition) => (
                <li key={condition.id}>
                  <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
                    <input type="checkbox" name="diagnosed" value={condition.id} defaultChecked={selectedDiagnosed.has(condition.id)} className="mt-1 h-5 w-5 rounded border-slate-300" />
                    <span className="min-w-0 text-sm">
                      <span className="block font-semibold text-slate-900">{condition.name}</span>
                      <span className="block text-xs text-slate-500">{condition.bodySystem}</span>
                    </span>
                    {mapped.has(condition.id) ? (
                      <span className="ml-auto shrink-0 rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800" title={DATABASE_MAPPED_EXPLANATION}>database mapped</span>
                    ) : (
                      <span className="ml-auto shrink-0 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">mapping in progress</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <aside className="ui-stack">
            <section className="ui-card">
              <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Selected Diagnosed Conditions</h2></div>
              {selectedConditions.length === 0 ? <p className="text-sm text-slate-600">No saved selections yet.</p> : <ul className="space-y-2">{selectedConditions.map((condition) => <li key={condition.id} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900">{condition.name}</li>)}</ul>}
            </section>
            <section className="ui-card">
              <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">?</span><h2 className="text-xl font-bold">Why This Matters</h2></div>
              <p className="text-sm">Later suggestions compare your diagnosed conditions with the disabilities you identify as already service connected.</p>
              <div className="ui-callout mt-5 text-sm">Your selections are stored in the short-lived encrypted workflow session, not placed in the URL.</div>
            </section>
          </aside>
        </div>

        <div className="ui-actions">
          <Link href="/secondary" className="ui-button-secondary">← Back</Link>
          <button type="submit" className="ui-button">Continue to Step 2 <span aria-hidden="true">→</span></button>
        </div>
      </form>
      <DisclaimerFooter />
    </main>
  );
}
