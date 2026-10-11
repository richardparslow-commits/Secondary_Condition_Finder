import type { Recommendation } from "@/lib/engine/types";
import {
  CONSENSUS_BADGE_CLASS,
  CONSENSUS_EXPLANATION,
  CONSENSUS_LABEL,
  consensusTone,
} from "@/lib/recommendation-prevalence";

export function SuggestionCard({
  recommendation,
  position,
}: {
  recommendation: Recommendation;
  position: number;
}) {
  const unverified = recommendation.sourceReferences.some(
    (reference) => !reference.verified,
  );

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">
          {position}. {recommendation.condition}
        </h3>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${CONSENSUS_BADGE_CLASS[consensusTone(recommendation.etiologicalConsensus)]}`}
          title={CONSENSUS_EXPLANATION[recommendation.etiologicalConsensus]}
        >
          {CONSENSUS_LABEL[recommendation.etiologicalConsensus]}
        </span>
      </header>
      <p className="mt-2 text-xs text-muted">
        {CONSENSUS_EXPLANATION[recommendation.etiologicalConsensus]}
      </p>

      <section className="mt-4">
        <h4 className="text-xs font-semibold text-muted">
          How this could relate to your service-connected condition(s)
        </h4>
        <ul className="mt-2 space-y-2">
          {recommendation.contributingPrimaries.map((primary) => (
            <li key={primary.id} className="text-sm leading-relaxed text-slate-700">
              <span className="font-medium text-slate-900">{primary.name}:</span>{" "}
              {primary.rationale}
            </li>
          ))}
        </ul>
      </section>

      {recommendation.matchedIntakeContext.length > 0 && (
        <section className="mt-4">
          <h4 className="text-xs font-semibold text-muted">
            Context you provided
          </h4>
          <p className="mt-1 text-sm text-slate-700">
            {recommendation.matchedIntakeContext.join(", ")}
          </p>
        </section>
      )}

      <section className="mt-4 rounded-md bg-slate-50 p-4">
        <h4 className="text-xs font-semibold text-muted">
          What a claim on this theory typically still needs
        </h4>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {recommendation.evidenceGaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </section>

      <section className="mt-4">
        <h4 className="text-xs font-semibold text-muted">
          Starting points for verification
        </h4>
        <ul className="mt-2 space-y-1.5">
          {recommendation.sourceReferences.map((reference) => (
            <li key={reference.citation} className="text-sm text-slate-700">
              <span className="font-mono text-xs text-slate-900">
                {reference.citation}
              </span>
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
        {unverified && (
          <p className="mt-3 text-xs text-amber-800">
            Citations marked unverified have not been confirmed by a qualified
            reviewer. Check them against current VA guidance before relying on
            them.
          </p>
        )}
      </section>
    </article>
  );
}
