import Link from "next/link";

import { DisclaimerFooter } from "@/components/Disclaimer";
import { indexById } from "@/lib/catalog/lookup";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { readSecondaryWorkflowSession } from "@/lib/secondary-workflow/session";
import { saveServiceConnectedSelection } from "../actions";

export const dynamic = "force-dynamic";

export default async function ServiceConnectedStepPage() {
  const catalog = loadConditionCatalog();
  const byId = indexById(catalog);
  const session = await readSecondaryWorkflowSession();
  const diagnosedConditionIds = session.diagnosedConditionIds ?? [];

  if (diagnosedConditionIds.length === 0) {
    return (
      <main>
        <header className="page-hero"><h1>Select diagnosed conditions first</h1><p>Choose at least one diagnosed condition before setting service-connected status.</p></header>
        <Link href="/secondary/diagnosed" className="ui-button">Back to diagnosed conditions</Link>
      </main>
    );
  }

  const selectedServiceConnectedIds = new Set(session.serviceConnectedConditionIds ?? []);
  const hasPriorSelection = session.serviceConnectedConditionIds !== undefined;
  const diagnosed = diagnosedConditionIds.map((id) => byId.get(id)).filter((condition): condition is NonNullable<typeof condition> => condition !== undefined);
  const selected = diagnosed.filter((condition) => selectedServiceConnectedIds.has(condition.id));

  return (
    <main>
      <header className="page-hero text-center">
        <p className="ui-kicker">Step 2 of 6</p>
        <h1>Service-Connected Conditions</h1>
        <p className="mx-auto mt-3 max-w-3xl text-lg">Mark which selected diagnoses VA has already recognized as service connected.</p>
      </header>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Workflow progress"><span>✓ Diagnosed</span><strong className="text-blue-700">2 Service-connected</strong><span>3 Ratings</span><span>4 Documents</span><span>5 Suggestions</span><span>6 Evidence</span></div>

      <form action={saveServiceConnectedSelection}>
        <div className="ui-grid">
          <aside className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Step Guidance</h2></div>
            <h3 className="text-lg font-bold">Choose only established service-connected conditions</h3>
            <p className="mt-2 text-sm">Use your VA rating decision or benefit summary to confirm which diagnoses have already been granted service connection.</p>
            <div className="ui-divider" />
            <p className="text-sm"><strong>Why this matters:</strong> The secondary engine compares these established primary conditions against authored secondary mappings.</p>
            <div className="ui-callout mt-5 text-sm"><strong>Do not mark a new condition as service connected</strong> unless VA has already granted that status.</div>
          </aside>

          <section className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">↗</span><div><h2 className="text-xl font-bold">Select Your Service-Connected Conditions</h2><p className="text-sm text-slate-600">Mark yes or no for every diagnosed condition below.</p></div></div>
            <div className="space-y-3">
              {diagnosed.map((condition) => (
                <fieldset key={condition.id} className="rounded-xl border border-slate-200 p-4 shadow-none">
                  <legend className="font-semibold text-slate-900">{condition.name}</legend>
                  <p className="text-xs text-slate-500">{condition.bodySystem}</p>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"><input type="radio" name={`serviceConnected-${condition.id}`} value="yes" defaultChecked={hasPriorSelection ? selectedServiceConnectedIds.has(condition.id) : true} className="h-5 w-5" />Yes, already service connected</label>
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"><input type="radio" name={`serviceConnected-${condition.id}`} value="no" defaultChecked={hasPriorSelection ? !selectedServiceConnectedIds.has(condition.id) : false} className="h-5 w-5" />No, not service connected</label>
                  </div>
                </fieldset>
              ))}
            </div>
            <div className="ui-callout mt-5 text-sm"><strong>How this helps:</strong> We compare these primary conditions with your diagnosed conditions to identify authored secondary research pathways.</div>
          </section>

          <aside className="ui-stack">
            <section className="ui-card">
              <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Selected Service-Connected Conditions</h2></div>
              {selected.length === 0 ? <p className="text-sm text-slate-600">No saved selections yet.</p> : <ul className="space-y-2">{selected.map((condition) => <li key={condition.id} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900">{condition.name} <span className="float-right rounded bg-white px-1.5 text-xs">SC</span></li>)}</ul>}
            </section>
            <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">?</span><h2 className="text-xl font-bold">Need Help?</h2></div><p className="text-sm">Check your most recent VA rating decision, benefit summary, or rating code sheet. These documents identify granted service-connected disabilities and their evaluations.</p></section>
          </aside>
        </div>
        <div className="ui-actions"><Link href="/secondary/diagnosed" className="ui-button-secondary">← Back to Step 1</Link><button type="submit" className="ui-button">Continue to Step 3 <span aria-hidden="true">→</span></button></div>
      </form>
      <DisclaimerFooter />
    </main>
  );
}
