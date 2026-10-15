"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { DisclaimerFooter } from "@/components/Disclaimer";
import { PrivacyDeletionCue } from "@/components/privacy/PrivacyDeletionCue";
import { AccreditedRepresentativeFinder } from "@/components/va/AccreditedRepresentativeFinder";
import { SECONDARY_CAUSED_BY_TITLE } from "@/lib/legal/secondary-title";
import { clearPresumptiveLocalState } from "@/lib/presumptive/browser-history";
import {
  buildPresumptiveCrossLinks,
  type PresumptiveCrossLinkIndex,
} from "@/lib/presumptive/cross-link";
import { matchPresumptives, type ServiceHistory } from "@/lib/presumptive/match";
import { useBrowserServiceHistory } from "@/lib/presumptive/use-browser-history";
import type {
  ExposureCatalog,
  PresumptiveCondition,
} from "@/lib/presumptive/schema";

/**
 * Presumptive results view (PRIV-01 follow-on, 2026-10-08).
 *
 * Renders the presumptive matches for the confirmed service history held in
 * this browser tab. The record is read here, in the client, and matching runs
 * over the public exposure catalog the server passed in — no service location,
 * branch or date is sent to the server, put in a URL, or stored in a cookie.
 *
 * Everything the server supplies is public and identical for every visitor:
 * the authored exposure catalog, a published-mapping index for the
 * presumptive × secondary research cue, and the public service-branch
 * reference. The accredited-representative directory view is not among them:
 * audit A01 moved that lookup into a Server Action whose ZIP travels in the
 * request body, so this page neither reads a query parameter nor receives a
 * per-visitor directory view.
 */

/** Public service-branch reference, passed through from the server loader. */
export interface PresumptiveBranchReference {
  items: { code: string; description: string }[];
  sourceLabel: string;
}

export interface PresumptiveResultsProps {
  categories: ExposureCatalog;
  crossLinkIndex: PresumptiveCrossLinkIndex;
  branchReference: PresumptiveBranchReference | null;
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

export function PresumptiveResults(props: PresumptiveResultsProps) {
  const { history, ready } = useBrowserServiceHistory();

  if (!ready) {
    return (
      <main>
        <p role="status" className="mt-2 text-sm text-slate-600">
          Loading your browser-local service history…
        </p>
      </main>
    );
  }

  if (!history) {
    return (
      <main>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nothing to show yet
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Select at least one location where you served.
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

  return <PresumptiveResultsBody history={history} {...props} />;
}

function PresumptiveResultsBody({
  history,
  categories,
  crossLinkIndex,
  branchReference,
}: PresumptiveResultsProps & { history: ServiceHistory }) {
  const router = useRouter();
  const result = useMemo(
    () => matchPresumptives(categories, history),
    [categories, history],
  );

  const branchCodes = history.serviceBranchCodes ?? [];
  const branchNames = branchCodes.map((code) => {
    const match = branchReference?.items.find((item) => item.code === code);
    return match ? `${match.description} (${match.code})` : code;
  });

  const crossLinks = buildPresumptiveCrossLinks(
    result.matches.flatMap(({ conditions }) => conditions),
    crossLinkIndex,
  );

  const hasCompleteDateRange = Boolean(history.serviceStart && history.serviceEnd);
  const hasPartialDateRange =
    Boolean(history.serviceStart) !== Boolean(history.serviceEnd);
  const serviceDateSummary = history.serviceStart && history.serviceEnd
    ? `, ${formatDate(history.serviceStart)} to ${formatDate(history.serviceEnd)}`
    : history.serviceStart
      ? `, start date ${formatDate(history.serviceStart)}; end date not provided`
      : history.serviceEnd
        ? `, end date ${formatDate(history.serviceEnd)}; start date not provided`
        : "";

  function clearHistory() {
    clearPresumptiveLocalState(window.sessionStorage);
    router.push("/presumptive");
  }

  return (
    <main>
      <Link href="/presumptive" className="text-sm underline hover:text-slate-900">
        Back to service history
      </Link>

      <button type="button" onClick={clearHistory} className="ui-button-secondary mt-3">
        Clear saved service history
      </button>

      {/* Clearing removes what this browser holds; it cannot reach what the
          application keeps. The pointer is the same shared component the
          secondary track's completion controls render, so a visitor who has
          just cleared their service history can start a deletion request from
          here instead of only from the policy — and the sentence says which
          deletion this control performed. Guarded by
          tests/privacy-deletion-pointer.test.tsx. */}
      <div className="mt-2">
        <PrivacyDeletionCue clearedStatement="Clearing saved service history clears what this browser holds." />
      </div>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        Presumptions that may apply
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Based on {history.locations.join(", ")}{serviceDateSummary}.
      </p>
      <p className="mt-1 text-xs text-muted">
        This service history is stored in this browser tab only. It is not sent
        to the server and is not saved in a cookie.
      </p>

      {branchNames.length > 0 && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Service branch reference</p>
          <p className="mt-1">{branchNames.join(", ")}</p>
          <p className="mt-1 text-xs text-slate-600">
            Source: {branchReference?.sourceLabel}. This is stored as administrative reference context only and did not change the presumptive matching result.
          </p>
        </div>
      )}

      <div
        role="note"
        className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900"
      >
        <p className="font-semibold">This is not an eligibility decision.</p>
        <p className="mt-1">
          A presumption removes the need to prove your service caused the
          condition. It does not remove the need to establish the qualifying
          condition, and VA can rebut a presumption with affirmative evidence.
        </p>
      </div>

      {crossLinks.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Also researchable in the secondary track</p>
          <p className="mt-1">
            Some conditions above can also be researched as secondary conditions — that is,
            caused or worsened by a different condition you already have. The secondary track
            uses a different legal framework from presumptive service connection.
          </p>
          <ul className="mt-2 space-y-1">
            {crossLinks.map((link) => (
              <li key={link.name}>
                <span className="font-medium text-slate-900">{link.name}</span>
                {" "}
                &mdash; suggested in this app as a possible secondary of{" "}
                {link.primaryNames.join(", ")}.
              </li>
            ))}
          </ul>
          <p className="mt-2">
            To explore those pathways, use{" "}
            <Link
              href="/secondary/condition-caused-by"
              className="underline hover:text-slate-900"
            >
              {SECONDARY_CAUSED_BY_TITLE}
            </Link>
            . This is a research cue only, not a determination about your claim.
          </p>
        </div>
      )}

      {!hasCompleteDateRange && (
        <div className="mt-4 rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">
            {hasPartialDateRange ? "Service date range incomplete" : "Service dates not provided"}
          </p>
          <p className="mt-1">
            {hasPartialDateRange
              ? "One service-date boundary is missing. The supplied date is used only to rule out periods that are impossible; any remaining match is not date-confirmed until both boundaries are provided."
              : "These matches rest on location alone because no service dates were provided."}{" "}
            Each qualifying window below shows its dates. Check your complete service interval against your records.
          </p>
        </div>
      )}

      {result.hasUnconfirmedDates && hasCompleteDateRange && (
        <div className="mt-4 rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Service dates require verification</p>
          <p className="mt-1">
            At least one match could not be date-confirmed. Check the qualifying window below against your service records.
          </p>
        </div>
      )}

      {result.unmatchedLocations.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">No presumption matched</p>
          <p className="mt-1">
            {result.unmatchedLocations.join(", ")}. Either the location has no
            presumption in this app, or the service-date information you supplied
            rules out its authored qualifying window. You can still research other
            service-connection pathways and supporting evidence.
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
              <p className="mt-1 text-xs text-muted">{category.authority}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                {category.summary}
              </p>

              <section className="mt-4 rounded-md bg-slate-50 p-4">
                <h3 className="text-xs font-semibold text-muted">
                  Why this may apply to you
                </h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {matchedPeriods.map(({ period, matchedLocations, datesConfirmed }) => (
                    <li key={period.id}>
                      <span className="font-medium text-slate-900">
                        {matchedLocations.join(", ")}
                      </span>{" "}
                      &mdash; {formatDate(period.startDate)} to{" "}
                      {period.endDate ? formatDate(period.endDate) : "present"}
                      {!datesConfirmed && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                          date range unconfirmed
                        </span>
                      )}
                      {period.note && (
                        <span className="mt-0.5 block text-xs text-muted">
                          {period.note}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-4">
                <h3 className="text-xs font-semibold text-muted">
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
                <h3 className="text-xs font-semibold text-muted">
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
                      <span className="mt-0.5 block text-xs text-muted">
                        {reference.note}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-muted">
                  List last checked against the VA source on{" "}
                  {formatDate(category.sourceCheckedOn)}. Presumptive lists
                  change; confirm at va.gov before relying on this.
                </p>
              </section>
            </article>
          ))}
        </div>
      )}

      <div className="mt-8">
        <AccreditedRepresentativeFinder returnTo="/presumptive/results" />
      </div>

      <DisclaimerFooter />
    </main>
  );
}
