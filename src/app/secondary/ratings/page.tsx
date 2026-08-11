import Link from "next/link";

import { indexById } from "@/lib/catalog/lookup";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { VALID_RATINGS } from "@/lib/secondary-workflow";
import { ratingFieldName } from "@/lib/secondary-workflow/state";
import { readSecondaryWorkflowSession } from "@/lib/secondary-workflow/session";
import { saveRatingsSelection } from "../actions";

interface RatingOption {
  label: string;
  value: string;
}

function getRatingOptions(): RatingOption[] {
  return Array.from(
    VALID_RATINGS.reduce((options, rating) => {
      const value = rating === "100% P&T" ? "100" : rating.replace("%", "");
      options.set(value, { label: rating, value });
      return options;
    }, new Map<string, RatingOption>()).values(),
  );
}

export const dynamic = "force-dynamic";

export default async function RatingsPage() {
  const catalog = loadConditionCatalog();
  const catalogById = indexById(catalog);
  const session = await readSecondaryWorkflowSession();
  const diagnosedConditionIds = session.diagnosedConditionIds ?? [];
  const serviceConnectedConditionIds = session.serviceConnectedConditionIds ?? [];
  const ratingsByConditionId = session.ratingsByConditionId ?? {};
  const ratingOptions = getRatingOptions();

  if (diagnosedConditionIds.length === 0 || serviceConnectedConditionIds.length === 0) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Set service-connected status first</h1>
        <p className="mt-2 text-sm text-slate-600">
          Complete the prior workflow steps before entering current ratings.
        </p>
        <Link href="/secondary/service-connected" className="mt-5 inline-block text-sm underline hover:text-slate-900">
          Back to service-connected status
        </Link>
      </main>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Current Disability Ratings</h1>
      <p className="text-sm text-gray-600">
        Select your current percentage rating for each service-connected condition.
      </p>

      <form action={saveRatingsSelection} className="space-y-4">
        {serviceConnectedConditionIds.map((conditionId) => {
          const fieldName = ratingFieldName(conditionId);
          const stored = ratingsByConditionId[conditionId];
          const currentValue = stored === null ? "decline" : typeof stored === "number" ? String(stored) : "";
          const conditionName = catalogById.get(conditionId)?.name ?? conditionId.replace(/-/g, " ");

          return (
            <div key={conditionId} className="p-4 border rounded-lg bg-white space-y-2">
              <label className="block font-medium capitalize" htmlFor={fieldName}>
                Rating for {conditionName}
              </label>
              <select id={fieldName} name={fieldName} defaultValue={currentValue} className="w-full p-2 border rounded">
                <option value="">Select current rating...</option>
                {ratingOptions.map((rating) => (
                  <option key={rating.label} value={rating.value}>{rating.label}</option>
                ))}
                <option value="decline">I prefer not to answer</option>
              </select>
            </div>
          );
        })}

        <div className="flex justify-between items-center pt-4">
          <Link href="/secondary/service-connected" className="text-blue-600 hover:underline">Back</Link>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Continue to Upload
          </button>
        </div>
      </form>
    </div>
  );
}
