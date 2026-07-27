import type { Recommendation } from "@/lib/engine/types";

const PREVALENCE_LABEL: Record<Recommendation["prevalence"], string> = {
  "commonly-explored": "Commonly explored",
  "sometimes-explored": "Sometimes explored",
  "occasionally-explored": "Occasionally explored",
};

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
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
          {PREVALENCE_LABEL[recommendation.prevalence]}
        </span>
      </header>

      {primaryContext && (
        <p className="mt-2 text-sm text-slate-700">
          <span className="font-medium text-slate-900">Service-connected primary: </span>
          {primaryContext.name}
        </p>
      )}

      {primaryContext && (
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          <span className="font-medium text-slate-900">Why this may be worth exploring: </span>
          {primaryContext.rationale}
        </p>
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
