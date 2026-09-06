import {
  evidenceAnalysisStorageKey,
  type EvidenceAnalysis,
  type EvidenceExcerpt,
} from "@/lib/evidence/extract";
import {
  STANDARD_LIMITS,
  type EvidenceLimits,
} from "@/lib/evidence/limits";

/**
 * Legacy Standard-mode retention aliases. Serialize/load/save take an explicit
 * EvidenceLimits argument (defaulting to STANDARD_LIMITS) so the same store
 * serves both depth modes; these names remain exported for callers and tests
 * that pin the Standard envelope.
 */
export const MAX_STORED_EVIDENCE_SOURCES = STANDARD_LIMITS.storedSources;
export const MAX_STORED_EVIDENCE_EXCERPTS_PER_SOURCE =
  STANDARD_LIMITS.storedExcerptsPerSource;
export const MAX_STORED_EVIDENCE_BYTES = STANDARD_LIMITS.storedBytes;

interface StorageReader {
  getItem(key: string): string | null;
}

interface StorageWriter {
  setItem(key: string, value: string): void;
}

interface StorageRemover {
  removeItem(key: string): void;
}

const EVIDENCE_CATEGORIES = new Set([
  "diagnosis",
  "causation",
  "aggravation",
  "treatment",
  "medication",
  "timeline",
  "alternative-cause",
]);
const EVIDENCE_STRENGTHS = new Set(["nexus-relevant", "supporting"]);

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isEvidenceExcerpt(item: unknown): item is EvidenceExcerpt {
  if (!item || typeof item !== "object") return false;
  const excerpt = item as Record<string, unknown>;
  return (
    typeof excerpt.sourceName === "string" &&
    typeof excerpt.locator === "string" &&
    typeof excerpt.quote === "string" &&
    typeof excerpt.category === "string" &&
    EVIDENCE_CATEGORIES.has(excerpt.category) &&
    typeof excerpt.strength === "string" &&
    EVIDENCE_STRENGTHS.has(excerpt.strength) &&
    typeof excerpt.clinicianAuthored === "boolean" &&
    Array.isArray(excerpt.matchedTerms) &&
    excerpt.matchedTerms.every((term) => typeof term === "string")
  );
}

function isEvidenceAnalysis(item: unknown): item is EvidenceAnalysis {
  if (!item || typeof item !== "object") return false;
  const analysis = item as Record<string, unknown>;
  return (
    analysis.version === 1 &&
    typeof analysis.sourceName === "string" &&
    Array.isArray(analysis.excerpts) &&
    analysis.excerpts.every(isEvidenceExcerpt) &&
    isNonNegativeInteger(analysis.nexusRelevantCount) &&
    isNonNegativeInteger(analysis.supportingCount)
  );
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function boundedAnalysis(
  analysis: EvidenceAnalysis,
  limits: EvidenceLimits,
): EvidenceAnalysis {
  return {
    ...analysis,
    excerpts: analysis.excerpts.slice(
      0,
      limits.storedExcerptsPerSource,
    ),
  };
}

export function serializeStoredEvidence(
  analyses: EvidenceAnalysis[],
  limits: EvidenceLimits = STANDARD_LIMITS,
): string {
  let bounded = analyses
    .slice(-limits.storedSources)
    .map((analysis) => boundedAnalysis(analysis, limits));

  while (bounded.length > 0) {
    const serialized = JSON.stringify(bounded);
    if (byteLength(serialized) <= limits.storedBytes) {
      return serialized;
    }
    bounded = bounded.slice(1);
  }

  return "[]";
}

export function loadStoredEvidence(
  storage: StorageReader | null,
  limits: EvidenceLimits = STANDARD_LIMITS,
): EvidenceAnalysis[] {
  if (!storage) return [];

  try {
    const raw = storage.getItem(evidenceAnalysisStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEvidenceAnalysis).slice(-limits.storedSources);
  } catch {
    return [];
  }
}

export function saveStoredEvidence(
  storage: StorageWriter | null,
  analyses: EvidenceAnalysis[],
  limits: EvidenceLimits = STANDARD_LIMITS,
): boolean {
  if (!storage) return false;

  try {
    storage.setItem(
      evidenceAnalysisStorageKey,
      serializeStoredEvidence(analyses, limits),
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
