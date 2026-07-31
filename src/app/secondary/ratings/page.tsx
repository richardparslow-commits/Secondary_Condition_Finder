import Link from 'next/link';
import { VALID_RATINGS } from '@/lib/secondary-workflow';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RatingsPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const diagnosedRaw = resolvedParams.diagnosed;
  const diagnosedConditions = Array.isArray(diagnosedRaw)
    ? diagnosedRaw
    : diagnosedRaw
    ? [diagnosedRaw]
    : [];

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
        Select your current percentage rating for each diagnosed condition.
      </p>

      <form method="GET" action="/secondary/upload" className="space-y-4">
        {Object.entries(resolvedParams).map(([key, value]) =>
          Array.isArray(value) ? (
            value.map((v, i) => <input key={`${key}-${i}`} type="hidden" name={key} value={v} />)
          ) : value ? (
            <input key={key} type="hidden" name={key} value={value} />
          ) : null
        )}

        {diagnosedConditions.length === 0 ? (
          <p className="text-gray-500 italic">No service-connected conditions selected.</p>
        ) : (
          diagnosedConditions.map((conditionId) => {
            const ratingKey = `rating-${conditionId}`;
            const currentRatingValue = typeof resolvedParams[ratingKey] === 'string' ? resolvedParams[ratingKey] : '';

            return (
              <div key={conditionId} className="p-4 border rounded-lg bg-white space-y-2">
                <label className="block font-medium capitalize" htmlFor={ratingKey}>
                  Rating for {conditionId.replace(/-/g, ' ')}
                </label>
                <select
                  id={ratingKey}
                  name={ratingKey}
                  defaultValue={currentRatingValue}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select current rating...</option>
                  {VALID_RATINGS.map((rating) => (
                    <option key={rating} value={rating}>
                      {rating}
                    </option>
                  ))}
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
