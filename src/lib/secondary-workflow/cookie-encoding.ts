import "server-only";

import { createHash } from "node:crypto";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { sealSessionPayload } from "@/lib/workflow-session-crypto";

/**
 * Compact cookie transport encoding for secondary-workflow state.
 *
 * Workflow state rides in a size-bounded encrypted cookie
 * (MAX_WORKFLOW_COOKIE_VALUE_BYTES). The dominant payload cost was repeated
 * 20-30 character catalog ID strings; this module encodes catalog-referenced
 * IDs as indices into the sorted catalog (813 conditions -> at most 4
 * characters each) so veterans selecting dozens of conditions fit comfortably
 * inside the budget instead of hitting the fail-closed ceiling.
 *
 * Transport-layer only: the rest of the application continues to read and
 * write plain string IDs. The encoded form exists solely inside the sealed
 * cookie value.
 *
 * Catalog identity is bound into the payload with a versioned fingerprint
 * (SHA-256 over the sorted catalog IDs, prefixed with the encoding version).
 * A sealed state that predates a catalog change fails closed on read (returns
 * null, exactly like a tampered/expired cookie) rather than silently mapping
 * old indices onto new conditions.
 */

const ENCODING_VERSION = 1;

let catalogIdCache: string[] | null = null;
let fingerprintCache: string | null = null;

function catalogIdList(): string[] {
  if (!catalogIdCache) {
    catalogIdCache = loadConditionCatalog()
      .map((condition) => condition.id)
      .sort();
  }
  return catalogIdCache;
}

/** Versioned fingerprint binding encoded indices to the exact catalog revision. */
export function workflowCatalogFingerprint(): string {
  if (!fingerprintCache) {
    const hash = createHash("sha256");
    hash.update(`v${ENCODING_VERSION}`);
    for (const id of catalogIdList()) hash.update(`${id}\n`);
    fingerprintCache = hash.digest("base64url").slice(0, 16);
  }
  return fingerprintCache;
}

/** Test seam: forget the cached ID list and fingerprint. */
export function resetWorkflowCatalogEncodingCache(): void {
  catalogIdCache = null;
  fingerprintCache = null;
}

export interface CompactableState {
  diagnosedConditionIds?: string[];
  serviceConnectedConditionIds?: string[];
  serviceConnectedAnswerDraft?: Record<string, "yes" | "no">;
  ratingsByConditionId?: Record<string, number | null>;
  conditionTimeline?: Record<string, { onsetYear?: number; diagnosisYear?: number }>;
}

interface EncodedState {
  v: 1;
  /** Catalog fingerprint at seal time. */
  fp: string;
  /** Condition IDs encoded as catalog indices. */
  dx?: number[];
  sc?: number[];
  /** Service-connected yes/no draft answers, keyed by catalog index. */
  draft?: Record<string, "yes" | "no">;
  /** Ratings keyed by catalog index ("d" = declined to answer). */
  rt?: Record<string, number | "d">;
  /** Per-condition onset/diagnosis years keyed by catalog index. */
  tl?: Record<string, { o?: number; d?: number }>;
}

/** Thrown by encodeWorkflowState when a state cannot be safely encoded. */
export class WorkflowCookieEncodingError extends Error {}

function toIndex(id: string, index: Map<string, number>): number {
  const value = index.get(id);
  if (value === undefined) {
    throw new WorkflowCookieEncodingError(
      `Condition id "${id}" is not in the catalog; refusing to encode it into the workflow cookie.`,
    );
  }
  return value;
}

function toIndices(ids: string[] | undefined, index: Map<string, number>): number[] | undefined {
  if (!ids?.length) return undefined;
  return ids.map((id) => toIndex(id, index));
}

/**
 * Encodes a stored workflow state into the compact cookie payload shape.
 * Catalog-referenced IDs must resolve against the current catalog; anything
 * else throws so oversized/unknown states never enter the cookie.
 */
export function encodeWorkflowState(
  state: CompactableState,
): EncodedState {
  const ids = catalogIdList();
  const index = new Map(ids.map((id, position) => [id, position]));
  const encoded: EncodedState = { v: ENCODING_VERSION, fp: workflowCatalogFingerprint() };

  const dx = toIndices(state.diagnosedConditionIds, index);
  if (dx) encoded.dx = dx;
  const sc = toIndices(state.serviceConnectedConditionIds, index);
  if (sc) encoded.sc = sc;

  if (state.serviceConnectedAnswerDraft) {
    const draft: Record<string, "yes" | "no"> = {};
    for (const [id, answer] of Object.entries(state.serviceConnectedAnswerDraft)) {
      draft[String(toIndex(id, index))] = answer;
    }
    if (Object.keys(draft).length > 0) encoded.draft = draft;
  }

  if (state.ratingsByConditionId) {
    const ratings: Record<string, number | "d"> = {};
    for (const [id, rating] of Object.entries(state.ratingsByConditionId)) {
      ratings[String(toIndex(id, index))] = rating === null ? "d" : rating;
    }
    if (Object.keys(ratings).length > 0) encoded.rt = ratings;
  }

  if (state.conditionTimeline) {
    const timeline: Record<string, { o?: number; d?: number }> = {};
    for (const [id, entry] of Object.entries(state.conditionTimeline)) {
      const compact: { o?: number; d?: number } = {};
      if (entry.onsetYear !== undefined) compact.o = entry.onsetYear;
      if (entry.diagnosisYear !== undefined) compact.d = entry.diagnosisYear;
      if (compact.o !== undefined || compact.d !== undefined) {
        timeline[String(toIndex(id, index))] = compact;
      }
    }
    if (Object.keys(timeline).length > 0) encoded.tl = timeline;
  }

  return encoded;
}

/**
 * Decodes a compact cookie payload back into the stored state shape.
 * Fails closed: a fingerprint mismatch (catalog changed since seal) or an
 * out-of-range index returns null so callers treat it like any other
 * unreadable cookie instead of guessing at shifted identities.
 */
export function decodeWorkflowState(encoded: unknown): CompactableState | null {
  if (typeof encoded !== "object" || encoded === null) return null;
  const candidate = encoded as Partial<EncodedState>;
  if (candidate.v !== ENCODING_VERSION) return null;
  if (candidate.fp !== workflowCatalogFingerprint()) return null;

  const ids = catalogIdList();
  const resolve = (value: number): string | null => {
    if (!Number.isSafeInteger(value) || value < 0 || value >= ids.length) return null;
    return ids[value];
  };

  const state: CompactableState = {};

  if (candidate.dx) {
    const decoded: string[] = [];
    for (const value of candidate.dx) {
      const id = resolve(value);
      if (!id) return null;
      decoded.push(id);
    }
    state.diagnosedConditionIds = decoded;
  }

  if (candidate.sc) {
    const decoded: string[] = [];
    for (const value of candidate.sc) {
      const id = resolve(value);
      if (!id) return null;
      decoded.push(id);
    }
    state.serviceConnectedConditionIds = decoded;
  }

  if (candidate.draft) {
    const answers: Record<string, "yes" | "no"> = {};
    for (const [key, answer] of Object.entries(candidate.draft)) {
      if (answer !== "yes" && answer !== "no") return null;
      const id = resolve(Number(key));
      if (!id) return null;
      answers[id] = answer;
    }
    state.serviceConnectedAnswerDraft = answers;
  }

  if (candidate.rt) {
    const ratings: Record<string, number | null> = {};
    for (const [key, rating] of Object.entries(candidate.rt)) {
      const id = resolve(Number(key));
      if (!id) return null;
      if (rating === "d") {
        ratings[id] = null;
      } else if (Number.isSafeInteger(rating) && rating >= 0 && rating <= 100) {
        ratings[id] = rating;
      } else {
        return null;
      }
    }
    state.ratingsByConditionId = ratings;
  }

  if (candidate.tl) {
    const timeline: Record<string, { onsetYear?: number; diagnosisYear?: number }> = {};
    for (const [key, entry] of Object.entries(candidate.tl)) {
      if (typeof entry !== "object" || entry === null) return null;
      const id = resolve(Number(key));
      if (!id) return null;
      const decoded: { onsetYear?: number; diagnosisYear?: number } = {};
      if (entry.o !== undefined) {
        if (!Number.isSafeInteger(entry.o)) return null;
        decoded.onsetYear = entry.o;
      }
      if (entry.d !== undefined) {
        if (!Number.isSafeInteger(entry.d)) return null;
        decoded.diagnosisYear = entry.d;
      }
      timeline[id] = decoded;
    }
    state.conditionTimeline = timeline;
  }

  return state;
}

/**
 * Approximate sealed-cookie byte size for a state under the current encoding
 * (envelope overhead + base64url expansion), including the verbatim free-text
 * context so the estimate matches what sealWorkflowState would measure.
 * Never touches the network or disk.
 */
export function approximateSealedCookieBytes(
  state: CompactableState & {
    documentsShared?: boolean;
    medications?: string[];
    treatments?: string[];
    history?: string[];
    symptomIds?: string[];
  },
): number {
  const probe = "workflow-cookie-size-probe-secret-0123456789";
  const payload = {
    ...encodeWorkflowState(state),
    documentsShared: state.documentsShared,
    medications: state.medications,
    treatments: state.treatments,
    history: state.history,
    symptomIds: state.symptomIds,
  };
  return Buffer.byteLength(
    sealSessionPayload(payload, probe, { maxAgeSeconds: 60 }),
    "utf8",
  );
}
