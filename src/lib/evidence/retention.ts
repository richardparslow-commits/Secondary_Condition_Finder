/**
 * Retention identity for analyzed evidence sources.
 *
 * Two documents can legitimately share a file name — `letter.txt` exported from
 * two folders, or the same name from two providers. Keying retention by
 * `sourceName` made the second analysis replace the first, and made Remove
 * delete both, which is silent evidence loss in a claim-preparation tool
 * (Heal run 2026-11-03, defect 1).
 *
 * A staged source id identifies the document; the name is only a label. Records
 * written before the id existed carry no `sourceId`, so they keep name-based
 * identity: one legacy record per name, exactly as they were written, rather
 * than being duplicated or refused on read.
 */
import type { EvidenceAnalysis } from "./extract";

/** Stable identity for one analyzed source, independent of its display name. */
export function evidenceAnalysisIdentity(
  analysis: Pick<EvidenceAnalysis, "sourceId" | "sourceName">,
): string {
  const sourceId = analysis.sourceId?.trim();
  return sourceId ? `id:${sourceId}` : `name:${analysis.sourceName}`;
}

export interface EvidenceAnalysisMerge {
  analyses: EvidenceAnalysis[];
  /**
   * Documents evicted by the retention window. Replacing the incoming
   * document's earlier record is not a drop: its excerpts are still there,
   * re-read. The serializer cannot see these evictions because the window is
   * applied before it measures anything, so the count has to come from here.
   */
  dropped: number;
}

/**
 * Append `incoming`, replacing the record with the same identity (re-analysis
 * of the same document) and keeping every other document, including one that
 * happens to share its name. Newest-first eviction past `maxSources` matches
 * the serialized store's `slice(-storedSources)` window.
 */
export function mergeEvidenceAnalysisWithInfo(
  existing: readonly EvidenceAnalysis[],
  incoming: EvidenceAnalysis,
  maxSources: number,
): EvidenceAnalysisMerge {
  const identity = evidenceAnalysisIdentity(incoming);
  const kept = existing.filter(
    (analysis) => evidenceAnalysisIdentity(analysis) !== identity,
  );
  const combined = [...kept, incoming];
  const window = Math.max(0, maxSources);
  const analyses = combined.slice(Math.max(0, combined.length - window));
  return { analyses, dropped: combined.length - analyses.length };
}

/** Retention-only variant for callers that do not surface the drop count. */
export function mergeEvidenceAnalysis(
  existing: readonly EvidenceAnalysis[],
  incoming: EvidenceAnalysis,
  maxSources: number,
): EvidenceAnalysis[] {
  return mergeEvidenceAnalysisWithInfo(existing, incoming, maxSources).analyses;
}

/**
 * Remove one analyzed document by its id. Name-based removal is deliberately
 * not offered: it is what removed every same-named document at once.
 */
export function removeEvidenceAnalysis(
  existing: readonly EvidenceAnalysis[],
  sourceId: string,
): EvidenceAnalysis[] {
  return existing.filter((analysis) => analysis.sourceId !== sourceId);
}
