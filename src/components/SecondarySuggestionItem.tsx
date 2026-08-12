import type { Recommendation } from "@/lib/engine/types";
import {
  PREVALENCE_EXPLANATION,
  PREVALENCE_LABEL,
} from "@/lib/recommendation-prevalence";

interface Props {
  recommendation: Recommendation;
  primaryId: string;
}

export function SecondarySuggestionItem({ recommendation, primaryId }: Props) {
  const primaryContext = recommendation.contributingPrimaries.find(
    (primary) => primary.id === primaryId,
  );

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Possible secondary condition</p>
          <h3 className="text-base font-semibold text-slate-900">{recommendation.condition}</h3>
        </div>
        <span
          className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700"
          title={PREVALENCE_EXPLANATION[recommendation.prevalence]}
        >
          {PREVALENCE_LABEL[recommendation.prevalence]}
        </span>
      </header>
      <p className="mt-1.5 text-xs text-slate-500">
        {PREVALENCE_EXPLANATION[recommendation.prevalence]}
      </p>

      {primaryContext && (
        <p className="mt-2 text-sm text-slate-700">
          <span className="font-medium text-slate-900">Service-connected primary: </span>
          {primaryContext.name}
        </p>
      )}

      {primaryContext && (
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          <span className="font-medium text-slate-900">
            How this could relate to your service-connected condition:{" "}
          </span>
          {primaryContext.rationale}
        </p>
      )}

      {recommendation.matchedIntakeContext.length > 0 && (
        <section className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-900">
            Reported context appearing in this authored pathway
          </h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {recommendation.matchedIntakeContext.map((item) => (
              <span key={item} className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs text-blue-900">
                {item}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-700">
            This is a literal text-overlap cue only. It does not change recommendation rank or establish individual causation, aggravation, or medical nexus.
          </p>
        </section>
      )}

      <section className="mt-3 rounded-md bg-slate-50 p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Evidence that may help
        </h4>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {recommendation.evidenceGaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </section>

      {recommendation.sourceReferences.length > 0 && (
        <section className="mt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Mapped sources
          </h4>
          <ul className="mt-1.5 space-y-1.5">
            {recommendation.sourceReferences.slice(0, 3).map((reference) => (
              <li key={reference.citation} className="text-sm text-slate-700">
                <span className="font-mono text-xs text-slate-900">{reference.citation}</span>
                {!reference.verified && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                    unverified
                  </span>
                )}
                <span className="mt-0.5 block text-xs text-slate-500">{reference.note}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
