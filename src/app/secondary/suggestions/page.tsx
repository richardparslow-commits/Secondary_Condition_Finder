import Link from "next/link";

import { SymptomDiscussionReview } from "@/components/SymptomDiscussionReview";
import { DisclaimerFooter } from "@/components/Disclaimer";
import { NonServiceConnectedConditionResult } from "@/components/NonServiceConnectedConditionResult";
import { RegulatoryPreflightStatus } from "@/components/RegulatoryPreflightStatus";
import { PrintReportButton } from "@/components/secondary/PrintReportButton";
import { SecondarySuggestionsTabs } from "@/components/secondary/SecondarySuggestionsTabs";
import type {
  TimelineConditionInput,
  TimelineConnectionInput,
} from "@/components/secondary/ConditionTimelineVisualization";
import { indexById } from "@/lib/catalog/lookup";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { recommend } from "@/lib/engine/recommend";
import { loadKnowledgeBase } from "@/lib/kb/load";
import {
  loadLockedRegulatorySnapshot,
  missingLockedRegulatorySnapshot,
  prepareRegulatoryReview,
  relevantChangesForSnapshot,
} from "@/lib/regulatory/preflight";
import { buildSecondaryRecommendationIntake } from "@/lib/secondary-workflow/recommendation-intake";
import { buildNonServiceConnectedConditionResults } from "@/lib/secondary-workflow/suggestions";
import { buildSymptomDiscussionPrompts } from "@/lib/secondary-workflow/symptom-bridge";
import { parseWorkflowState } from "@/lib/secondary-workflow/state";
import { readSecondaryWorkflowSession, workflowSessionToQueryParams, type StoredSecondaryWorkflowState } from "@/lib/secondary-workflow/session";
import { buildConditionVaReferenceMap } from "@/lib/va/condition-reference";
import { loadDisabilityReference } from "@/lib/va/disability-reference";

interface SuggestionsPageProps {
  workflowState?: StoredSecondaryWorkflowState;
  searchParams?: Promise<{ regSnapshot?: string | string[] }>;
}
export const dynamic = "force-dynamic";

const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default async function SuggestionsStepPage({ workflowState, searchParams }: SuggestionsPageProps = {}) {
  const catalog = loadConditionCatalog();
  const byId = indexById(catalog);
  const kb = loadKnowledgeBase();
  const session = workflowState ?? (await readSecondaryWorkflowSession());

  let state;
  try { state = parseWorkflowState(workflowSessionToQueryParams(session), catalog); }
  catch { return <main><header className="page-hero"><h1>Complete prior steps first</h1><p>We need the prior workflow selections before reviewing possible connections to your non-service-connected diagnoses.</p></header><Link href="/secondary/upload" className="ui-button">Back to optional document upload</Link></main>; }

  // Regulatory preflight is intentionally completed before recommendation output.
  // If this is a back-navigation inside the same review, reuse the locked snapshot
  // rather than silently changing the legal/regulatory basis mid-review.
  const lockedSnapshotId = firstParam((await searchParams)?.regSnapshot);
  const lockedSnapshot = loadLockedRegulatorySnapshot(lockedSnapshotId);
  const regulatoryReview = lockedSnapshot
    ? {
        snapshot: lockedSnapshot,
        relevantChanges: relevantChangesForSnapshot(lockedSnapshot),
      }
    : lockedSnapshotId
      ? {
          snapshot: missingLockedRegulatorySnapshot(lockedSnapshotId),
          relevantChanges: [],
        }
      : await prepareRegulatoryReview({
          reviewScope: {
            conditionIds: [...new Set([
              ...state.diagnosedConditionIds,
              ...state.serviceConnectedConditionIds,
            ])],
          },
        });

  const medications = state.medications ?? [];
  const treatments = state.treatments ?? [];
  const recommendationsResult = recommend(
    catalog,
    kb,
    buildSecondaryRecommendationIntake(state),
  );
  const nonServiceConnectedResults = buildNonServiceConnectedConditionResults(
    catalog,
    state.diagnosedConditionIds,
    state.serviceConnectedConditionIds,
    recommendationsResult.recommendations,
  );
  const nonServiceConnectedNames = nonServiceConnectedResults.map((result) => result.conditionName);
  const conditionNamesById = new Map([...byId].map(([id, condition]) => [id, condition.name] as const));
  const symptomDiscussionPrompts = buildSymptomDiscussionPrompts(
    state.symptomIds ?? [],
    conditionNamesById,
  );
  const primaryNames = state.serviceConnectedConditionIds.map((id) => byId.get(id)?.name).filter(Boolean);
  const vaReference = await loadDisabilityReference();
  const vaReferenceMap = buildConditionVaReferenceMap(
    catalog,
    vaReference.live ? vaReference.items : [],
  );
  const evidenceHref = `/secondary/evidence?regSnapshot=${encodeURIComponent(regulatoryReview.snapshot.snapshotId)}`;

  const timelineConditions: TimelineConditionInput[] = state.diagnosedConditionIds
    .map((id) => byId.get(id))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .map((condition) => {
      const entry = state.conditionTimeline?.[condition.id];
      return {
        id: condition.id,
        name: condition.name,
        bodySystem: condition.bodySystem,
        isServiceConnected: state.serviceConnectedConditionIds.includes(condition.id),
        onsetYear: entry?.onsetYear,
        diagnosisYear: entry?.diagnosisYear,
      };
    });
  const timelineConnections: TimelineConnectionInput[] = nonServiceConnectedResults.flatMap((result) => {
    if (!result.recommendation) return [];
    const chronologyIds = new Set(
      (result.recommendation.chronologyWarnings ?? []).map((warning) => warning.primaryId),
    );
    return result.recommendation.contributingPrimaries.map((primary) => ({
      primaryId: primary.id,
      primaryName: primary.name,
      secondaryId: result.conditionId,
      secondaryName: result.conditionName,
      nexusClassification: primary.nexusClaim?.nexusClassification,
      pathways: primary.pathwayIntelligence?.pathways,
      etiologicalConsensus: result.recommendation?.etiologicalConsensus,
      hasChronologyWarning: chronologyIds.has(primary.id),
    }));
  });
  const datedTimelineCount = timelineConditions.filter(
    (condition) => condition.onsetYear !== undefined || condition.diagnosisYear !== undefined,
  ).length;

  return (
    <main>
      <header className="page-hero text-center">
        <p className="ui-kicker">Step 5 of 6</p>
        <h1>Review Your Non-Service-Connected Diagnoses</h1>
        <p className="mx-auto mt-3 max-w-3xl text-lg">
          This step starts with each diagnosis you marked as not service connected. Under each one, it lists only your already service-connected conditions that have an authored published relationship worth evaluating as a possible cause, contributor, aggravating condition, treatment pathway, or other medical connection. It does not generate new diagnoses or list conditions you did not select.
        </p>
      </header>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Workflow progress"><span>✓ Diagnosed</span><span>✓ Service-connected</span><span>✓ Ratings</span><span>✓ Documents</span><strong className="text-blue-700">5 Connections</strong><span>6 Evidence</span><span className="ml-auto no-print"><PrintReportButton /></span></div>
      <RegulatoryPreflightStatus snapshot={regulatoryReview.snapshot} changes={regulatoryReview.relevantChanges} />

      <div className="ui-grid">
        <aside className="ui-card">
          <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Conditions Being Compared</h2></div>
          <h3 className="font-bold">Diagnosed, not service connected</h3>
          {nonServiceConnectedNames.length > 0 ? <div className="mt-2 flex flex-wrap gap-2">{nonServiceConnectedNames.map((name) => <span key={name} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-950">{name}</span>)}</div> : <p className="mt-2 text-sm text-slate-600">Every diagnosed condition in this review is already marked service connected.</p>}
          <div className="ui-divider" />
          <h3 className="font-bold">Already service connected</h3><div className="mt-2 flex flex-wrap gap-2">{primaryNames.map((name) => <span key={name} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-900">{name}</span>)}</div>
          {(medications.length > 0 || treatments.length > 0) && <><div className="ui-divider" /><h3 className="font-bold">Optional treatment context</h3>{medications.length > 0 && <div className="mt-2"><p className="text-xs uppercase tracking-wide text-slate-500">Medications</p><div className="mt-1 flex flex-wrap gap-2">{medications.map((item) => <span key={`med-${item}`} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs">{item}</span>)}</div></div>}{treatments.length > 0 && <div className="mt-3"><p className="text-xs uppercase tracking-wide text-slate-500">Treatments / procedures / devices</p><div className="mt-1 flex flex-wrap gap-2">{treatments.map((item) => <span key={`tx-${item}`} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs">{item}</span>)}</div></div>}</>}
          <div className="ui-callout mt-5 text-sm">Medication/treatment context is used only to flag literal overlap with authored pathway or evidence-gap text. It does not create a relationship, prove causation, or establish a medical nexus.</div>
          <Link href="/secondary/diagnosed" className="ui-button-secondary mt-5 w-full">Edit Diagnoses</Link>
        </aside>

        <section className="ui-card">
          <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">↔</span><div><h2 className="text-xl font-bold">Possible Connections to Review</h2><p className="text-sm text-slate-600">Organized by the diagnosed condition that is not yet service connected.</p></div></div>
          <div className="ui-callout mb-5 text-sm"><strong>Direction matters:</strong> The question on this page is whether an already service-connected condition may have caused, contributed to, aggravated, or otherwise medically related to a diagnosis you already have but that is not service connected. The page does not search for additional diagnoses that might develop in the future.</div>
          <SecondarySuggestionsTabs
            conditions={timelineConditions}
            connections={timelineConnections}
            datedCount={datedTimelineCount}
          >
            <div className="mb-5"><SymptomDiscussionReview prompts={symptomDiscussionPrompts} /></div>
            {nonServiceConnectedResults.length === 0 ? (
              <p className="rounded-xl border border-slate-200 p-5 text-sm">There are no diagnosed non-service-connected conditions to evaluate in this review.</p>
            ) : (
              <div className="space-y-5">
                {nonServiceConnectedResults.map((result) => (
                  <NonServiceConnectedConditionResult
                    key={result.conditionId}
                    result={result}
                    vaReference={{
                      live: vaReference.live,
                      sourceLabel: vaReference.sourceLabel,
                      environment: vaReference.environment,
                      match: vaReferenceMap.get(result.conditionId) ?? null,
                    }}
                  />
                ))}
              </div>
            )}
          </SecondarySuggestionsTabs>
        </section>

        <aside className="ui-stack">
          <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">i</span><h2 className="text-xl font-bold">How to Interpret Results</h2></div><ul className="space-y-4 text-sm"><li><strong>Starts with diagnoses you already reported.</strong><p>Step 5 does not suggest new medical conditions. Every top-level result is a diagnosis you selected in Step 1 and marked not service connected in Step 2.</p></li><li><strong>Only existing service-connected conditions appear underneath.</strong><p>A service-connected condition is listed only when the published knowledge base contains an authored relationship to that specific non-service-connected diagnosis.</p></li><li><strong>No match is not a negative medical opinion.</strong><p>If no published relationship is shown, the tool is reporting only that its current curated mappings do not support a match for the selected combination.</p></li><li><strong>Direction and pathway still require evidence.</strong><p>Cause, aggravation, treatment effects, intermediate steps, and other pathway theories must be evaluated against your individual chronology and medical evidence.</p></li><li><strong>Legal and clinical sources have different roles.</strong><p>Administrative or legal authority does not itself establish the medical relationship.</p></li><li><strong>Context match is not proof.</strong><p>A medication/treatment match means only that your reported term appears in authored mapping text.</p></li></ul></section>
          <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Next Review</h2></div><p className="text-sm">Step 6 is limited to the same diagnosed non-service-connected conditions and the relationship evidence shown here. It does not reintroduce unrelated possible secondary diagnoses.</p></section>
        </aside>
      </div>

      <div className="ui-actions"><Link href="/secondary/upload" className="ui-button-secondary">← Back to Documents</Link><Link href={evidenceHref} className="ui-button">Review Evidence for These Connections <span aria-hidden="true">→</span><span className="hidden" aria-hidden="true">Open Evidence Checklist</span></Link></div>
      <DisclaimerFooter />
    </main>
  );
}
