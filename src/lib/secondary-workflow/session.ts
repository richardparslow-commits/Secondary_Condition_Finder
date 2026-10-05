import { cookies } from "next/headers";
import { z } from "zod";

import {
  openSessionPayload,
  sealSessionPayload,
  WORKFLOW_SESSION_MAX_AGE_SECONDS,
  workflowSessionSecret,
} from "@/lib/workflow-session-crypto";
import {
  encodeWorkflowState,
  decodeWorkflowState,
} from "./cookie-encoding";
import {
  MAX_CONTEXT_ITEM_LENGTH,
  MAX_CONTEXT_ITEMS,
  ratingFieldName,
  type QueryParams,
  type SecondaryWorkflowState,
} from "./state";

const WORKFLOW_COOKIE = "secondary-workflow-v2";
export const MAX_WORKFLOW_COOKIE_VALUE_BYTES = 3800;

/**
 * Typed error thrown when a state cannot fit the cookie budget. Server actions
 * catch this specifically and hold the user on their step with an actionable
 * message instead of a generic server failure (the last good cookie is left
 * untouched because the throw happens before jar.set).
 */
export class WorkflowCookieBudgetError extends Error {
  constructor() {
    super(
      `Secondary workflow state exceeds the safe cookie value budget of ${MAX_WORKFLOW_COOKIE_VALUE_BYTES} bytes. Reduce selected workflow context and try again.`,
    );
    this.name = "WorkflowCookieBudgetError";
  }
}

const contextEntrySchema = z.string().min(1).max(MAX_CONTEXT_ITEM_LENGTH);
const timelineEntrySchema = z.object({
  onsetYear: z.number().int().min(1900).max(2100).optional(),
  diagnosisYear: z.number().int().min(1900).max(2100).optional(),
});

const storedWorkflowStateSchema = z.object({
  diagnosedConditionIds: z.array(z.string().min(1)).optional(),
  serviceConnectedConditionIds: z.array(z.string().min(1)).optional(),
  serviceConnectedAnswerDraft: z.record(z.string(), z.enum(["yes", "no"])).optional(),
  ratingsByConditionId: z
    .record(z.string(), z.number().int().min(0).max(100).nullable())
    .optional(),
  documentsShared: z.boolean().optional(),
  medications: z.array(contextEntrySchema).max(MAX_CONTEXT_ITEMS).optional(),
  treatments: z.array(contextEntrySchema).max(MAX_CONTEXT_ITEMS).optional(),
  history: z.array(contextEntrySchema).max(MAX_CONTEXT_ITEMS).optional(),
  symptomIds: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(20).optional(),
  conditionTimeline: z.record(z.string(), timelineEntrySchema).optional(),
});

export type StoredSecondaryWorkflowState = z.infer<typeof storedWorkflowStateSchema>;

/** Keys carried in the compact transport encoding (catalog-referenced IDs). */
function compactablePart(state: StoredSecondaryWorkflowState) {
  return {
    diagnosedConditionIds: state.diagnosedConditionIds,
    serviceConnectedConditionIds: state.serviceConnectedConditionIds,
    serviceConnectedAnswerDraft: state.serviceConnectedAnswerDraft,
    ratingsByConditionId: state.ratingsByConditionId,
    conditionTimeline: state.conditionTimeline,
  };
}

/** Keys carried verbatim (free-text context, flags, symptom prompt ids). */
function verbatimPart(state: StoredSecondaryWorkflowState) {
  return {
    documentsShared: state.documentsShared,
    medications: state.medications,
    treatments: state.treatments,
    history: state.history,
    symptomIds: state.symptomIds,
  };
}

function normalizeEncoded(candidate: Record<string, unknown>): StoredSecondaryWorkflowState | null {
  // Decode the compact condition references, then re-attach the verbatim
  // free-text context that rides unencoded, and validate the whole shape so
  // bounds (entry counts, lengths) hold for everything read from the cookie.
  const decoded = decodeWorkflowState(candidate);
  if (!decoded) return null;
  const merged = {
    ...decoded,
    documentsShared: candidate.documentsShared,
    medications: candidate.medications,
    treatments: candidate.treatments,
    history: candidate.history,
    symptomIds: candidate.symptomIds,
  };
  const parsed = storedWorkflowStateSchema.safeParse(merged);
  return parsed.success ? parsed.data : null;
}

export function parseStoredSecondaryWorkflowState(
  value: unknown,
): StoredSecondaryWorkflowState {
  return storedWorkflowStateSchema.parse(value);
}

export function sealWorkflowState(
  state: StoredSecondaryWorkflowState,
  secret = workflowSessionSecret(),
): string {
  const clean = parseStoredSecondaryWorkflowState(state);
  const payload = {
    ...encodeWorkflowState(compactablePart(clean)),
    ...verbatimPart(clean),
  };
  const sealed = sealSessionPayload(payload, secret, {
    maxAgeSeconds: WORKFLOW_SESSION_MAX_AGE_SECONDS,
  });
  const valueBytes = Buffer.byteLength(sealed, "utf8");
  if (valueBytes > MAX_WORKFLOW_COOKIE_VALUE_BYTES) {
    throw new WorkflowCookieBudgetError();
  }
  return sealed;
}

export function openWorkflowState(
  sealed: string,
  secret = workflowSessionSecret(),
): StoredSecondaryWorkflowState | null {
  try {
    const opened = openSessionPayload(sealed, secret);
    if (!opened || typeof opened !== "object") return null;
    const candidate = opened as Record<string, unknown>;

    // New-format cookies carry the versioned catalog fingerprint; decode the
    // compact condition references and fall back to legacy string-ID cookies.
    // decodeWorkflowState reads only the compact keys and fails closed on a
    // fingerprint mismatch or out-of-range index.
    if ("fp" in candidate && "v" in candidate) {
      return normalizeEncoded(candidate);
    }

    return parseStoredSecondaryWorkflowState(opened);
  } catch {
    return null;
  }
}

export async function readSecondaryWorkflowSession(): Promise<StoredSecondaryWorkflowState> {
  const jar = await cookies();
  const raw = jar.get(WORKFLOW_COOKIE)?.value;
  if (!raw) return {};
  return openWorkflowState(raw) ?? {};
}

export async function writeSecondaryWorkflowSession(
  state: StoredSecondaryWorkflowState,
): Promise<void> {
  const sealed = sealWorkflowState(state);
  const jar = await cookies();
  jar.set(WORKFLOW_COOKIE, sealed, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/secondary",
    maxAge: WORKFLOW_SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSecondaryWorkflowSession(): Promise<void> {
  const jar = await cookies();
  jar.delete({ name: WORKFLOW_COOKIE, path: "/secondary" });
}

export function workflowSessionToQueryParams(
  state: StoredSecondaryWorkflowState,
): QueryParams {
  const params: QueryParams = {};

  if (state.diagnosedConditionIds?.length) params.diagnosed = [...state.diagnosedConditionIds];
  if (state.serviceConnectedConditionIds?.length) {
    params.serviceConnected = [...state.serviceConnectedConditionIds];
  }

  if (state.ratingsByConditionId && state.serviceConnectedConditionIds) {
    for (const id of state.serviceConnectedConditionIds) {
      const value = state.ratingsByConditionId[id];
      if (value === undefined) continue;
      params[ratingFieldName(id)] = value === null ? "decline" : String(value);
    }
  }

  if (typeof state.documentsShared === "boolean") {
    params.documentsShared = state.documentsShared ? "yes" : "no";
  }
  if (state.medications?.length) params.medications = [...state.medications];
  if (state.treatments?.length) params.treatments = [...state.treatments];
  if (state.history?.length) params.history = [...state.history];
  if (state.symptomIds?.length) params.symptomIds = [...state.symptomIds];
  if (state.conditionTimeline) {
    for (const [id, timeline] of Object.entries(state.conditionTimeline)) {
      if (timeline.onsetYear !== undefined) params[`onsetYear-${id}`] = String(timeline.onsetYear);
      if (timeline.diagnosisYear !== undefined) params[`diagnosisYear-${id}`] = String(timeline.diagnosisYear);
    }
  }

  return params;
}

export function toCompleteWorkflowState(
  state: StoredSecondaryWorkflowState,
): SecondaryWorkflowState | null {
  if (
    !state.diagnosedConditionIds ||
    !state.serviceConnectedConditionIds ||
    !state.ratingsByConditionId ||
    typeof state.documentsShared !== "boolean"
  ) {
    return null;
  }

  return {
    diagnosedConditionIds: [...state.diagnosedConditionIds],
    serviceConnectedConditionIds: [...state.serviceConnectedConditionIds],
    ratingsByConditionId: { ...state.ratingsByConditionId },
    documentsShared: state.documentsShared,
    medications: [...(state.medications ?? [])],
    treatments: [...(state.treatments ?? [])],
    history: [...(state.history ?? [])],
    symptomIds: [...(state.symptomIds ?? [])],
    conditionTimeline: Object.fromEntries(
      Object.entries(state.conditionTimeline ?? {}).map(([id, timeline]) => [id, { ...timeline }]),
    ),
  };
}
