import Link from "next/link";

import type { NonServiceConnectedConditionResult as NonServiceConnectedConditionResultModel } from "@/lib/secondary-workflow/suggestions";
import type {
  SecondaryPathwayType,
  SourceVerificationScope,
} from "@/lib/kb/schema";
import type { VaConditionReferenceMatch } from "@/lib/va/condition-reference";
import type { VaApiEnvironment } from "@/lib/va/sandbox";

interface VaReferenceSummary {
  live: boolean;
  sourceLabel: string;
  environment: VaApiEnvironment | null;
  match: VaConditionReferenceMatch | null;
}

interface Props {
  result: NonServiceConnectedConditionResultModel;
  vaReference: VaReferenceSummary;
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

export function NonServiceConnectedConditionResult({ result, vaReference }: Props) {
  const recommendation = result.recommendation;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Diagnosed, not service connected
        </p>
        <h3 className="mt-1 text-xl font-bold text-slate-900">{result.conditionName}</h3>
        <p className="mt-1 text-sm text-slate-600">{result.bodySystem}</p>
      </header>

      {!recommendation ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <strong>No published relationship was found in the current knowledge base.</strong>
          <p className="mt-1">
            None of the service-connected conditions selected in this review currently has an authored published mapping to this diagnosis. That is not a medical conclusion that no relationship is possible; it means this tool does not have a supported match to show for this combination.
          </p>
        </div>
      ) : (
        <>
          <section className="mt-4">
            <h4 className="text-sm font-bold text-slate-900">
              Service-connected conditions that may be related to this diagnosis
            </h4>
            <p className="mt-1 text-sm text-slate-600">
              These are existing service-connected diagnoses with authored mappings that may support evaluating whether they caused, contributed to, aggravated, or otherwise medically relate to this non-service-connected condition. A mapping is a research lead, not an individual nexus finding.
            </p>

            <div className="mt-3 space-y-3">
              {recommendation.contributingPrimaries.map((primary) => {
                const pathwayIntelligence = primary.pathwayIntelligence;
                return (
                  <section key={primary.id} className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
                      Already service connected
                    </p>
                    <h5 className="mt-1 font-bold text-blue-950">{primary.name}</h5>
                    <p className="mt-2 text-sm leading-relaxed text-slate-800">
                      <span className="font-semibold">Why this relationship is worth evaluating: </span>
                      {primary.rationale}
                    </p>

                    {pathwayIntelligence && (
                      <div className="mt-3 border-t border-blue-200 pt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
                          Authored pathway to evaluate
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {pathwayIntelligence.pathways.map((pathway) => (
                            <span
                              key={pathway}
                              className="rounded-full border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-950"
                            >
                              {PATHWAY_LABEL[pathway]}
                            </span>
                          ))}
                        </div>
                        {pathwayIntelligence.causalChain && (
                          <p className="mt-2 text-sm leading-relaxed text-slate-800">
                            {pathwayIntelligence.causalChain}
                          </p>
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
                              Issues to resolve before relying on this theory
                            </summary>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                              {pathwayIntelligence.issuesToResolve.map((issue) => (
                                <li key={issue}>{issue}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </section>

          {(recommendation.intermediatePathways?.length ?? 0) > 0 && (
            <section className="mt-4 rounded-lg border border-violet-300 bg-violet-50 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-violet-900">Intermediate-chain research pathway</h4>
              <p className="mt-2 text-sm text-violet-950">
                This bounded two-step path is shown because both published edges connect a selected service-connected condition to this diagnosed condition through an intermediate condition. It is not a synthetic direct relationship or an individual nexus finding; each edge requires separate clinical support.
              </p>
              <div className="mt-3 space-y-3">
                {recommendation.intermediatePathways?.map((pathway) => (
                  <div key={`${pathway.primaryId}-${pathway.intermediateId}-${pathway.targetId}`} className="rounded-lg border border-violet-200 bg-white p-3">
                    <p className="font-semibold text-violet-950">{pathway.causalChain}</p>
                    <ol className="mt-2 space-y-2 text-sm text-slate-700">
                      {pathway.edges.map((edge, index) => (
                        <li key={`${edge.conditionId}-${edge.targetConditionId}`}>
                          <span className="font-medium">Edge {index + 1}:</span> {edge.conditionName} → {edge.targetConditionName} ({edge.nexusClassification}; {edge.etiologicalConsensus})
                          <p className="mt-1 text-xs text-slate-600">{edge.rationale}</p>
                          <p className="mt-1 text-xs text-slate-500">Provenance: {edge.sourceReferences.map((reference) => reference.citation).join(", ")}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </section>
          )}

          {recommendation.matchedIntakeContext.length > 0 && (
            <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Reported treatment context appearing in authored mapping text
              </h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {recommendation.matchedIntakeContext.map((item) => (
                  <span key={item} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800">
                    {item}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-600">
                This is literal text overlap only. It does not establish causation, aggravation, or medical nexus.
              </p>
            </section>
          )}

          {(recommendation.clinicalFrictionWarnings?.length ?? 0) > 0 && (
            <section className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-900">Alternative-etiology review</h4>
              <p className="mt-2 text-sm text-amber-950">Your reported history overlaps with an alternative cause listed for this authored mapping. This is a clinical-friction warning for discussion, not a finding that the alternative cause is present or that the mapped relationship fails.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950">{recommendation.clinicalFrictionWarnings?.map((warning) => <li key={`${warning.primaryId}-${warning.message}`}>{warning.message}</li>)}</ul>
            </section>
          )}

          {(recommendation.chronologyWarnings?.length ?? 0) > 0 && (
            <section className="mt-4 rounded-lg border border-orange-300 bg-orange-50 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-orange-900">Chronology question to resolve</h4>
              <p className="mt-2 text-sm text-orange-950">Approximate dates created a chronology question for this authored theory. Dates may reflect delayed diagnosis rather than onset, so review the underlying records with a qualified provider or representative.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-orange-950">{recommendation.chronologyWarnings?.map((warning) => <li key={`${warning.primaryId}-${warning.message}`}>{warning.message}</li>)}</ul>
            </section>
          )}

          {recommendation.evidenceGaps.length > 0 && (
            <section className="mt-4 rounded-lg bg-slate-50 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Evidence questions for this non-service-connected diagnosis
              </h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {recommendation.evidenceGaps.map((gap) => <li key={gap}>{gap}</li>)}
              </ul>
            </section>
          )}

          {recommendation.sourceReferences.length > 0 && (
            <section className="mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Sources supporting the mapped relationship(s)
              </h4>
              <ul className="mt-2 space-y-2">
                {recommendation.sourceReferences.slice(0, 3).map((reference) => (
                  <li key={`${reference.citation}-${reference.note}`} className="text-sm text-slate-700">
                    <span className="font-mono text-xs text-slate-900">{reference.citation}</span>
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                      {reference.verificationScope
                        ? SOURCE_ROLE_LABEL[reference.verificationScope]
                        : "Source role not specified"}
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
        </>
      )}

      <section className="mt-4 rounded-md border border-slate-200 p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          VA reference terminology for this diagnosis
        </h4>
        {!vaReference.live ? (
          <p className="mt-2 text-sm text-slate-700">
            VA reference data is unavailable or disabled, so no official terminology match is shown.
          </p>
        ) : vaReference.match?.term ? (
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">VBA terminology: </span>
            {vaReference.match.term.name}
            <span className="ml-2 font-mono text-xs text-slate-500">ID {vaReference.match.term.id}</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-700">
            No exact or curated VA reference terminology match was found for this local diagnosis label.
          </p>
        )}
        <p className="mt-2 text-xs text-slate-600">
          Reference source: {vaReference.sourceLabel}
          {vaReference.live && vaReference.environment ? ` (${vaReference.environment})` : ""}. Administrative terminology does not establish diagnosis, service connection, rating, or medical nexus.
        </p>
        <Link href="/va-reference" className="mt-2 inline-block text-xs font-medium underline">
          Explore the VA reference list
        </Link>
      </section>
    </article>
  );
}
