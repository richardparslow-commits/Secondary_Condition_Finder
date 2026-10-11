"use client";

import { useMemo, useSyncExternalStore } from "react";

import {
  EMPTY_EVIDENCE_ANALYSES_SNAPSHOT,
  getEvidenceAnalysesSnapshot,
  parseStoredEvidenceAnalyses,
  subscribeToEvidenceAnalyses,
  useEvidenceAnalyses,
} from "@/components/evidence/EvidenceAnalysesProvider";
import {
  assessGapCoverage,
  type GapCoverageResult,
} from "@/lib/evidence/gap-coverage";

interface Props {
  gap: string;
  conditionTerms: string[];
}

const CHIP: Record<GapCoverageResult["status"], { className: string; label: string }> = {
  covered: {
    className:
      "inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900",
    label: "Excerpt coverage: addressed",
  },
  "evidence-found": {
    className:
      "inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900",
    label: "Excerpt coverage: related evidence",
  },
  uncovered: {
    className:
      "inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600",
    label: "No excerpt coverage",
  },
};

export function EvidenceGapCoverage({ gap, conditionTerms }: Props) {
  // Step 6 renders one chip per authored evidence gap. The surrounding
  // EvidenceAnalysesProvider parses the retained payload once, so this chip
  // only consumes the shared analyses instead of re-parsing per gap. The local
  // snapshot/parse remains as a fallback for a chip rendered without a
  // provider.
  const sharedAnalyses = useEvidenceAnalyses();
  const snapshot = useSyncExternalStore(
    subscribeToEvidenceAnalyses,
    getEvidenceAnalysesSnapshot,
    () => EMPTY_EVIDENCE_ANALYSES_SNAPSHOT,
  );
  const analyses = useMemo(
    () => sharedAnalyses ?? parseStoredEvidenceAnalyses(snapshot),
    [sharedAnalyses, snapshot],
  );
  const coverage = useMemo(
    () =>
      analyses.length === 0
        ? null
        : assessGapCoverage(gap, analyses, conditionTerms),
    [analyses, gap, conditionTerms],
  );

  if (coverage === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-muted">
        No local excerpts in this tab
      </span>
    );
  }

  const chip = CHIP[coverage.status];
  const title =
    coverage.sources.length > 0
      ? `From: ${coverage.sources.join(", ")}`
      : "No browser-local excerpt matches this gap";

  return (
    <span className={chip.className} title={title}>
      {chip.label}
    </span>
  );
}
