/**
 * Browser-local presumptive service history (PRIV-01 follow-on, 2026-10-08).
 *
 * The presumptive track previously posted the confirmed service locations,
 * branches and dates to the `saveServiceHistory` Server Action, which sealed
 * them into the `presumptive-workflow-v1` cookie. That server boundary is now
 * retired: confirmed service history lives in this module's browser-local
 * record and is not submitted to the application server. The record is versioned,
 * schema-validated and bounded by the same `serviceHistorySchema` the retired
 * action used, so the migration cannot quietly widen what a browser may hold.
 *
 * Reading is fail-safe: a missing, corrupt, out-of-version or out-of-bounds
 * payload reads as absent and is never partially trusted. This module must
 * never be imported by a Server Component, Server Action or route handler.
 */
import { serviceHistorySchema, type ServiceHistory } from "./match";

/** Versioned key. A version bump intentionally orphans older payloads. */
export const presumptiveHistoryStorageKey =
  "presumptive-condition-finder:service-history:v1";

export const PRESUMPTIVE_HISTORY_VERSION = 1 as const;

/**
 * The single registry of browser-local keys this track owns, mirroring the
 * secondary workflow's `secondaryWorkflowLocalStorageKeys`. A new key must be
 * added here in the same change that introduces it: the design-conformance
 * suite fails any versioned key in src/ that no registry covers, so a
 * browser-local store cannot ship without a documented clear-all.
 */
export const presumptiveLocalStorageKeys = [
  presumptiveHistoryStorageKey,
] as const;

export type ReadableStorage = Pick<Storage, "getItem">;
export type WritableStorage = Pick<Storage, "setItem">;
export type RemovableStorage = Pick<Storage, "removeItem">;

/**
 * Same-tab change signal for the read hook's module snapshot. The browser
 * `storage` event only fires in other tabs, so a write or clear here must
 * advance a revision the hook can compare against even when no consumer is
 * mounted (the form writes, then navigates to the results view).
 */
let historyRevision = 0;
const changeListeners = new Set<() => void>();

export function presumptiveHistoryRevision(): number {
  return historyRevision;
}

export function subscribeToPresumptiveHistoryChanges(
  listener: () => void,
): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

function markPresumptiveHistoryChanged(): void {
  historyRevision += 1;
  for (const listener of changeListeners) listener();
}

/** Reads and validates the browser-local service history. */
export function readPresumptiveHistory(
  storage: ReadableStorage,
): ServiceHistory | null {
  let raw: string | null;
  try {
    raw = storage.getItem(presumptiveHistoryStorageKey);
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
  if (typeof parsed !== "object" || parsed === null) return null;

  const { version, ...history } = parsed as Record<string, unknown>;
  if (version !== PRESUMPTIVE_HISTORY_VERSION) return null;

  const result = serviceHistorySchema.safeParse(history);
  return result.success ? result.data : null;
}

/**
 * Writes the service history, replacing any previous record. Throws when the
 * payload violates the schema bounds, so a caller cannot silently truncate
 * what the veteran confirmed.
 */
export function writePresumptiveHistory(
  storage: WritableStorage,
  history: ServiceHistory,
): void {
  const validated = serviceHistorySchema.parse(history);
  storage.setItem(
    presumptiveHistoryStorageKey,
    JSON.stringify({ version: PRESUMPTIVE_HISTORY_VERSION, ...validated }),
  );
  markPresumptiveHistoryChanged();
}

/** Removes the browser-local service history. */
export function clearPresumptiveHistory(storage: RemovableStorage): void {
  try {
    storage.removeItem(presumptiveHistoryStorageKey);
  } finally {
    markPresumptiveHistoryChanged();
  }
}

/**
 * Clears every browser-local key this track owns. Raw service-history content
 * is never copied or sent anywhere while clearing.
 */
export function clearPresumptiveLocalState(storage: RemovableStorage): void {
  try {
    for (const key of presumptiveLocalStorageKeys) {
      storage.removeItem(key);
    }
  } finally {
    markPresumptiveHistoryChanged();
  }
}

/** True when the record carries no service history at all. */
export function presumptiveHistoryIsEmpty(
  history: ServiceHistory | null,
): boolean {
  if (!history) return true;
  return (
    history.locations.length === 0 &&
    (history.serviceBranchCodes?.length ?? 0) === 0 &&
    history.serviceStart === null &&
    history.serviceEnd === null
  );
}

/** The fixed validation taxonomy the retired Server Action used. */
export type ServiceHistoryValidationCode =
  | "select-location"
  | "date-order"
  | "invalid-date";

/** A fourth outcome the browser adds: local storage refused the write. */
export type ServiceHistoryFailureCode =
  | ServiceHistoryValidationCode
  | "storage-unavailable";

/**
 * User-facing copy for every failure code. Shared by the manual form, the
 * DD-214 verification step and the page's `?error=` deep-link surface so the
 * wording cannot drift between them.
 */
export const SERVICE_HISTORY_MESSAGES: Record<ServiceHistoryFailureCode, string> = {
  "select-location": "Select at least one location where you served.",
  "date-order": "Service start date must be on or before the end date.",
  "invalid-date": "Enter real calendar dates in YYYY-MM-DD format or leave them blank.",
  "storage-unavailable":
    "This browser could not save your service history locally. Check that storage is enabled for this site, then try again.",
};

/** Raw, untrusted input from a form or the DD-214 verification step. */
export interface ServiceHistoryDraft {
  serviceBranchCodes: string[];
  locations: string[];
  serviceStart: string | null;
  serviceEnd: string | null;
}

/** Trims, drops blanks and normalizes empty dates to null before validation. */
export function normalizeServiceHistoryDraft(input: {
  serviceBranchCodes?: readonly string[];
  locations?: readonly string[];
  serviceStart?: string | null;
  serviceEnd?: string | null;
}): ServiceHistoryDraft {
  const clean = (values?: readonly string[]) =>
    (values ?? []).map((value) => value.trim()).filter(Boolean);
  const date = (value?: string | null) => {
    const trimmed = (value ?? "").trim();
    return trimmed === "" ? null : trimmed;
  };

  return {
    serviceBranchCodes: clean(input.serviceBranchCodes),
    locations: clean(input.locations),
    serviceStart: date(input.serviceStart),
    serviceEnd: date(input.serviceEnd),
  };
}

export type ServiceHistoryIntakeResult =
  | { ok: true; history: ServiceHistory }
  | { ok: false; code: ServiceHistoryFailureCode };

/** Maps schema issues to the fixed codes the retired action redirected with. */
function validationCodeFor(
  issues: readonly { path: PropertyKey[]; code: string }[],
): ServiceHistoryValidationCode {
  if (issues.some((issue) => issue.path[0] === "locations")) {
    return "select-location";
  }
  if (
    issues.some(
      (issue) => issue.path[0] === "serviceEnd" && issue.code === "custom",
    )
  ) {
    return "date-order";
  }
  return "invalid-date";
}

/**
 * Validates a draft against the schema and the authored catalog allowlist.
 *
 * The membership check preserves the location restriction formerly applied by the Server Action's
 * server-side allowlist: only locations authored in the exposure catalog may
 * be stored, so a crafted client value cannot drive matching against
 * non-catalog text. It runs client-side now because there is no server call.
 */
export function validateServiceHistoryDraft(
  draft: ServiceHistoryDraft,
  knownLocations: readonly string[],
): ServiceHistoryIntakeResult {
  const parsed = serviceHistorySchema.safeParse(draft);
  if (!parsed.success) {
    return { ok: false, code: validationCodeFor(parsed.error.issues) };
  }

  const allowed = new Set(knownLocations);
  if (parsed.data.locations.some((location) => !allowed.has(location))) {
    return { ok: false, code: "select-location" };
  }

  return { ok: true, history: parsed.data };
}

/**
 * Validates, then persists to the browser-local record. This is the only path
 * that stores confirmed service history: it performs no fetch, sets no cookie
 * and reports a failed write instead of pretending the review can continue.
 */
export function persistServiceHistory(
  storage: WritableStorage,
  draft: ServiceHistoryDraft,
  knownLocations: readonly string[],
): ServiceHistoryIntakeResult {
  const result = validateServiceHistoryDraft(draft, knownLocations);
  if (!result.ok) return result;

  try {
    writePresumptiveHistory(storage, result.history);
  } catch {
    return { ok: false, code: "storage-unavailable" };
  }
  return result;
}
