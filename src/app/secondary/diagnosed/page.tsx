import Link from "next/link";

import { DisclaimerBanner, DisclaimerFooter } from "@/components/Disclaimer";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { mappedConditionIds } from "@/lib/kb/lookup";

export default function DiagnosedConditionsPage() {
  const catalog = loadConditionCatalog();
  const mapped = mappedConditionIds(loadKnowledgeBase());
  const conditions = [...catalog].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main>
      <Link href="/secondary" className="text-sm underline hover:text-slate-900">
        Back to workflow overview
      </Link>

      <header className="mt-3 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 1 of 6</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Select diagnosed conditions</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Choose every diagnosis you want to evaluate in this session. The list comes from the
          condition catalog and does not infer anything from free text.
        </p>
      </header>

      <div className="mb-6">
        <DisclaimerBanner />
      </div>

      <form action="/secondary/service-connected" method="get">
        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">Diagnosed conditions</legend>
          <p className="mt-1 text-sm text-slate-600">
            Select one or more conditions, then continue.
          </p>

          <ul className="mt-3 max-h-[28rem] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white">
            {conditions.map((condition) => (
              <li key={condition.id}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    name="diagnosed"
                    value={condition.id}
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700">
                    <span className="block font-medium text-slate-900">{condition.name}</span>
                    <span className="block text-xs text-slate-500">{condition.bodySystem}</span>
                  </span>
                  {mapped.has(condition.id) ? (
                    <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      research available
                    </span>
                  ) : (
                    <span className="ml-auto shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                      no mappings yet
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <button
          type="submit"
          className="mt-6 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Continue to service-connected status
        </button>
      </form>

      <DisclaimerFooter />
    </main>
  );
}
