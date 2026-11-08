"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";

import { SymptomDiscussionReview } from "@/components/SymptomDiscussionReview";
import { DisclaimerFooter } from "@/components/Disclaimer";
import { NonServiceConnectedConditionResult } from "@/components/NonServiceConnectedConditionResult";
import { RegulatoryPreflightStatus } from "@/components/RegulatoryPreflightStatus";
import { ActionPlan } from "@/components/secondary/ActionPlan";
import { CombinationInsightsPanel } from "@/components/secondary/CombinationInsightsPanel";
import { ConditionComparisonTool } from "@/components/secondary/ConditionComparisonTool";
import { GraphPathwayReview } from "@/components/secondary/GraphPathwayReview";
import { PathwayRecordChecklist } from "@/components/secondary/PathwayRecordChecklist";
import { PrintReportButton } from "@/components/secondary/PrintReportButton";
import { RatingGuide } from "@/components/secondary/RatingGuide";
import { SecondarySuggestionsTabs } from "@/components/secondary/SecondarySuggestionsTabs";
import type {
  TimelineConditionInput,
  TimelineConnectionInput,
} from "@/components/secondary/ConditionTimelineVisualization";
import { AccreditedRepresentativeFinder } from "@/components/va/AccreditedRepresentativeFinder";
import type { VaApiEnvironment } from "@/lib/va/sandbox";
import { AriaLiveRegion, describeMappedConnections, useAriaLive } from "@/lib/a11y/use-aria-live";
import { indexById } from "@/lib/catalog/lookup";
import { recommend } from "@/lib/engine/recommend";
import { buildGraphPathwayMatchSectionViewFromData } from "@/lib/engine/graph-pathway-matches-core";
import { clientCorpusGraphAnchorIndex } from "@/lib/client-corpus";
import { useClientCorpus } from "@/lib/client-corpus";
import { relevantChangesForConditionIds } from "@/lib/regulatory/preflight/client-relevance";
import type { RegulatoryPreflightSnapshot } from "@/lib/regulatory/preflight/types";
import { buildSecondaryRecommendationIntake } from "@/lib/secondary-workflow/recommendation-intake";
import { buildNonServiceConnectedConditionResults } from "@/lib/secondary-workflow/suggestions";
import { buildSymptomDiscussionPrompts } from "@/lib/secondary-workflow/symptom-bridge";
import { parseWorkflowState } from "@/lib/secondary-workflow/state";
import { workflowSessionToQueryParams } from "@/lib/secondary-workflow/transport";
import { useBrowserWorkflowContext } from "@/lib/secondary-workflow/use-browser-context";
import { buildConditionVaReferenceMap } from "@/lib/va/condition-reference";

export interface SuggestionsVaReferenceView {
  live: boolean;
  sourceLabel: string;
  environment: VaApiEnvironment | null;
  items: Array<{ id: string; name: string }>;
  /** VA's reported current total; greater than items.length for a bounded prefix. */
  totalAvailable: number;
}

export interface SuggestionsStepProps {
  snapshot: RegulatoryPreflightSnapshot;
  vaReference: SuggestionsVaReferenceView;
}

/**
 * Step 5 — possible connections (PRIV-01 stage 2). The recommendation engine
 * runs in this browser over the public client corpus; the veteran's intake
 * (diagnoses, service-connected selections, medications, treatments, history,
 * timeline) never leaves the tab. The regulatory snapshot and VA reference
 * arrive as uniform public props computed by the server shell.
 */
export function SuggestionsStep({ snapshot, vaReference }: SuggestionsStepProps) {
  const { corpus, loading, error: corpusError } = useClientCorpus();
  const { context, ready } = useBrowserWorkflowContext();

  const model = useMemo(() => {
    if (!corpus || !ready) return null;
    let state;
    try {
      state = parseWorkflowState(workflowSessionToQueryParams(context ?? {}), corpus.conditions);
    } catch {
      return { kind: "guard" as const };
    }

    const byId = indexById(corpus.conditions);
    // Regulatory preflight is completed before recommendation output; the
    // locked snapshot arrives from the shell so back-navigation keeps the same
    // legal/regulatory basis mid-review. Relevance filtering is applied here,
    // in the browser, against the browser-local selections.
    const relevantChanges = relevantChangesForConditionIds(snapshot, [
      ...new Set([...state.diagnosedConditionIds, ...state.serviceConnectedConditionIds]),
    ]);
    const medications = state.medications ?? [];
    const treatments = state.treatments ?? [];
    const recommendationsResult = recommend(
      corpus.conditions,
      corpus.publishedMappings,
      buildSecondaryRecommendationIntake(state),
    );
    const nonServiceConnectedResults = buildNonServiceConnectedConditionResults(
      corpus.conditions,
      state.diagnosedConditionIds,
      state.serviceConnectedConditionIds,
      recommendationsResult.recommendations,
    );
    // Authored adjacency-graph routes connecting the selections in this review.
    // These come from the graph layer, are separate from the published-mapping
    // recommendations, and render with association-only chain-break semantics.
    const graphPathwayMatches = buildGraphPathwayMatchSectionViewFromData(
      corpus.conditions,
      corpus.publishedMappings,
      new Map(corpus.graph.map((node) => [node.nodeId, node] as const)),
      state.serviceConnectedConditionIds,
      nonServiceConnectedResults.map((result) => result.conditionId),
      clientCorpusGraphAnchorIndex(corpus),
    );
    const nonServiceConnectedNames = nonServiceConnectedResults.map((result) => result.conditionName);
    const checklistSummaryRecommendations = nonServiceConnectedResults.flatMap((result) =>
      result.recommendation ? [{ ...result.recommendation, matchedIntakeContext: [] }] : [],
    );
    const conditionNamesById = new Map([...byId].map(([id, condition]) => [id, condition.name] as const));
    const symptomDiscussionPrompts = buildSymptomDiscussionPrompts(
      state.symptomIds ?? [],
      conditionNamesById,
    );
    const primaryNames = state.serviceConnectedConditionIds
      .map((id) => byId.get(id)?.name)
      .filter((name): name is string => Boolean(name));
    const vaReferenceMap = buildConditionVaReferenceMap(
      corpus.conditions,
      vaReference.live ? vaReference.items : [],
    );

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

    return {
      kind: "ready" as const,
      state,
      catalog: corpus.conditions,
      byId,
      relevantChanges,
      medications,
      treatments,
      nonServiceConnectedResults,
      nonServiceConnectedNames,
      checklistSummaryRecommendations,
      symptomDiscussionPrompts,
      primaryNames,
      vaReferenceMap,
      timelineConditions,
      timelineConnections,
      datedTimelineCount,
      graphPathwayMatches,
    };
  }, [corpus, context, ready, snapshot, vaReference]);

  // Announce the adjacency-graph routes as the engine maps them. A multi-hop
  // connection appearing in the results section is a state change a
  // screen-reader user would otherwise never hear: the section renders far below
  // the fold and nothing moves focus.
  //
  // These hooks are deliberately hoisted ABOVE the early returns that follow.
  // React requires hooks to run in the same order on every render, so a hook
  // placed after them would run on the ready path only and the component would
  // throw "Rendered more hooks than during the previous render" the moment
  // `ready` flipped.
  const { announce, message: livePathwayMessage } = useAriaLive();
  const readyGraphPathwayMatches =
    model && model.kind === "ready" ? model.graphPathwayMatches : null;
  const mappedConnections = useMemo(
    () =>
      (readyGraphPathwayMatches?.matches ?? []).map(
        (match) => `${match.originConditionName} → ${match.terminalConditionName}`,
      ),
    [readyGraphPathwayMatches],
  );
  useEffect(() => {
    // `describeMappedConnections` returns null when there is nothing to say, so
    // an empty mapping never mutates the region and never triggers an
    // announcement.
    const announcement = describeMappedConnections(mappedConnections);
    if (announcement) announce(announcement);
  }, [announce, mappedConnections]);

  if (!ready || loading) {
    return (
      <main>
        <header className="page-hero text-center"><p className="ui-kicker">Step 5 of 6</p><h1>Review Your Non-Service-Connected Diagnoses</h1></header>
        <div className="ui-callout text-sm" aria-live="polite">Loading the public knowledge base and your browser-local session…</div>
      </main>
    );
  }

  if (corpusError) {
    return (
      <main>
        <header className="page-hero text-center"><p className="ui-kicker">Step 5 of 6</p><h1>Review Your Non-Service-Connected Diagnoses</h1></header>
        <div role="alert" className="ui-callout text-sm"><strong>Knowledge base unavailable:</strong> the public corpus could not be loaded ({corpusError}). Nothing has left this browser; reload the page to try again.</div>
      </main>
    );
  }

  if (!model || model.kind === "guard") {
    return <main><header className="page-hero"><h1>Complete prior steps first</h1><p>We need the prior workflow selections before reviewing possible connections to your non-service-connected diagnoses.</p></header><Link href="/secondary/upload" className="ui-button">Back to optional document upload</Link></main>;
  }

  const {
    catalog,
    relevantChanges,
    medications,
    treatments,
    nonServiceConnectedResults,
    nonServiceConnectedNames,
    checklistSummaryRecommendations,
    symptomDiscussionPrompts,
    primaryNames,
    vaReferenceMap,
    timelineConditions,
    timelineConnections,
    datedTimelineCount,
    graphPathwayMatches,
  } = model;
  const evidenceHref = `/secondary/evidence?regSnapshot=${encodeURIComponent(snapshot.snapshotId)}`;

  return (
    <main>
      {/* Visually hidden, and rendered unconditionally on this path: the same
          routes appear in the results section below, so the announcement must
          not duplicate them on screen — and a live region inserted at the same
          moment as its text is not reliably announced. */}
      <AriaLiveRegion message={livePathwayMessage} className="sr-only" />
      <header className="page-hero text-center">
        <p className="ui-kicker">Step 5 of 6</p>
        <h1>Review Your Non-Service-Connected Diagnoses</h1>
        <p className="mx-auto mt-3 max-w-3xl text-lg">
          This step starts with each diagnosis you marked as not service connected. Under each one, it lists only your already service-connected conditions that have an authored published relationship worth evaluating as a possible cause, contributor, aggravating condition, treatment pathway, or other medical connection. It does not generate new diagnoses or list conditions you did not select.
        </p>
      </header>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm" role="group" aria-label="Workflow progress"><span>✓ Diagnosed</span><span>✓ Service-connected</span><span>✓ Ratings</span><span>✓ Documents</span><strong className="text-blue-700">5 Connections</strong><span>6 Evidence</span><span className="ml-auto no-print"><PrintReportButton /></span></div>
      <RegulatoryPreflightStatus snapshot={snapshot} changes={relevantChanges} />

      <div className="ui-grid">
        <aside className="ui-card" aria-label="Conditions being compared">
          <div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Conditions Being Compared</h2></div>
          <h3 className="font-bold">Diagnosed, not service connected</h3>
          {nonServiceConnectedNames.length > 0 ? <div className="mt-2 flex flex-wrap gap-2">{nonServiceConnectedNames.map((name) => <span key={name} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-950">{name}</span>)}</div> : <p className="mt-2 text-sm text-slate-600">Every diagnosed condition in this review is already marked service connected.</p>}
          <div className="ui-divider" />
          <h3 className="font-bold">Already service connected</h3><div className="mt-2 flex flex-wrap gap-2">{primaryNames.map((name) => <span key={name} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-900">{name}</span>)}</div>
          {(medications.length > 0 || treatments.length > 0) && <><div className="ui-divider" /><h3 className="font-bold">Optional treatment context</h3>{medications.length > 0 && <div className="mt-2"><p className="text-xs text-muted">Medications</p><div className="mt-1 flex flex-wrap gap-2">{medications.map((item) => <span key={`med-${item}`} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs">{item}</span>)}</div></div>}{treatments.length > 0 && <div className="mt-3"><p className="text-xs text-muted">Treatments / procedures / devices</p><div className="mt-1 flex flex-wrap gap-2">{treatments.map((item) => <span key={`tx-${item}`} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs">{item}</span>)}</div></div>}</>}
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
                      loadedCount: vaReference.items.length,
                      totalAvailable: vaReference.totalAvailable,
                      match: vaReferenceMap.get(result.conditionId) ?? null,
                    }}
                  />
                ))}
              </div>
            )}
            <GraphPathwayReview view={graphPathwayMatches} />
          </SecondarySuggestionsTabs>
        </section>

        <aside className="ui-stack" aria-label="How to interpret results">
          <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">i</span><h2 className="text-xl font-bold">How to Interpret Results</h2></div><ul className="space-y-4 text-sm"><li><strong>Starts with diagnoses you already reported.</strong><p>Step 5 does not suggest new medical conditions. Every top-level result is a diagnosis you selected in Step 1 and marked not service connected in Step 2.</p></li><li><strong>Only existing service-connected conditions appear underneath.</strong><p>A service-connected condition is listed only when the published knowledge base contains an authored relationship to that specific non-service-connected diagnosis.</p></li><li><strong>No match is not a negative medical opinion.</strong><p>If no published relationship is shown, the tool is reporting only that its current curated mappings do not support a match for the selected combination.</p></li><li><strong>Direction and pathway still require evidence.</strong><p>Cause, aggravation, treatment effects, intermediate steps, and other pathway theories must be evaluated against your individual chronology and medical evidence.</p></li><li><strong>Legal and clinical sources have different roles.</strong><p>Administrative or legal authority does not itself establish the medical relationship.</p></li><li><strong>Context match is not proof.</strong><p>A medication/treatment match means only that your reported term appears in authored mapping text.</p></li></ul></section>
          <section className="ui-card"><div className="ui-heading-row"><span className="ui-icon" aria-hidden="true">✓</span><h2 className="text-xl font-bold">Next Review</h2></div><p className="text-sm">Step 6 is limited to the same diagnosed non-service-connected conditions and the relationship evidence shown here. It does not reintroduce unrelated possible secondary diagnoses.</p></section>
        </aside>
      </div>

      <ConditionComparisonTool results={nonServiceConnectedResults} catalog={catalog} />
      <CombinationInsightsPanel results={nonServiceConnectedResults} />
      <RatingGuide results={nonServiceConnectedResults} catalog={catalog} />
      <ActionPlan results={nonServiceConnectedResults} />
      <PathwayRecordChecklist results={nonServiceConnectedResults} summaryRecommendations={checklistSummaryRecommendations} />
      <AccreditedRepresentativeFinder returnTo="/secondary/suggestions" />

      <div className="ui-actions"><Link href="/secondary/upload" className="ui-button-secondary">← Back to Documents</Link><Link href={evidenceHref} className="ui-button">Review Evidence for These Connections <span aria-hidden="true">→</span><span className="hidden" aria-hidden="true">Open Evidence Checklist</span></Link></div>
      <DisclaimerFooter />
    </main>
  );
}
