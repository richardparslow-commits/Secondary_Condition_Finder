import type { Recommendation } from "@/lib/engine/types";
import type {
  SecondaryPathwayType,
  SourceVerificationScope,
} from "@/lib/kb/schema";
import {
  PREVALENCE_EXPLANATION,
  PREVALENCE_LABEL,
} from "@/lib/recommendation-prevalence";

interface Props {
  recommendation: Recommendation;
  primaryId: string;
}

const PATHWAY_LABEL: Record<SecondaryPathwayType, string> = {
  "direct-secondary": "Direct secondary",
  aggravation: "Aggravation",
  "medication-related": "Medication-related",
  "treatment-complication": "Treatment complication",
  biomechanical: "Biomechanical / altered movement",
  "intermediate-chain": "Intermediate chain",
  "disease-progression": "Disease progression / known complication",
  somatopsychic: "Somatopsychic",
  neuroautonomic: "Neuroautonomic",
  "adaptive-equipment": "Adaptive equipment",
  "care-obstacle": "Care obstacle",
};

const SOURCE_ROLE_LABEL: Record<SourceVerificationScope, string> = {
  "legal-framework": "Legal framework",
  "clinical-evidence": "Clinical evidence",
  "procedural-guidance": "Procedural guidance",
};

export function SecondarySuggestionItem({ recommendation, primaryId }: Props) {
  const primaryContext = recommendation.contributingPrimaries.find(
    (primary) => primary.id === primaryId,
  );
  const pathwayIntelligence = primaryContext?.pathwayIntelligence;

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

      {pathwayIntelligence && (
        <section className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Pathway to evaluate
          </h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {pathwayIntelligence.pathways.map((pathway) => (
              <span
                key={pathway}
                className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800"
              >
                {PATHWAY_LABEL[pathway]}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-600">
            These are authored research theories for this primary-to-secondary mapping. They do not establish causation, aggravation, medical nexus, eligibility, or likelihood of approval.
          </p>

          {pathwayIntelligence.causalChain && (
            <div className="mt-3">
              <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Authored causal chain to review
              </h5>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                {pathwayIntelligence.causalChain}
              </p>
            </div>
          )}

          {pathwayIntelligence.developmentQuestions.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                Questions to develop with a clinician or representative
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {pathwayIntelligence.developmentQuestions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </details>
          )}

          {pathwayIntelligence.issuesToResolve.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                Issues to resolve
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {pathwayIntelligence.issuesToResolve.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
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
                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                  {SOURCE_ROLE_LABEL[reference.verificationScope]}
                </span>
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
