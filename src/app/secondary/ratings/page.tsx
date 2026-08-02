import Link from 'next/link';
import { SecondaryWorkflowHiddenFields } from '@/components/SecondaryWorkflowHiddenFields';
import { VALID_RATINGS } from '@/lib/secondary-workflow';
import { indexById } from '@/lib/catalog/lookup';
import { loadConditionCatalog } from '@/lib/catalog/load';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RatingsPage({ searchParams }: PageProps) {
  const catalog = loadConditionCatalog();
  const catalogById = indexById(catalog);
  const resolvedParams = await searchParams;
  const diagnosedRaw = resolvedParams.diagnosed;
  const diagnosedConditions = Array.isArray(diagnosedRaw)
    ? diagnosedRaw
    : diagnosedRaw
    ? [diagnosedRaw]
    : [];
  const serviceConnectedRaw = resolvedParams.serviceConnected;
  const serviceConnectedConditions = Array.isArray(serviceConnectedRaw)
    ? serviceConnectedRaw
    : serviceConnectedRaw
    ? [serviceConnectedRaw]
    : diagnosedConditions.filter((id) => resolvedParams[`serviceConnected-${id}`] === "yes");
  const documentsSharedRaw = resolvedParams.documentsShared;
  const documentsSharedValue = Array.isArray(documentsSharedRaw)
    ? documentsSharedRaw[0]
    : documentsSharedRaw;
  const documentsShared =
    documentsSharedValue === 'yes' ? true : documentsSharedValue === 'no' ? false : undefined;
  const ratingOptions = VALID_RATINGS.map((rating) => ({
    label: rating,
    value: rating === '100% P&T' ? '100' : rating.replace('%', ''),
  }));

  const queryString = new URLSearchParams(
    Object.entries(resolvedParams).flatMap(([key, value]) =>
      Array.isArray(value) ? value.map((v) => [key, v]) : value ? [[key, value]] : []
    )
  ).toString();

  const backQuery = queryString ? `?${queryString}` : '';

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Current Disability Ratings</h1>
      <p className="text-sm text-gray-600">
        Select your current percentage rating for each service-connected condition.
      </p>

      <form method="GET" action="/secondary/upload" className="space-y-4">
        <SecondaryWorkflowHiddenFields
          diagnosedConditionIds={diagnosedConditions}
          serviceConnectedConditionIds={serviceConnectedConditions}
          documentsShared={documentsShared}
        />

        {serviceConnectedConditions.length === 0 ? (
          <p className="text-gray-500 italic">No service-connected conditions selected.</p>
        ) : (
          serviceConnectedConditions.map((conditionId) => {
            const ratingKey = `rating-${conditionId}`;
            const currentRatingValue = typeof resolvedParams[ratingKey] === 'string' ? resolvedParams[ratingKey] : '';
            const conditionName = catalogById.get(conditionId)?.name ?? conditionId.replace(/-/g, ' ');

            return (
              <div key={conditionId} className="p-4 border rounded-lg bg-white space-y-2">
                <label className="block font-medium capitalize" htmlFor={ratingKey}>
                  Rating for {conditionName}
                </label>
                <select
                  id={ratingKey}
                  name={ratingKey}
                  defaultValue={currentRatingValue}
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
