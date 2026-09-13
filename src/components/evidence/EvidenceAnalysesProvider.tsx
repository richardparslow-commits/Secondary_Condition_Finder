"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  evidenceAnalysisStorageKey,
  type EvidenceAnalysis,
} from "@/lib/evidence/extract";

export const EMPTY_EVIDENCE_ANALYSES_SNAPSHOT = "[]";

/** Raw sessionStorage snapshot of the Step 4 evidence analyses for this tab. */
export function getEvidenceAnalysesSnapshot(): string {
  try {
    return (
      window.sessionStorage.getItem(evidenceAnalysisStorageKey) ??
      EMPTY_EVIDENCE_ANALYSES_SNAPSHOT
    );
  } catch {
    return EMPTY_EVIDENCE_ANALYSES_SNAPSHOT;
  }
}

/**
 * Evidence excerpts are written on Step 4 before Step 6 mounts, and the store
 * does not change while the review page is open, so no live subscription is
 * required.
 */
export function subscribeToEvidenceAnalyses(): () => void {
  return () => undefined;
}

/** Fail-closed parse of the retained `EvidenceAnalysis[]` payload. */
export function parseStoredEvidenceAnalyses(raw: string): EvidenceAnalysis[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is EvidenceAnalysis =>
        Boolean(
          item &&
            typeof item === "object" &&
            (item as EvidenceAnalysis).version === 1,
        ),
    );
  } catch {
    return [];
  }
}

const EvidenceAnalysesContext = createContext<EvidenceAnalysis[] | null>(null);

/**
 * Parses the browser-local evidence payload once for an entire Step 6 subtree.
 *
 * Step 6 renders one coverage chip per authored evidence gap. Without a shared
 * provider every chip re-parsed the same sessionStorage string, so the parse
 * cost scaled with the number of displayed gaps and with the retained payload
 * size (Extended mode keeps much larger payloads). The provider performs the
 * single parse and the chips receive the structured analyses via context.
 */
export function EvidenceAnalysesProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribeToEvidenceAnalyses,
    getEvidenceAnalysesSnapshot,
    () => EMPTY_EVIDENCE_ANALYSES_SNAPSHOT,
  );
  const analyses = useMemo(
    () => parseStoredEvidenceAnalyses(snapshot),
    [snapshot],
  );

  return (
    <EvidenceAnalysesContext.Provider value={analyses}>
      {children}
    </EvidenceAnalysesContext.Provider>
  );
}

/**
 * Shared analyses from the nearest provider, or `null` when the subtree was not
 * wrapped (a standalone chip then falls back to reading the tab store itself).
 */
export function useEvidenceAnalyses(): EvidenceAnalysis[] | null {
  return useContext(EvidenceAnalysesContext);
}
