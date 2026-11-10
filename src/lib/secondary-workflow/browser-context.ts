/**
 * Browser-local secondary-workflow context (PRIV-01, accepted 2026-10-07).
 *
 * The accepted contract is that ALL veteran health context — diagnoses,
 * service-connected selections, ratings, medications, treatments, history,
 * symptoms and chronology — never leaves the browser. This module is the only
 * sanctioned home for that context: a versioned, bounded, schema-validated
 * record in browser storage. It must never be imported by a Server Component,
 * Server Action, route handler, or anything else that runs on the server.
 *
 * The bounds mirror the (now legacy) sealed-cookie schema exactly, so the
 * migration cannot silently expand what a browser is allowed to hold.
 */
import { z } from "zod";

import {
  MAX_CONTEXT_ITEM_LENGTH,
  MAX_CONTEXT_ITEMS,
  MAX_TIMELINE_YEAR,
} from "./state";

/** Versioned key. A version bump intentionally orphans older payloads. */
export const browserWorkflowContextStorageKey =
  "secondary-condition-finder:secondary-workflow:v1";

export const BROWSER_WORKFLOW_CONTEXT_VERSION = 1 as const;
/**
 * Only record-derived confirmations from the corrected negation/family
 * detector are accepted in the secondary research workflow. Manual diagnoses
 * and service-connected ratings are not migrated or reset.
 */
export const RECORD_DERIVED_SAFEGUARD_VERSION = 2 as const;

const contextEntrySchema = z.string().min(1).max(MAX_CONTEXT_ITEM_LENGTH);

const timelineEntrySchema = z.object({
  onsetYear: z.number().int().min(1900).max(MAX_TIMELINE_YEAR).optional(),
  diagnosisYear: z.number().int().min(1900).max(MAX_TIMELINE_YEAR).optional(),
});

const browserWorkflowContextSchema = z.object({
  version: z.literal(BROWSER_WORKFLOW_CONTEXT_VERSION),
  diagnosedConditionIds: z.array(z.string().min(1)).optional(),
  serviceConnectedConditionIds: z.array(z.string().min(1)).optional(),
  serviceConnectedAnswerDraft: z.record(z.string(), z.enum(["yes", "no"])).optional(),
  ratingsByConditionId: z
    .record(z.string(), z.number().int().min(0).max(100).nullable())
    .optional(),
  permanentAndTotalConditionIds: z.array(z.string().min(1)).optional(),
  documentsShared: z.boolean().optional(),
  medications: z.array(contextEntrySchema).max(MAX_CONTEXT_ITEMS).optional(),
  treatments: z.array(contextEntrySchema).max(MAX_CONTEXT_ITEMS).optional(),
  history: z.array(contextEntrySchema).max(MAX_CONTEXT_ITEMS).optional(),
  symptomIds: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(20).optional(),
  conditionTimeline: z.record(z.string(), timelineEntrySchema).optional(),
  // Explicitly confirmed RECORD-DERIVED *research topics*, not clinical diagnoses.
  // Only catalog IDs, status and opaque local source IDs; no quotes or document text.
  recordDiscoveredConditionIds: z.array(z.string().regex(/^[a-z0-9-]{2,90}$/))
    .max(30).optional(),
  recordClaimStatusByConditionId: z.record(
    z.string().regex(/^[a-z0-9-]{2,90}$/),
    z.enum(["not-yet-claimed", "pending", "denied", "unknown"]),
  ).refine((entries) => Object.keys(entries).length <= 30).optional(),
  recordSourceIdsByConditionId: z.record(
    z.string().regex(/^[a-z0-9-]{2,90}$/),
    z.array(z.string().min(1).max(128)).min(1).max(8),
  ).refine((entries) => Object.keys(entries).length <= 30).optional(),
  recordDerivedSafeguardVersion: z.literal(RECORD_DERIVED_SAFEGUARD_VERSION).optional(),
  recordDerivedReReviewRequired: z.boolean().optional(),
});

export type BrowserWorkflowContext = z.infer<typeof browserWorkflowContextSchema>;

/** Input shape for writes; the version is stamped by this module. */
export type BrowserWorkflowContextInput = Omit<BrowserWorkflowContext, "version">;

/** The bounded context schema rejected the record before storage was touched. */
export class BrowserWorkflowContextTooLargeError extends Error {
  constructor() {
    super("Browser-local workflow context exceeds the allowed bounds.");
    this.name = "BrowserWorkflowContextTooLargeError";
  }
}

export type ReadableStorage = Pick<Storage, "getItem">;
export type WritableStorage = Pick<Storage, "setItem">;
export type RemovableStorage = Pick<Storage, "removeItem">;

/**
 * Reads and validates the browser-local context. Missing, unreadable, corrupt,
 * out-of-version or out-of-bounds payloads return `null` — a broken record is
 * treated as absent rather than partially trusted.
 */
export function readBrowserWorkflowContext(
  storage: ReadableStorage,
): BrowserWorkflowContext | null {
  let raw: string | null;
  try {
    raw = storage.getItem(browserWorkflowContextStorageKey);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const result = browserWorkflowContextSchema.safeParse(parsed);
  if (!result.success) return null;
  const value = result.data;
  if (!(value.recordDiscoveredConditionIds?.length) ||
      value.recordDerivedSafeguardVersion === RECORD_DERIVED_SAFEGUARD_VERSION) {
    return value;
  }

  // Old opt-ins could have arisen from "No [disease]" or a family member's
  // diagnosis. They must not continue to the comparison engine after a code
  // update. Preserve manually entered diagnoses, VA ratings and other context.
  // The notice makes this fail-closed migration visible rather than silently
  // dropping prior research topics. The tab storage is updated on next save.
  const old = new Set(value.recordDiscoveredConditionIds);
  const rated = new Set(value.serviceConnectedConditionIds ?? []);
  const invalidated = new Set([...old].filter((id) => !rated.has(id)));
  return {
    ...value,
    diagnosedConditionIds: value.diagnosedConditionIds?.filter((id) => !invalidated.has(id)),
    conditionTimeline: Object.fromEntries(
      Object.entries(value.conditionTimeline ?? {}).filter(([id]) => !invalidated.has(id)),
    ),
    recordDiscoveredConditionIds: [],
    recordClaimStatusByConditionId: {},
    recordSourceIdsByConditionId: {},
    recordDerivedSafeguardVersion: RECORD_DERIVED_SAFEGUARD_VERSION,
    recordDerivedReReviewRequired: true,
  };
}

/**
 * Writes the context, replacing any previous record. Throws (like the cookie
 * budget error it replaces) when the payload exceeds the schema bounds, so the
 * caller can hold the user on the step instead of silently truncating context.
 */
export function writeBrowserWorkflowContext(
  storage: WritableStorage,
  context: BrowserWorkflowContextInput,
): void {
  const parsed = browserWorkflowContextSchema.safeParse({
    ...context,
    version: BROWSER_WORKFLOW_CONTEXT_VERSION,
  });
  if (!parsed.success) throw new BrowserWorkflowContextTooLargeError();
  storage.setItem(browserWorkflowContextStorageKey, JSON.stringify(parsed.data));
}

/** Removes the browser-local context. Throws if removal cannot be confirmed. */
export function clearBrowserWorkflowContext(storage: RemovableStorage): void {
  storage.removeItem(browserWorkflowContextStorageKey);
}

/** True when the record carries no veteran context at all. */
export function browserWorkflowContextIsEmpty(
  context: BrowserWorkflowContext | null,
): boolean {
  if (!context) return true;
  return Object.entries(context).every(([field, value]) => {
    if (field === "version") return true;
    if (value === undefined) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "object" && value !== null) {
      return Object.keys(value).length === 0;
    }
    return false;
  });
}
