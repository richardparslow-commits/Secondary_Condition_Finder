import Link from "next/link";

import { SecondaryWorkflowHiddenFields } from "@/components/SecondaryWorkflowHiddenFields";
import { indexById } from "@/lib/catalog/lookup";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { first, toBackQuery } from "@/lib/query";
import { VALID_RATINGS } from "@/lib/secondary-workflow/ratings";
import {
  parseRatingsPrefill,
  parseServiceConnectedPrefill,
  ratingFieldName,
  type QueryParams,
  type QueryValue,
} from "@/lib/secondary-workflow/state";

interface PageProps {
  searchParams: Promise<QueryParams>;
}

interface RatingOption {
  label: string;
  value: string;
}

function normalizeDocumentsShared(value: QueryValue): boolean | undefined {
  const firstValue = first(value);
  if (firstValue === "yes") return true;
  if (firstValue === "no") return false;
  return undefined;
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

export default async function RatingsPage({ searchParams }: PageProps) {
  const catalog = loadConditionCatalog();
  const catalogById = indexById(catalog);
  const params = await searchParams;
  const { diagnosedConditionIds, serviceConnectedConditionIds } = parseServiceConnectedPrefill(
    params,
    catalog,
  );
  const ratingsByConditionId = parseRatingsPrefill(params, serviceConnectedConditionIds);
  const documentsShared = normalizeDocumentsShared(params.documentsShared);
  const ratingOptions = getRatingOptions();
  const backQuery = toBackQuery(params);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Current Disability Ratings</h1>
      <p className="text-sm text-gray-600">
        Select your current percentage rating for each service-connected condition.
      </p>

      <form method="GET" action="/secondary/upload" className="space-y-4">
        <SecondaryWorkflowHiddenFields
          diagnosedConditionIds={diagnosedConditionIds}
          serviceConnectedConditionIds={serviceConnectedConditionIds}
          documentsShared={documentsShared}
        />

        {serviceConnectedConditionIds.length === 0 ? (
          <p className="text-gray-500 italic">No service-connected conditions selected.</p>
        ) : (
          serviceConnectedConditionIds.map((conditionId) => {
            const fieldName = ratingFieldName(conditionId);
            const rawValue = first(params[fieldName]);
            const currentValue =
              rawValue === "decline"
                ? "decline"
                : typeof ratingsByConditionId[conditionId] === "number"
                  ? String(ratingsByConditionId[conditionId])
                  : "";
            const conditionName =
              catalogById.get(conditionId)?.name ?? conditionId.replace(/-/g, " ");

            return (
              <div key={conditionId} className="p-4 border rounded-lg bg-white space-y-2">
                <label className="block font-medium capitalize" htmlFor={fieldName}>
                  Rating for {conditionName}
                </label>
                <select
                  id={fieldName}
                  name={fieldName}
                  defaultValue={currentValue}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select current rating...</option>
                  {ratingOptions.map((rating) => (
                    <option key={rating.label} value={rating.value}>
                      {rating.label}
                    </option>
                  ))}
                  <option value="decline">I prefer not to answer</option>
                </select>
              </div>
            );
          })
        )}

        <div className="flex justify-between items-center pt-4">
          <Link
            href={`/secondary/service-connected${backQuery}`}
            className="text-blue-600 hover:underline"
          >
            Back
          </Link>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Continue to Upload
          </button>
        </div>
      </form>
    </div>
  );
}
