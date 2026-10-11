import type {
  CompositeNexusView,
  GraphPathwayMatchSectionView,
  GraphPathwayMatchView,
  NexusClassificationView,
} from "@/lib/engine/pathway-view";
import { COMPOSITE_NEXUS_SUMMARY, NEXUS_CLAIM_LABEL } from "@/lib/evidence/pathway-mapper";
import {
  CHAIN_BREAK_NOTICE,
  CITATION_TRIAGE_GUARD,
  POPULATION_LEVEL_GUARD,
} from "@/components/pathways/PathwayExplorer";

/**
 * GraphPathwayReview — the adjacency graph's results-step surface.
 *
 * Surfaces the signed adjacency-graph routes that connect the conditions a
 * Step 5 review actually selected: a service-connected origin and a diagnosed
 * non-service-connected condition, with any intermediate hops in between. The
 * routes are built server-side (`buildGraphPathwayMatchSectionView`) from the
 * same validated traversal the `/pathways` explorer renders, and this
 * component carries the association-only chain-break semantics exactly as the
 * explorer does — both surfaces import the one set of disclosure constants
 * and the one composite-nexus summary, so a hypothesized route can never
 * render as an established nexus on either.
 *
 * Honesty contract, structural rather than decorative:
 *
 *   - every hop carries its legal classification badge and the shared
 *     `NEXUS_CLAIM_LABEL` explanation (association-only reads "no nexus claim
 *     asserted");
 *   - the composite nexus renders through the shared `COMPOSITE_NEXUS_SUMMARY`,
 *     and any `ASSOCIATION_ONLY_CHAIN_BROKEN` match additionally gets the
 *     explicit chain-break notice — the chain is broken end-to-end and cannot
 *     carry a secondary or tertiary claim;
 *   - the section guard states that these routes are separate from the
 *     published-relationship results above, that the graph is deliberately
 *     incomplete and may include draft mappings, and that an absent route is
 *     not a finding;
 *   - the population-level guard and per-hop citation anchors travel with the
 *     authored corpus's own `verified` flag, so unverified evidence is
 *     triageable from the page;
 *   - raw enum values never reach the DOM: badges use human labels only.
 *
 * An empty match list renders nothing at all: in the results flow an absent
 * route must not be presented as evidence either way, and the page already
 * carries the "no match is not a negative medical opinion" guard.
 *
 * The component is a presentation layer: it takes plain data, imports no data
 * loaders, performs no fetching, and makes no legal interpretation of its own.
 */

/** Section heading, exported so tests pin the exact string. */
export const GRAPH_ROUTE_SECTION_HEADING = "Adjacency-graph research routes";

/**
 * Section guard, exported so tests pin the exact semantics. It must say that
 * these routes are additional to the published-relationship results, that the
 * graph can include draft mappings, and that an absent route is not a finding.
 */
export const GRAPH_ROUTE_SECTION_GUARD =
  "These routes are separate from the published-relationship results above: they come from the authored adjacency-graph layer, which is deliberately incomplete and can include mappings that are still drafts. An absent route is not a finding — it is not evidence for or against any relationship.";

/** Visual identity of one hop's legal nexus badge (mirrors the explorer). */
const NEXUS_BADGE: Record<NexusClassificationView, { label: string; className: string }> = {
  DIRECT_CAUSATION: {
    label: "Direct causation",
    className: "border-emerald-300 bg-emerald-100 text-emerald-900",
  },
  AGGRAVATION: {
    label: "Aggravation",
    className: "border-amber-300 bg-amber-100 text-amber-900",
  },
  ASSOCIATION_ONLY: {
    label: "Association only",
    className: "border-slate-300 bg-slate-100 text-slate-700",
  },
};

/** Human labels and tones for a whole chain's composite nexus. */
const COMPOSITE_NEXUS_BADGE: Record<CompositeNexusView, { label: string; className: string }> = {
  DIRECT_CAUSATION: {
    label: "Direct causation chain",
    className: "border-emerald-300 bg-emerald-100 text-emerald-900",
  },
  AGGRAVATION: {
    label: "Aggravation chain",
    className: "border-amber-300 bg-amber-100 text-amber-900",
  },
  ASSOCIATION_ONLY_CHAIN_BROKEN: {
    label: "Association only — chain broken",
    className: "border-slate-400 bg-slate-200 text-slate-900",
  },
};

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function GraphPathwayReview({ view }: { view: GraphPathwayMatchSectionView }) {
  if (view.matches.length === 0) return null;

  const chainBrokenMatches = view.matches.filter(
    (match) => match.compositeNexus === "ASSOCIATION_ONLY_CHAIN_BROKEN",
  ).length;

  return (
    <section
      className="mt-5 rounded-xl border border-slate-300 bg-slate-50 p-5"
      aria-labelledby="graph-pathway-review"
    >
      <h3 id="graph-pathway-review" className="text-xl font-bold text-slate-900">
        {GRAPH_ROUTE_SECTION_HEADING}
      </h3>
      <div role="note" className="ui-callout mt-3">
        <p className="font-semibold">
          {plural(view.matches.length, "authored graph route connects", "authored graph routes connect")}{" "}
          the conditions selected in this review.
          {chainBrokenMatches === view.matches.length
            ? " Every route below is association-only, and its legal chain is broken."
            : chainBrokenMatches > 0
              ? ` ${plural(chainBrokenMatches, "route is", "routes are")} association-only, and ${
                  chainBrokenMatches === 1 ? "its" : "their"
                } legal chain is broken below.`
              : " No route below is association-only."}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{GRAPH_ROUTE_SECTION_GUARD}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{POPULATION_LEVEL_GUARD}</p>
        {view.totalAnchors > 0 && (
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            {view.unverifiedAnchors === 0
              ? `All ${plural(view.totalAnchors, "citation anchor", "citation anchors")} on these routes are verified by qualified-human review.`
              : `Awaiting qualified-human verification: ${view.unverifiedAnchors} of the ${plural(
                  view.totalAnchors,
                  "citation anchor",
                  "citation anchors",
                )} shown on these routes.`}
          </p>
        )}
        {view.totalAnchors > 0 && (
          <p className="mt-1 text-xs leading-relaxed text-muted">{CITATION_TRIAGE_GUARD}</p>
        )}
      </div>

      <ul className="mt-4 space-y-4">
        {view.matches.map((match, matchIndex) => (
          <GraphPathwayMatchCard
            // Index-based key: React serializes keys into the RSC payload
            // embedded in the served HTML, so interpolating the nexus enum
            // here would leak raw enum values past the label-only badge
            // boundary.
            key={`graph-pathway-match-${matchIndex}`}
            match={match}
          />
        ))}
      </ul>
    </section>
  );
}

function GraphPathwayMatchCard({ match }: { match: GraphPathwayMatchView }) {
  const compositeBadge = COMPOSITE_NEXUS_BADGE[match.compositeNexus];
  const chainBroken = match.compositeNexus === "ASSOCIATION_ONLY_CHAIN_BROKEN";

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-base font-semibold text-slate-900">
          {match.originConditionName}
          {" → "}
          {match.terminalConditionName}
        </h4>
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${compositeBadge.className}`}
        >
          {compositeBadge.label}
        </span>
      </header>

      <p className="mt-1 text-sm leading-relaxed text-slate-700">
        {COMPOSITE_NEXUS_SUMMARY[match.compositeNexus]}
      </p>

      {chainBroken && (
        <div
          role="note"
          className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm leading-relaxed text-amber-950"
        >
          <p className="font-semibold">Chain broken — a research lead, not a nexus.</p>
          <p className="mt-1">{CHAIN_BREAK_NOTICE}</p>
        </div>
      )}

      <ol className="mt-3 space-y-2">
        {match.hops.map((hop) => {
          const badge = NEXUS_BADGE[hop.nexusClassification];
          return (
            <li key={hop.stepIndex} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  Hop {hop.stepIndex + 1}: {hop.sourceConditionName} → {hop.targetConditionName}
                </p>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {NEXUS_CLAIM_LABEL[hop.nexusClassification]}
              </p>
              {hop.anchors.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-muted">
                    Citation anchors
                  </p>
                  <ul className="mt-1 space-y-1">
                    {hop.anchors.map((anchor, anchorIndex) => (
                      <li
                        key={`${hop.sourceConditionId}-${hop.targetConditionId}-anchor-${anchorIndex}`}
                        className="flex flex-wrap items-center gap-2 text-xs"
                      >
                        {anchor.sourceUrl ? (
                          <a
                            className="font-mono text-xs text-slate-900 underline hover:text-slate-700"
                            href={anchor.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {anchor.label}
                          </a>
                        ) : (
                          <span className="font-mono text-xs text-slate-900">{anchor.label}</span>
                        )}
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            anchor.verified
                              ? "border-emerald-300 bg-emerald-100 text-emerald-900"
                              : "border-amber-300 bg-amber-100 text-amber-900"
                          }`}
                        >
                          {anchor.verified ? "Verified" : "Unverified"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </li>
  );
}
