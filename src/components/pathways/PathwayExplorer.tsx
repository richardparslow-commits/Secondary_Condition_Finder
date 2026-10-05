import type {
  CompositeNexusView,
  GraphPathwayExplorerView,
  GraphPathwayView,
  NexusClassificationView,
} from "@/lib/engine/pathway-view";
import {
  COMPOSITE_NEXUS_SUMMARY,
  NEXUS_CLAIM_LABEL,
} from "@/lib/evidence/pathway-mapper";

/**
 * PathwayExplorer — the adjacency graph's first user-facing surface.
 *
 * Renders the validated graph traversal (`buildPathwayExplorerView`) as a
 * read-only index: one card per origin node, one chain per terminal condition,
 * and one labelled row per hop. The surface exists for transparency — the
 * engine yields association-only pathways precisely so an association-strength
 * lead is visible rather than silently dropped — and its honesty contract is
 * therefore structural, not decorative:
 *
 *   - every hop carries its legal classification badge and the shared
 *     `NEXUS_CLAIM_LABEL` explanation (association-only reads "no nexus claim
 *     asserted");
 *   - the composite nexus is rendered through the shared
 *     `COMPOSITE_NEXUS_SUMMARY`, and any `ASSOCIATION_ONLY_CHAIN_BROKEN`
 *     pathway additionally gets an explicit chain-break notice
 *     (`CHAIN_BREAK_NOTICE`) — a hypothesized link may never read as an
 *     established nexus;
 *   - every hop additionally lists its authored citation anchors with the
 *     corpus's own verification flag (`Verified` / `Unverified`), so a
 *     reviewer can triage unverified evidence from the page itself — the
 *     surface verifies, derives, and reinterprets nothing;
 *   - empty states (no graph, or an origin with no authored edges) say
 *     plainly that an empty result is not a finding;
 *   - raw enum values never reach the DOM: badges use human labels only.
 *
 * The component is a server-rendered presentation layer: it takes plain data,
 * imports no data loaders, performs no fetching, and makes no legal
 * interpretation of its own.
 */

/**
 * The chain-break disclosure shown on every pathway whose composite nexus is
 * `ASSOCIATION_ONLY_CHAIN_BROKEN`. Exported so tests pin the exact semantics
 * ("a research lead, not a nexus") instead of a paraphrase.
 */
export const CHAIN_BREAK_NOTICE =
  "An association-only link measures population-level co-occurrence or prognosis, not a statutory nexus theory under 38 CFR § 3.310. The legal chain is broken end-to-end, so this pathway cannot carry a secondary or tertiary service-connection claim. It is shown so the research lead stays visible — never as an established nexus.";

/** Page- and card-level guard shown wherever a chain is rendered. */
export const POPULATION_LEVEL_GUARD =
  "These routes are authored population-level evidence summaries. No chain on this page establishes causation, aggravation, service connection, or a rating for any individual — even a direct-causation chain still needs the statutory elements and an individual medical nexus opinion.";

/** Explicit empty-graph state; an empty graph is never rendered as a finding. */
export const EMPTY_GRAPH_NOTICE =
  "No adjacency pathways are registered yet. An empty graph is not a finding: it is not evidence for or against any relationship, and it does not mean a secondary condition does not exist.";

/** Explicit empty-origin state for a node whose edge list is empty. */
export const EMPTY_ORIGIN_NOTICE =
  "No outgoing adjacency edges are authored for this condition yet. An empty result is not a finding: it is not evidence for or against any relationship.";

/**
 * Reviewer-triage explanation shown once above the anchor lists. The anchors
 * are the authored corpus's `sourceReferences`, joined to each hop for index
 * purposes; their `Verified` / `Unverified` status is the corpus's own flag,
 * not a fresh judgment made by this surface.
 */
export const CITATION_TRIAGE_GUARD =
  "Citation anchors are listed for reviewer triage. Unverified anchors have not been confirmed by a qualified human against that hop's bounded proposition and are research starting points only — a citation's verification status never changes a chain's legal break.";

/** Visual identity of one hop's legal nexus badge (mirrors the Step 6 table). */
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

export function PathwayExplorer({ view }: { view: GraphPathwayExplorerView }) {
  if (view.origins.length === 0) {
    return (
      <section className="ui-card mt-5" role="status">
        <h2 className="text-xl font-bold">No adjacency pathways are registered yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{EMPTY_GRAPH_NOTICE}</p>
      </section>
    );
  }

  return (
    <>
      <div role="note" className="ui-callout mt-5">
        <p className="font-semibold">
          Viewing {plural(view.totalPathways, "authored pathway", "authored pathways")} from{" "}
          {plural(view.origins.length, "origin condition", "origin conditions")}.{" "}
          {view.chainBrokenPathways === 0
            ? "No pathway on this page is association-only."
            : `${plural(view.chainBrokenPathways, "pathway is", "pathways are")} association-only, and ${
                view.chainBrokenPathways === 1 ? "its" : "their"
              } legal chain is broken below.`}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{POPULATION_LEVEL_GUARD}</p>
        {view.totalAnchors > 0 && (
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            {view.unverifiedAnchors === 0
              ? `All ${plural(view.totalAnchors, "citation anchor", "citation anchors")} on this page are verified by qualified-human review.`
              : `Awaiting qualified-human verification: ${view.unverifiedAnchors} of the ${plural(
                  view.totalAnchors,
                  "citation anchor",
                  "citation anchors",
                )} shown on this page.`}
          </p>
        )}
        {view.totalAnchors > 0 && (
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{CITATION_TRIAGE_GUARD}</p>
        )}
      </div>

      {view.origins.map((origin) => (
        <section
          key={origin.originConditionId}
          className="ui-card mt-5"
          aria-labelledby={`pathway-origin-${origin.originConditionId}`}
        >
          <div className="ui-heading-row">
            <span className="ui-icon" aria-hidden="true">↗</span>
            <div>
              <h2 id={`pathway-origin-${origin.originConditionId}`} className="text-xl font-bold">
                {origin.originConditionName}
              </h2>
              <p className="font-mono text-xs text-slate-500">{origin.originConditionId}</p>
            </div>
          </div>

          {origin.pathways.length === 0 ? (
            <p role="status" className="mt-3 text-sm leading-relaxed text-slate-700">
              {EMPTY_ORIGIN_NOTICE}
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {origin.pathways.map((pathway, pathwayIndex) => (
                <PathwayCard
                  // Index-based key: React serializes keys into the RSC
                  // payload embedded in the served HTML, so interpolating the
                  // nexus enum here would leak raw enum values past the
                  // label-only badge boundary.
                  key={`${origin.originConditionId}-pathway-${pathwayIndex}`}
                  pathway={pathway}
                />
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}

function PathwayCard({ pathway }: { pathway: GraphPathwayView }) {
  const compositeBadge = COMPOSITE_NEXUS_BADGE[pathway.compositeNexus];
  const chainBroken = pathway.compositeNexus === "ASSOCIATION_ONLY_CHAIN_BROKEN";

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">
          {pathway.hops[0]?.sourceConditionName ?? pathway.terminalConditionName}
          {" → "}
          {pathway.terminalConditionName}
        </h3>
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${compositeBadge.className}`}
        >
          {compositeBadge.label}
        </span>
      </header>

      <p className="mt-1 text-sm leading-relaxed text-slate-700">
        {COMPOSITE_NEXUS_SUMMARY[pathway.compositeNexus]}
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
        {pathway.hops.map((hop) => {
          const badge = NEXUS_BADGE[hop.nexusClassification];
          return (
            <li
              key={hop.stepIndex}
              className="rounded-md border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  Hop {hop.stepIndex + 1}: {hop.sourceConditionName} → {hop.targetConditionName}
                </p>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {NEXUS_CLAIM_LABEL[hop.nexusClassification]}
              </p>
              {hop.anchors.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                          <span className="font-mono text-xs text-slate-900">
                            {anchor.label}
                          </span>
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
