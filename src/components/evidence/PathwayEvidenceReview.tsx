"use client";

import { useMemo, useSyncExternalStore } from "react";

import { PathwayEvidenceTable } from "@/components/evidence/PathwayEvidenceTable";
import type { ClaimPathwayView } from "@/lib/engine/pathway-view";
import {
  annotateExcerptsWithHopIndex,
  formatPathwayHopEvidenceMapping,
  type HopAnnotatedExcerpt,
} from "@/lib/evidence/pathway-mapper";
import {
  evidenceAnalysisStorageKey,
  type EvidenceAnalysis,
  type EvidenceExcerpt,
} from "@/lib/evidence/extract";
import { parseStoredEvidence } from "@/lib/evidence/storage";

/**
 * PathwayEvidenceReview — Step 6 producer side of the per-hop evidence view.
 *
 * Reads the browser-local Step 4 analyses (sessionStorage), annotates each
 * stored excerpt with the `stepIndex` of the pathway hop it supports via
 * `annotateExcerptsWithHopIndex`, and feeds the result to
 * `PathwayEvidenceTable` — which renders one semantic table group per hop.
 *
 * ## Data flow (Step 4 → here)
 *
 *   1. Step 4 analysis wrote `EvidenceAnalysis[]` into sessionStorage.
 *   2. The Step 6 server page adapted the engine's intermediate chains into
 *      `ClaimPathwayView` props and passed the catalog name lookup down.
 *   3. This component performs the excerpt→hop join client-side (never the
 *      reverse): excerpts are annotated against every pathway, then filtered
 *      per pathway. Excerpts matching no hop are surfaced as an explicit
 *      note rather than silently dropped.
 *
 * Everything here renders local browser state. No excerpt text, no analysis
 * payload, and no mapping result ever leaves this browser tab.
 */

const EMPTY_SNAPSHOT = "[]";

function getSnapshot(): string {
  try {
    return window.sessionStorage.getItem(evidenceAnalysisStorageKey) ?? EMPTY_SNAPSHOT;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

function subscribe(): () => void {
  // Evidence excerpts are written on Step 4 before this component mounts on
  // Step 6. No live subscription is required while the review page is open.
  return () => undefined;
}

/** Distinct, stable key for an excerpt that matched no hop of any pathway. */
function unmatchedKey(excerpt: EvidenceExcerpt, index: number): string {
  return `${excerpt.sourceName}-${excerpt.locator}-${excerpt.category}-${index}`;
}

interface PathwayEvidenceReviewProps {
  /** Adapted pathways to review (engine intermediate chains → view-model). */
  pathways: readonly ClaimPathwayView[];
  /** Catalog condition ID → display name; widens term matching and labels hops. */
  conditionNameById: Readonly<Record<string, string>>;
}

/**
 * Storage-reading shell: pulls the Step 4 browser-local analyses out of
 * sessionStorage and hands them to the pure {@link PathwayEvidenceReviewView}
 * core. Kept separate so the review rendering can be exercised (and pinned by
 * tests) without a storage environment — the core is a pure function of props.
 */
export function PathwayEvidenceReview({ pathways, conditionNameById }: PathwayEvidenceReviewProps) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_SNAPSHOT);
  // Audit HARD-01: the retained payload is read through the store's own guard,
  // not parsed here, so the hop view and the analyzer agree on what the store
  // holds and a hostile payload is bounded before this subtree renders it.
  const analyses = useMemo(() => parseStoredEvidence(snapshot), [snapshot]);
  return (
    <PathwayEvidenceReviewView
      pathways={pathways}
      conditionNameById={conditionNameById}
      analyses={analyses}
    />
  );
}

/** Props of the pure review core — the shell's render output, made injectable. */
export interface PathwayEvidenceReviewViewProps {
  /** Adapted pathways to review (engine intermediate chains → view-model). */
  pathways: readonly ClaimPathwayView[];
  /** Catalog condition ID → display name; widens term matching and labels hops. */
  conditionNameById: Readonly<Record<string, string>>;
  /** Parsed Step 4 browser-local analyses (sessionStorage payload). */
  analyses: readonly EvidenceAnalysis[];
}

/**
 * Pure, state-free core of the per-hop evidence review: a function of its
 * props that renders the per-pathway tables, the unmatched-excerpt note, and
 * the download affordance. Performs no storage access of its own.
 */
export function PathwayEvidenceReviewView({
  pathways,
  conditionNameById,
  analyses,
}: PathwayEvidenceReviewViewProps) {
  const hasAnalyses = analyses.length > 0;

  /**
   * Annotate once per pathway in a single memo: each entry annotates the
   * stored excerpts against that pathway's hops, then filters out excerpts
   * whose `supportedHopIndex` does not belong to it (the annotation function
   * assigns by first matching hop across the whole set it was given, so
   * per-pathway filtering is required for correctness on multi-pathway pages).
   */
  const perPathwayExcerpts = useMemo(() => {
    const stepIndexSet = (pathway: ClaimPathwayView): ReadonlySet<number> =>
      new Set(pathway.hops.map((hop) => hop.stepIndex));

    return pathways.map((pathway) => {
      const { annotated, unmatched } = annotateExcerptsWithHopIndex(
        pathway.hops,
        analyses,
        conditionNameById,
      );
      const stepIndexes = stepIndexSet(pathway);
      const inPathway = annotated.filter(
        (excerpt: HopAnnotatedExcerpt) => stepIndexes.has(excerpt.supportedHopIndex),
      );
      return { pathway, excerpts: inPathway, unmatched };
    });
  }, [analyses, pathways, conditionNameById]);

  const hasPathways = perPathwayExcerpts.length > 0;
  /**
   * Unmatched note: only excerpts that matched no hop of ANY pathway. The
   * per-pathway annotation returns the original stored excerpt references in
   * its `unmatched` list, so "unmatched everywhere" is an identity check of
   * each stored excerpt against every pathway's unmatched list — an excerpt
   * that supports one chain but not another stays in its table and out of
   * this note. Order follows the stored analyses.
   */
  const unmatchedElsewhere = useMemo(
    () =>
      analyses
        .flatMap((analysis) => analysis.excerpts)
        .filter((excerpt) =>
          perPathwayExcerpts.every((entry) => entry.unmatched.includes(excerpt)),
        ),
    [analyses, perPathwayExcerpts],
  );

  /**
   * Per-hop text export: renders the same pathways, hop groupings, excerpt
   * quotes, empty states, and composite-nexus summaries the tables above show
   * into a plain-text file. Only what is already in browser-local state is
   * written, and nothing leaves the tab until the veteran clicks download.
   */
  function downloadHopMapping() {
    const content = formatPathwayHopEvidenceMapping(
      perPathwayExcerpts.map(({ pathway, excerpts }) => ({ pathway, excerpts })),
      conditionNameById,
    );
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "pathway-hop-evidence-mapping.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  if (!hasAnalyses) {
    return (
      <p className="mt-4 text-sm text-slate-600">
        No local evidence analysis is available in this browser tab. Return to Step 4 to run
        browser-local document analysis, then your excerpts are grouped under each hop of the
        research pathways here.
      </p>
    );
  }

  if (!hasPathways) {
    return (
      <p className="mt-4 text-sm text-slate-600">
        No multi-hop research pathways are available for this review, so there is nothing to map
        the local excerpts against hop by hop.
      </p>
    );
  }

  return (
    <div>
      {perPathwayExcerpts.map(({ pathway, excerpts }) => (
        <PathwayEvidenceTable
          key={`${pathway.originConditionId}-${pathway.terminalConditionId}`}
          pathway={pathway}
          excerpts={excerpts}
          conditionNameById={conditionNameById}
        />
      ))}
      {unmatchedElsewhere.length > 0 ? (
        <p className="mt-3 text-xs text-slate-600">
          {unmatchedElsewhere.length} stored excerpt{unmatchedElsewhere.length === 1 ? "" : "s"}{" "}
          in this tab matched no pathway hop and are omitted from the tables above:{" "}
          <span className="block">
            {unmatchedElsewhere
              .map((excerpt) => `“${excerpt.quote.slice(0, 80)}” (${excerpt.sourceName}, ${excerpt.locator})`)
              .join(" · ")}
          </span>
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="ui-button" onClick={downloadHopMapping}>
          Download per-hop mapping
        </button>
        <span className="text-xs text-slate-600">
          Exports the tables above — pathways, hops, composite nexus, exact excerpt quotes, and empty
          steps — as a text file in this browser.
        </span>
      </div>
    </div>
  );
}

export { unmatchedKey };
