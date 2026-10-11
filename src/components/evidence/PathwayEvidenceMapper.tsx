"use client";

import { useMemo, useSyncExternalStore } from "react";

import { ConsultationSummaryDownload } from "@/components/ConsultationSummaryDownload";
import { formatClaimSummary } from "@/lib/engine/export";
import {
  evidenceAnalysisStorageKey,
  type EvidenceAnalysis,
} from "@/lib/evidence/extract";
import {
  combineMappingWithClaimSummary,
  formatPathwayEvidenceMapping,
  mapEvidenceToPathways,
  pathwayEvidenceStatusSummary,
  type PathwayEvidenceRow,
  type PathwayEvidenceStatus,
} from "@/lib/evidence/pathway-mapper";
import type { Recommendation } from "@/lib/engine/types";
import type { NonServiceConnectedConditionResult } from "@/lib/secondary-workflow/suggestions";

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

function parseAnalyses(raw: string): EvidenceAnalysis[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is EvidenceAnalysis =>
        Boolean(item && typeof item === "object" && (item as EvidenceAnalysis).version === 1),
    );
  } catch {
    return [];
  }
}

const STATUS_CHIP: Record<PathwayEvidenceStatus, { className: string; label: string }> = {
  "direct-support": {
    className: "inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900",
    label: "Theory-matched nexus excerpts found",
  },
  "supporting-only": {
    className: "inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900",
    label: "Supporting excerpts only",
  },
  "related-excerpts": {
    className: "inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-900",
    label: "Related causal language only",
  },
  "no-excerpts": {
    className: "inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600",
    label: "No local excerpts",
  },
};

function ExcerptList({ row }: { row: PathwayEvidenceRow }) {
  const mapped = [...row.direct, ...row.supporting, ...row.related];
  if (mapped.length === 0) {
    return (
      <p className="px-3 py-3 text-sm text-slate-600">
        No excerpt in this tab names this primary condition.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {mapped.map((excerpt, index) => (
        <li key={`${excerpt.sourceName}-${excerpt.locator}-${index}`} className="px-3 py-3">
          <blockquote className="border-l-4 border-slate-300 pl-3 text-sm leading-relaxed text-slate-900">
            &ldquo;{excerpt.quote}&rdquo;
          </blockquote>
          <p className="mt-1 text-xs text-slate-600">
            {excerpt.sourceName} &middot; {excerpt.locator} &middot; {excerpt.category}
            {excerpt.strength === "nexus-relevant" ? " &middot; nexus-relevant" : ""}
            {excerpt.clinicianAuthored ? " &middot; clinician-authored" : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

interface Props {
  results: NonServiceConnectedConditionResult[];
  /** Privacy-stripped recommendations (`matchedIntakeContext: []`) for the combined export. */
  recommendations: Recommendation[];
}

export function PathwayEvidenceMapper({ results, recommendations }: Props) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_SNAPSHOT);
  const analyses = useMemo(() => parseAnalyses(snapshot), [snapshot]);
  const hasAnalyses = analyses.length > 0;
  const mappedRows = useMemo(() => mapEvidenceToPathways(results, analyses), [results, analyses]);

  const rowsByCondition = useMemo(() => {
    const grouped = new Map<string, { conditionName: string; rows: PathwayEvidenceRow[] }>();
    for (const row of mappedRows) {
      let group = grouped.get(row.conditionId);
      if (!group) {
        group = { conditionName: row.conditionName, rows: [] };
        grouped.set(row.conditionId, group);
      }
      group.rows.push(row);
    }
    return [...grouped.values()];
  }, [mappedRows]);

  const hasRows = rowsByCondition.length > 0;

  function downloadMapping() {
    const content = formatPathwayEvidenceMapping(mappedRows);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "pathway-evidence-mapping.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  function downloadCombinedExport() {
    const mapping = formatPathwayEvidenceMapping(mappedRows);
    // The summary portion uses the exact same privacy-stripped formatter and
    // inputs as the standalone ConsultationSummaryDownload above.
    const combined = combineMappingWithClaimSummary(mapping, formatClaimSummary(recommendations, []));
    const blob = new Blob([combined], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "pathway-mapping-and-claim-summary.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <section className="mt-5 ui-card" aria-labelledby="pathway-evidence-mapper-heading">
      <div className="ui-heading-row">
        <span className="ui-icon" aria-hidden="true">⇄</span>
        <div>
          <h2 id="pathway-evidence-mapper-heading" className="text-xl font-bold">Pathway Evidence Mapping</h2>
          <p className="text-sm text-slate-600">
            Side-by-side view: your browser-local Step 4 excerpts grouped under each authored research pathway reviewed in Step 5.
          </p>
        </div>
      </div>

      <div className="ui-callout text-sm">
        <strong>Research cues, not determinations:</strong> Excerpts are quoted exactly from your own local document analysis and grouped by the pathway theory they speak to. Matching text does not establish causation, aggravation, competency, probative weight, or VA&apos;s at-least-as-likely-as-not standard. No text leaves this browser tab.
      </div>

      {!hasAnalyses ? (
        <p className="mt-4 text-sm text-slate-600">
          No local evidence analysis is available in this browser tab. Return to Step 4 to run browser-local document analysis, then the excerpts are grouped under each pathway here.
        </p>
      ) : !hasRows ? (
        <p className="mt-4 text-sm text-slate-600">
          No authored research pathways are available for this review, so there is nothing to map the local excerpts against.
        </p>
      ) : (
        <div className="mt-5 space-y-6">
          {rowsByCondition.map((group) => (
            <section key={group.rows[0]?.conditionId ?? group.conditionName} aria-label={`Pathway evidence mapping for ${group.conditionName}`}>
              <h3 className="text-lg font-bold">{group.conditionName}</h3>
              {group.rows.map((row) => {
                const chip = STATUS_CHIP[row.status];
                return (
                  <article key={`${row.primaryId}-${row.conditionId}`} className="mt-3 rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h4 className="text-base font-semibold text-slate-900">
                          Pathway: {row.primaryName} → {row.conditionName}
                        </h4>
                        <p className="mt-1 text-xs text-slate-600">
                          Claim theory: {row.theoryLabel}
                          {row.mechanismLabel ? ` · Mechanism: ${row.mechanismLabel}` : ""}
                          {row.consensusLabel ? ` · Consensus: ${row.consensusLabel}` : ""}
                        </p>
                      </div>
                      <span className={chip.className}>{chip.label}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{pathwayEvidenceStatusSummary(row.status)}</p>
                    <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                      <table className="w-full text-left text-sm">
                        <caption className="sr-only">Supporting excerpts mapped to the {row.primaryName} pathway</caption>
                        <thead className="bg-slate-50 text-xs text-slate-600">
                          <tr>
                            <th scope="col" className="px-3 py-2">Supporting evidence (exact excerpt)</th>
                            <th scope="col" className="px-3 py-2">Classification</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td colSpan={2} className="p-0">
                              <ExcerptList row={row} />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      Authored evidence questions for this diagnosis: {row.gapCount} — see the checklist above for the specific records to pursue.
                    </p>
                  </article>
                );
              })}
            </section>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="ui-button" onClick={downloadMapping}>
              Download pathway mapping
            </button>
            <span className="text-xs text-slate-600">Exports the mapping (pathways plus exact excerpts) as a text file in this browser. Print the page to include it with the report header.</span>
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-slate-200 pt-4">
        <p className="text-sm font-semibold text-slate-900">Combined export</p>
        <p className="mt-1 text-sm text-slate-600">
          Downloads the pathway mapping together with the consultation summary in one text file. The summary portion is the same privacy-stripped export as the standalone download below — authored research content only; it does not include raw local-evidence excerpts or optional context. When no local excerpts exist in this tab, the file contains the summary only.
        </p>
        <button type="button" className="ui-button mt-3" onClick={downloadCombinedExport}>
          Download mapping + consultation summary
        </button>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-4">
        <p className="text-sm font-semibold text-slate-900">Consultation summary (standalone)</p>
        <p className="mt-1 text-sm text-slate-600">The authored research checklist on its own, without the pathway mapping.</p>
        <ConsultationSummaryDownload recommendations={recommendations} />
      </div>
    </section>
  );
}
