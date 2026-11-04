/**
 * Browser-local evidence storage (sessionStorage).
 *
 * **Browser-only** — must never be imported from app pages, Server Actions,
 * or API routes. This module is part of the evidence-parser boundary
 * (see docs/evidence-parser-boundary.md). It reads/writes extracted evidence
 * excerpts to sessionStorage (tab-scoped) with bounded byte budgets.
 */
import {
  evidenceAnalysisStorageKey,
  MAX_EXCERPT_QUOTE_CHARS,
  type EvidenceAnalysis,
  type EvidenceExcerpt,
} from "@/lib/evidence/extract";
import {
  EXTENDED_LIMITS,
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

/**
 * Structural ceilings applied when the store is *read* (audit HARD-01).
 *
 * The write budgets above bound what this module writes. A store written by a
 * different app version, edited by hand, or replaced by same-origin script is
 * bound by nothing at all, and `JSON.parse` plus validation of such a payload
 * runs on the main thread before a single record is rendered. The byte ceiling
 * is the first guard; these are the second, because a payload can stay under
 * it and still be structurally enormous — one multi-megabyte `quote`, a
 * `matchedTerms` array of a million entries, an `excerpts` array of the same.
 *
 * Each ceiling sits above the largest shipped envelope (see
 * `EVIDENCE_DEPTH_LIMITS`), so a record this app wrote under either depth mode
 * still loads: legitimate records are refused only when they are not records
 * this app could have produced, and are never silently trimmed.
 */
export const MAX_STORED_SOURCE_NAME_CHARS = 512;
/**
 * Ceiling for the optional per-document id. Optional because a store written
 * before it existed is still a store this app wrote.
 */
export const MAX_STORED_SOURCE_ID_CHARS = 128;
export const MAX_STORED_LOCATOR_CHARS = 256;
export const MAX_STORED_EXCERPTS_PER_ANALYSIS = 64;
export const MAX_STORED_MATCHED_TERMS = 512;
export const MAX_STORED_MATCHED_TERM_CHARS = 200;

/**
 * The read ceiling for a caller that has no depth context (audit HARD-01).
 *
 * `loadStoredEvidence`/`loadStoredEvidenceWithWarning` take the caller's
 * *active* depth, because the analyzer restoring its own store knows which
 * envelope it wrote under. The Step 6 readers do not: they read the same store
 * from another page and only ever see the payload string. Their ceiling is
 * therefore the largest envelope this app can write — a payload above it was
 * never written by this app — so a legitimate Extended-mode store is never
 * refused, and never trimmed to the Standard retention window by a reader that
 * simply did not know the mode it was reading.
 */
export const MAX_STORED_EVIDENCE_READ_LIMITS: EvidenceLimits = EXTENDED_LIMITS;

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

function isBoundedString(value: unknown, maxChars: number): value is string {
  return typeof value === "string" && value.length <= maxChars;
}

function isEvidenceExcerpt(item: unknown): item is EvidenceExcerpt {
  if (!item || typeof item !== "object") return false;
  const excerpt = item as Record<string, unknown>;
  return (
    isBoundedString(excerpt.sourceName, MAX_STORED_SOURCE_NAME_CHARS) &&
    isBoundedString(excerpt.locator, MAX_STORED_LOCATOR_CHARS) &&
    // Shared with the classifier that produces the quote, so a quote this app
    // wrote can never be refused by the reader that validates it.
    isBoundedString(excerpt.quote, MAX_EXCERPT_QUOTE_CHARS) &&
    typeof excerpt.category === "string" &&
    EVIDENCE_CATEGORIES.has(excerpt.category) &&
    typeof excerpt.strength === "string" &&
    EVIDENCE_STRENGTHS.has(excerpt.strength) &&
    typeof excerpt.clinicianAuthored === "boolean" &&
    Array.isArray(excerpt.matchedTerms) &&
    excerpt.matchedTerms.length <= MAX_STORED_MATCHED_TERMS &&
    excerpt.matchedTerms.every((term) =>
      isBoundedString(term, MAX_STORED_MATCHED_TERM_CHARS),
    )
  );
}

function isEvidenceAnalysis(item: unknown): item is EvidenceAnalysis {
  if (!item || typeof item !== "object") return false;
  const analysis = item as Record<string, unknown>;
  return (
    analysis.version === 1 &&
    isBoundedString(analysis.sourceName, MAX_STORED_SOURCE_NAME_CHARS) &&
    (analysis.sourceId === undefined ||
      isBoundedString(analysis.sourceId, MAX_STORED_SOURCE_ID_CHARS)) &&
    Array.isArray(analysis.excerpts) &&
    analysis.excerpts.length <= MAX_STORED_EXCERPTS_PER_ANALYSIS &&
    analysis.excerpts.every(isEvidenceExcerpt) &&
    isNonNegativeInteger(analysis.nexusRelevantCount) &&
    isNonNegativeInteger(analysis.supportingCount)
  );
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function retainedExcerptCounts(
  excerpts: readonly EvidenceExcerpt[],
): Pick<EvidenceAnalysis, "nexusRelevantCount" | "supportingCount"> {
  return {
    nexusRelevantCount: excerpts.filter(
      (excerpt) => excerpt.strength === "nexus-relevant",
    ).length,
    supportingCount: excerpts.filter(
      (excerpt) => excerpt.strength === "supporting",
    ).length,
  };
}

function boundedAnalysis(
  analysis: EvidenceAnalysis,
  limits: EvidenceLimits,
): EvidenceAnalysis {
  const excerpts = analysis.excerpts.slice(
    0,
    limits.storedExcerptsPerSource,
  );
  return {
    ...analysis,
    excerpts,
    ...retainedExcerptCounts(excerpts),
  };
}

/**
 * The read guard validates every excerpt before the retention window is
 * applied and deliberately does not discard a structurally valid record.
 * Counts, however, must describe the excerpts the active depth keeps, or the
 * summary claims more than the review lists (Heal
 * s8-excerpt-count-exceeds-retained-1). Legacy records already written with
 * untrimmed counts are normalized here as they load.
 */
function withRetainedCounts(
  analysis: EvidenceAnalysis,
  limits: EvidenceLimits,
): EvidenceAnalysis {
  return {
    ...analysis,
    ...retainedExcerptCounts(
      analysis.excerpts.slice(0, limits.storedExcerptsPerSource),
    ),
  };
}

export interface SerializedEvidenceResult {
  serialized: string;
  dropped: number;
}

export function serializeStoredEvidenceWithInfo(
  analyses: EvidenceAnalysis[],
  limits: EvidenceLimits = STANDARD_LIMITS,
): SerializedEvidenceResult {
  let bounded = analyses
    .slice(-limits.storedSources)
    .map((analysis) => boundedAnalysis(analysis, limits));
  const initialCount = bounded.length;

  while (bounded.length > 0) {
    const serialized = JSON.stringify(bounded);
    if (byteLength(serialized) <= limits.storedBytes) {
      return { serialized, dropped: initialCount - bounded.length };
    }
    bounded = bounded.slice(1);
  }

  return { serialized: "[]", dropped: initialCount };
}

export function serializeStoredEvidence(
  analyses: EvidenceAnalysis[],
  limits: EvidenceLimits = STANDARD_LIMITS,
): string {
  return serializeStoredEvidenceWithInfo(analyses, limits).serialized;
}

/**
 * Outcome of reading one raw payload. A discriminated result rather than
 * exceptions keeps every console call site a plain string literal, because a
 * parser exception can carry document text.
 */
type StoredEvidenceRead =
  | { status: "ok"; analyses: EvidenceAnalysis[]; discardedEntries: number }
  | { status: "oversize" }
  | { status: "unreadable" };

/**
 * The one read path, in the order the audit requires:
 *
 *   1. The payload is measured BEFORE it is parsed. `JSON.parse` on a
 *      multi-megabyte string blocks the tab, and the write budget is not a read
 *      guard — nothing guarantees this store was written by this version.
 *   2. The retention window is applied BEFORE validation, so an oversized array
 *      costs one slice instead of one field-by-field check per entry.
 *   3. Every retained entry is validated against per-field ceilings, so one
 *      hostile record cannot hand the UI a multi-megabyte quote or an unbounded
 *      term list.
 *
 * A payload that fails at step 1, is not JSON, or is not an array is left
 * alone and reported to the caller, rather than quietly loading as nothing.
 * Entries that fail step 3 within the retained window are counted so the caller
 * can say how many were ignored: the older entries the window excludes are the
 * retention policy working, not a loss to disclose.
 */
function readStoredEvidence(raw: string, limits: EvidenceLimits): StoredEvidenceRead {
  // Cheap rejection before the encoder allocates: UTF-8 bytes are never fewer
  // than the string's UTF-16 code units, so this can only refuse a payload the
  // measured check below would refuse a moment later.
  if (raw.length > limits.storedBytes) return { status: "oversize" };
  if (byteLength(raw) > limits.storedBytes) return { status: "oversize" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { status: "unreadable" };
  }
  if (!Array.isArray(parsed)) return { status: "ok", analyses: [], discardedEntries: 0 };

  const window = parsed.slice(-limits.storedSources);
  const analyses = window
    .filter(isEvidenceAnalysis)
    .map((analysis) => withRetainedCounts(analysis, limits));
  return { status: "ok", analyses, discardedEntries: window.length - analyses.length };
}

/**
 * Bounded, fail-closed read of a payload the caller already holds.
 *
 * The Step 6 review components read the store through `useSyncExternalStore`
 * snapshots, so they have the raw string, not a `Storage` handle. This is the
 * same read path — payload measured before `JSON.parse`, retention window
 * sliced before validation, per-field ceilings — for a reader with no depth
 * context, and it is what keeps a hand-edited or same-origin-replaced store
 * from making every consumer of the store parse it differently.
 */
export function parseStoredEvidence(
  raw: string,
  limits: EvidenceLimits = MAX_STORED_EVIDENCE_READ_LIMITS,
): EvidenceAnalysis[] {
  const read = readStoredEvidence(raw, limits);
  return read.status === "ok" ? read.analyses : [];
}

function warnStoredEvidence(code: string): void {
  try {
    // Fixed code only — never an exception message, a stored value, or a byte
    // count of document text.
    console.warn(`[evidence-storage] ${code}`);
  } catch {
    // observability is best-effort
  }
}

export function loadStoredEvidence(
  storage: StorageReader | null,
  limits: EvidenceLimits = STANDARD_LIMITS,
): EvidenceAnalysis[] {
  if (!storage) return [];

  try {
    const raw = storage.getItem(evidenceAnalysisStorageKey);
    if (!raw) return [];
    const read = readStoredEvidence(raw, limits);
    return read.status === "ok" ? read.analyses : [];
  } catch {
    return [];
  }
}

export interface StoredEvidenceLoadResult {
  analyses: EvidenceAnalysis[];
  /**
   * Fixed content-free notice when the store could not be read at all (absent
   * payload, unreadable, or over the byte ceiling), else null.
   */
  parseError: string | null;
  /**
   * Retained-window entries that failed validation and were ignored. Non-zero
   * means the store held records this version will not render: the caller must
   * say so, because discarding them silently is the data loss this read path
   * exists to prevent.
   */
  discardedEntries: number;
}

/**
 * Read variant that reports why nothing loaded. Both messages are constants:
 * neither parser text (which can include document text) nor stored content
 * ever reaches the user or the console.
 */
export function loadStoredEvidenceWithWarning(
  storage: StorageReader | null,
  limits: EvidenceLimits = STANDARD_LIMITS,
): StoredEvidenceLoadResult {
  if (!storage) return { analyses: [], parseError: null, discardedEntries: 0 };

  let raw: string | null;
  try {
    raw = storage.getItem(evidenceAnalysisStorageKey);
  } catch {
    warnStoredEvidence("STORE_UNREADABLE");
    return { analyses: [], parseError: "Saved evidence could not be read.", discardedEntries: 0 };
  }
  if (!raw) return { analyses: [], parseError: null, discardedEntries: 0 };

  const read = readStoredEvidence(raw, limits);
  if (read.status !== "ok") {
    warnStoredEvidence(read.status === "oversize" ? "STORE_OVERSIZE" : "STORE_UNREADABLE");
    return { analyses: [], parseError: "Saved evidence could not be read.", discardedEntries: 0 };
  }
  if (read.discardedEntries > 0) {
    warnStoredEvidence("STORE_PARTIAL");
  }
  return {
    analyses: read.analyses,
    parseError: null,
    discardedEntries: read.discardedEntries,
  };
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
