import Link from "next/link";

import { DisclaimerBanner, DisclaimerFooter } from "@/components/Disclaimer";
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
        <h1 className="text-2xl font-semibold tracking-tight">Select diagnosed conditions first</h1>
        <p className="mt-2 text-sm text-slate-600">
          Choose at least one diagnosed condition before setting service-connected status.
        </p>
        <Link href="/secondary/diagnosed" className="mt-5 inline-block text-sm underline hover:text-slate-900">
          Back to diagnosed conditions
        </Link>
      </main>
    );
  }

  const selectedServiceConnectedIds = new Set(session.serviceConnectedConditionIds ?? []);
  const hasPriorSelection = session.serviceConnectedConditionIds !== undefined;
  const diagnosed = diagnosedConditionIds
    .map((id) => byId.get(id))
    .filter((condition): condition is NonNullable<typeof condition> => condition !== undefined);

  return (
    <main>
      <Link href="/secondary/diagnosed" className="text-sm underline hover:text-slate-900">
        Back to diagnosed conditions
      </Link>

      <header className="mt-3 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 2 of 6</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Mark service-connected status</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          For each diagnosed condition you selected, mark whether VA has already service connected it.
        </p>
      </header>

      <div className="mb-6"><DisclaimerBanner /></div>

      <form action={saveServiceConnectedSelection} className="space-y-4">
        {diagnosed.map((condition) => (
          <fieldset key={condition.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <legend className="text-sm font-semibold text-slate-900">{condition.name}</legend>
            <p className="mt-1 text-xs text-slate-500">{condition.bodySystem}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input type="radio" name={`serviceConnected-${condition.id}`} value="yes" defaultChecked={hasPriorSelection ? selectedServiceConnectedIds.has(condition.id) : true} className="h-4 w-4 border-slate-300" />
                Yes, already service connected
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" name={`serviceConnected-${condition.id}`} value="no" defaultChecked={hasPriorSelection ? !selectedServiceConnectedIds.has(condition.id) : false} className="h-4 w-4 border-slate-300" />
                No, not service connected
              </label>
            </div>
          </fieldset>
        ))}
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700">
          Continue to current ratings
        </button>
      </form>
      <DisclaimerFooter />
    </main>
  );
}
