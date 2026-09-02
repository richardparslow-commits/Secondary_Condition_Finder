import Link from "next/link";

import { indexById } from "@/lib/catalog/lookup";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { VALID_RATINGS } from "@/lib/secondary-workflow";
import { ratingFieldName } from "@/lib/secondary-workflow/state";
import { readSecondaryWorkflowSession, type StoredSecondaryWorkflowState } from "@/lib/secondary-workflow/session";
import { secondaryValidationMessage } from "@/lib/secondary-workflow/validation";
import { saveRatingsSelection } from "@/lib/actions/secondary";

interface RatingOption { label: string; value: string; }
interface RatingsPageProps {
  workflowState?: StoredSecondaryWorkflowState;
  searchParams?: Promise<{ error?: string | string[] }>;
}

function getRatingOptions(): RatingOption[] {
  return Array.from(VALID_RATINGS.reduce((options, rating) => {
    const value = rating === "100% P&T" ? "100" : rating.replace("%", "");
    options.set(value, { label: rating, value });
    return options;
  }, new Map<string, RatingOption>()).values());
}

export const dynamic = "force-dynamic";

export default async function RatingsPage({ workflowState, searchParams }: RatingsPageProps = {}) {
  const catalog = loadConditionCatalog();
  const catalogById = indexById(catalog);
  const session = workflowState ?? (await readSecondaryWorkflowSession());
  const diagnosedConditionIds = session.diagnosedConditionIds ?? [];
  const serviceConnectedConditionIds = session.serviceConnectedConditionIds ?? [];
  const ratingsByConditionId = session.ratingsByConditionId ?? {};
  const ratingOptions = getRatingOptions();
  const validationMessage = secondaryValidationMessage((await searchParams)?.error);
  const validationId = validationMessage ? "ratings-validation-error" : undefined;

  if (diagnosedConditionIds.length === 0 || serviceConnectedConditionIds.length === 0) {
    return <main><header className="page-hero"><h1>Set service-connected status first</h1><p>Complete the prior workflow steps before entering current ratings.</p></header><Link href="/secondary/service-connected" className="ui-button">Back to service-connected status</Link></main>;
  }

  return (
    <main>
      <header className="page-hero text-center"><p className="ui-kicker">Step 3 of 6</p><h1>Disability Ratings</h1><p className="mx-auto mt-3 max-w-3xl text-lg">Select the current VA evaluation for each service-connected condition in this research session, or choose not to provide it.</p></header>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Workflow progress"><span>✓ Diagnosed</span><span>✓ Service-connected</span><strong className="text-blue-700">3 Ratings</strong><span>4 Documents</span><span>5 Connections</span><span>6 Evidence</span></div>

      {validationMessage && (
        <div id={validationId} role="alert" className="ui-callout mb-5 text-sm">
          <strong>Check this step:</strong> {validationMessage}
        </div>
      )}

      <form action={saveRatingsSelection} aria-describedby={validationId}>
        <div className="ui-grid">
          <aside className="ui-stack">
            <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">%</span><h2 className="text-xl font-bold">Why Ratings Matter</h2></div><p className="text-sm">Ratings provide current context for the service-connected disabilities in this research session. The app does not calculate or predict a VA rating decision.</p></section>
            <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Accepted Values</h2></div><div className="grid grid-cols-3 gap-2">{ratingOptions.map((rating) => <span key={rating.label} className="rounded-lg border border-slate-200 px-2 py-2 text-center text-sm font-semibold text-blue-700">{rating.label}</span>)}</div><p className="mt-3 text-xs text-slate-600">You may also choose “I prefer not to answer.”</p></section>
          </aside>

          <section className="ui-card">
            <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><div><h2 className="text-xl font-bold">Enter Ratings for Selected Conditions</h2><p className="text-sm text-slate-600">Choose the evaluation that is currently in effect.</p></div></div>
            <div className="space-y-3">
              {serviceConnectedConditionIds.map((conditionId) => {
                const fieldName = ratingFieldName(conditionId);
                const stored = ratingsByConditionId[conditionId];
                const currentValue = stored === null ? "decline" : typeof stored === "number" ? String(stored) : "";
                const conditionName = catalogById.get(conditionId)?.name ?? conditionId.replace(/-/g, " ");
                return <div key={conditionId} className="grid items-center gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[1fr_11rem]"><label className="font-semibold" htmlFor={fieldName}>Rating for {conditionName}</label><select id={fieldName} name={fieldName} required aria-describedby={validationId} defaultValue={currentValue} className="w-full px-3"><option value="">Select current rating...</option>{ratingOptions.map((rating) => <option key={rating.label} value={rating.value}>{rating.label}</option>)}<option value="decline">I prefer not to answer</option></select></div>;
              })}
            </div>
            <div className="ui-callout mt-5 text-sm"><strong>Important:</strong> Use the rating currently in effect, not a future or requested increase. You can revise these selections before continuing.</div>
          </section>

          <aside className="ui-stack">
            <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">Σ</span><h2 className="text-xl font-bold">Current Summary</h2></div><ul className="space-y-3">{serviceConnectedConditionIds.map((id) => { const name = catalogById.get(id)?.name ?? id; const rating = ratingsByConditionId[id]; return <li key={id} className="flex justify-between gap-3 border-b border-slate-100 pb-2 text-sm"><span className="font-medium">{name}</span><strong className="text-blue-700">{rating === null ? "Not provided" : typeof rating === "number" ? `${rating}%` : "—"}</strong></li>; })}</ul></section>
            <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">i</span><h2 className="text-xl font-bold">Helpful Reminder</h2></div><p className="text-sm">This is a research aid, not a rating calculator or decision. VA evaluates ratings under the applicable schedule and the complete evidentiary record.</p></section>
          </aside>
        </div>
        <div className="ui-actions"><Link href="/secondary/service-connected" className="ui-button-secondary">← Back to Step 2</Link><button type="submit" className="ui-button">Continue to Step 4 <span aria-hidden="true">→</span></button></div>
      </form>
    </main>
  );
}
