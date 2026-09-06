"use client";

import { useMemo, useSyncExternalStore } from "react";

import { evidenceAnalysisStorageKey, type EvidenceAnalysis } from "@/lib/evidence/extract";
import {
  assessGapCoverage,
  type GapCoverageResult,
} from "@/lib/evidence/gap-coverage";

const EMPTY_SNAPSHOT = "[]";

function getSnapshot(): string {
  try {
    return window.sessionStorage.getItem(evidenceAnalysisStorageKey) ?? EMPTY_SNAPSHOT;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

function subscribe(): () => void {
  // Evidence excerpts are written on Step 4 before this mounts on Step 6; the
  // store does not change while the review page is open.
  return () => undefined;
}

function parseAnalyses(raw: string): EvidenceAnalysis[] {
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
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_SNAPSHOT);
  const coverage = useMemo(() => {
    const analyses = parseAnalyses(snapshot);
    if (analyses.length === 0) return null;
    return assessGapCoverage(gap, analyses, conditionTerms);
  }, [snapshot, gap, conditionTerms]);

  if (coverage === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
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
