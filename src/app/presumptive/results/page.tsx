import Link from "next/link";

import { DisclaimerFooter } from "@/components/Disclaimer";
import { loadExposureCatalog } from "@/lib/presumptive/load";
import { matchPresumptives, serviceHistorySchema } from "@/lib/presumptive/match";
import type { PresumptiveCondition } from "@/lib/presumptive/schema";

export const dynamic = "force-dynamic";

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map((v) => v.trim()).filter(Boolean);
}

function toDate(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  const monthIndex = Number(month) - 1;
  const dayNumber = Number(day);
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  if (!year || Number.isNaN(monthIndex) || Number.isNaN(dayNumber)) {
    return iso;
  }
  const monthLabel = monthNames[monthIndex];
  if (!monthLabel || dayNumber < 1 || dayNumber > 31) {
    return iso;
  }

  return `${monthLabel} ${dayNumber}, ${year}`;
}

function groupConditions(
  conditions: PresumptiveCondition[],
): [string, PresumptiveCondition[]][] {
  const groups = new Map<string, PresumptiveCondition[]>();
  for (const condition of conditions) {
    groups.set(condition.group, [...(groups.get(condition.group) ?? []), condition]);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export default async function PresumptiveResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const parsed = serviceHistorySchema.safeParse({
    locations: toArray(params.location),
    serviceStart: toDate(params.serviceStart),
    serviceEnd: toDate(params.serviceEnd),
  });

  if (!parsed.success) {
    return (
      <main>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nothing to show yet
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {parsed.error.issues[0]?.message ??
            "Select at least one location where you served."}
        </p>
        <Link
          href="/presumptive"
          className="mt-6 inline-block text-sm underline hover:text-slate-900"
        >
          Back to service history
        </Link>
      </main>
    );
  }

  const result = matchPresumptives(loadExposureCatalog(), parsed.data);

  return (
    <main>
      <Link href="/presumptive" className="text-sm underline hover:text-slate-900">
        Back to service history
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        Presumptions that may apply
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Based on {parsed.data.locations.join(", ")}
        {parsed.data.serviceStart && parsed.data.serviceEnd
          ? `, ${formatDate(parsed.data.serviceStart)} to ${formatDate(parsed.data.serviceEnd)}`
          : ""}
        .
      </p>

      <div
        role="note"
        className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900"
      >
        <p className="font-semibold">This is not an eligibility decision.</p>
        <p className="mt-1">
          A presumption removes the need to prove your service caused the
          condition. It does not remove the need for a current diagnosis, and
          VA can rebut a presumption with affirmative evidence.
        </p>
      </div>

      {result.hasUnconfirmedDates && (
        <div className="mt-4 rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Service dates not provided</p>
          <p className="mt-1">
            These matches rest on location alone. Each qualifying window below
            shows its dates. Check yours against your DD-214.
          </p>
        </div>
      )}

      {result.unmatchedLocations.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">No presumption matched</p>
          <p className="mt-1">
            {result.unmatchedLocations.join(", ")}. Either the location has no
            presumption in this app, or your dates fall outside its window. You
            can still file a claim with evidence linking the condition to
            service.
          </p>
        </div>
      )}

      {result.matches.length === 0 ? (
        <p className="mt-6 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-700">
          No presumption in this app matches that service history. Other
          presumptive categories exist, including Camp Lejeune, radiation, and
          Gulf War illnesses, which are not yet covered here.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {result.matches.map(({ category, matchedPeriods, conditions }) => (
            <article
              key={category.id}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-slate-900">
                {category.name}
              </h2>
              <p className="mt-1 text-xs text-slate-500">{category.authority}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                {category.summary}
              </p>

              <section className="mt-4 rounded-md bg-slate-50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Why this may apply to you
                </h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {matchedPeriods.map(({ period, matchedLocations }) => (
                    <li key={period.id}>
                      <span className="font-medium text-slate-900">
                        {matchedLocations.join(", ")}
                      </span>{" "}
                      &mdash; {formatDate(period.startDate)} to{" "}
                      {period.endDate ? formatDate(period.endDate) : "present"}
                      {period.note && (
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {period.note}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Presumptive conditions ({conditions.length})
                </h3>
                {groupConditions(conditions).map(([group, items]) => (
                  <div key={group} className="mt-3">
                    <h4 className="text-sm font-medium text-slate-900">{group}</h4>
                    <ul className="mt-1.5 space-y-1.5">
                      {items.map((condition) => (
                        <li key={condition.conditionId} className="text-sm text-slate-700">
                          {condition.name}
                          {condition.qualifier && (
                            <span className="mt-0.5 block text-xs text-amber-800">
                              {condition.qualifier}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>

              <section className="mt-4 border-t border-slate-200 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sources
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {category.sourceReferences.map((reference) => (
                    <li key={reference.citation} className="text-sm text-slate-700">
                      <a
                        href={reference.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-slate-900 underline"
                      >
                        {reference.citation}
                      </a>
                      {!reference.verified && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                          unverified
                        </span>
                      )}
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {reference.note}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-slate-500">
                  List last checked against the VA source on{" "}
                  {formatDate(category.sourceCheckedOn)}. Presumptive lists
                  change; confirm at va.gov before relying on this.
                </p>
              </section>
            </article>
          ))}
        </div>
      )}

      <DisclaimerFooter />
    </main>
  );
}
