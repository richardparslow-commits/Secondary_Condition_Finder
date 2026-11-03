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

/**
 * Append `incoming`, replacing the record with the same identity (re-analysis
 * of the same document) and keeping every other document, including one that
 * happens to share its name. Newest-first eviction past `maxSources` matches
 * the serialized store's `slice(-storedSources)` window.
 */
export function mergeEvidenceAnalysis(
  existing: readonly EvidenceAnalysis[],
  incoming: EvidenceAnalysis,
  maxSources: number,
): EvidenceAnalysis[] {
  const identity = evidenceAnalysisIdentity(incoming);
  const kept = existing.filter(
    (analysis) => evidenceAnalysisIdentity(analysis) !== identity,
  );
  return [...kept, incoming].slice(-maxSources);
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
