import {
  evidenceAnalysisStorageKey,
  type EvidenceAnalysis,
} from "@/lib/evidence/extract";

export const MAX_STORED_EVIDENCE_SOURCES = 10;
export const MAX_STORED_EVIDENCE_EXCERPTS_PER_SOURCE = 5;
export const MAX_STORED_EVIDENCE_BYTES = 256 * 1024;

interface StorageReader {
  getItem(key: string): string | null;
}

interface StorageWriter {
  setItem(key: string, value: string): void;
}

interface StorageRemover {
  removeItem(key: string): void;
}

function isEvidenceAnalysis(item: unknown): item is EvidenceAnalysis {
  return Boolean(
    item &&
      typeof item === "object" &&
      (item as EvidenceAnalysis).version === 1,
  );
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function boundedAnalysis(analysis: EvidenceAnalysis): EvidenceAnalysis {
  return {
    ...analysis,
    excerpts: analysis.excerpts.slice(
      0,
      MAX_STORED_EVIDENCE_EXCERPTS_PER_SOURCE,
    ),
  };
}

export function serializeStoredEvidence(analyses: EvidenceAnalysis[]): string {
  let bounded = analyses
    .slice(-MAX_STORED_EVIDENCE_SOURCES)
    .map(boundedAnalysis);

  while (bounded.length > 0) {
    const serialized = JSON.stringify(bounded);
    if (byteLength(serialized) <= MAX_STORED_EVIDENCE_BYTES) {
      return serialized;
    }
    bounded = bounded.slice(1);
  }

  return "[]";
}

export function loadStoredEvidence(
  storage: StorageReader | null,
): EvidenceAnalysis[] {
  if (!storage) return [];

  try {
    const raw = storage.getItem(evidenceAnalysisStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEvidenceAnalysis).slice(-MAX_STORED_EVIDENCE_SOURCES);
  } catch {
    return [];
  }
}

export function saveStoredEvidence(
  storage: StorageWriter | null,
  analyses: EvidenceAnalysis[],
): boolean {
  if (!storage) return false;

  try {
    storage.setItem(
      evidenceAnalysisStorageKey,
      serializeStoredEvidence(analyses),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearStoredEvidence(storage: StorageRemover | null): boolean {
  if (!storage) return false;

  try {
    storage.removeItem(evidenceAnalysisStorageKey);
    return true;
  } catch {
    return false;
  }
}
