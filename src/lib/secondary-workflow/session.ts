import { cookies } from "next/headers";
import { z } from "zod";

import {
  openSessionPayload,
  sealSessionPayload,
  WORKFLOW_SESSION_MAX_AGE_SECONDS,
  workflowSessionSecret,
} from "@/lib/workflow-session-crypto";
import {
  MAX_CONTEXT_ITEM_LENGTH,
  MAX_CONTEXT_ITEMS,
  ratingFieldName,
  type QueryParams,
  type SecondaryWorkflowState,
} from "./state";

const WORKFLOW_COOKIE = "secondary-workflow-v2";
export const MAX_WORKFLOW_COOKIE_VALUE_BYTES = 3800;
const contextEntrySchema = z.string().min(1).max(MAX_CONTEXT_ITEM_LENGTH);

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
});

export type StoredSecondaryWorkflowState = z.infer<
  typeof storedWorkflowStateSchema
>;

export function parseStoredSecondaryWorkflowState(
  value: unknown,
): StoredSecondaryWorkflowState {
  return storedWorkflowStateSchema.parse(value);
}

export function sealWorkflowState(
  state: StoredSecondaryWorkflowState,
  secret = workflowSessionSecret(),
): string {
  const sealed = sealSessionPayload(
    parseStoredSecondaryWorkflowState(state),
    secret,
    { maxAgeSeconds: WORKFLOW_SESSION_MAX_AGE_SECONDS },
  );
  const valueBytes = Buffer.byteLength(sealed, "utf8");
  if (valueBytes > MAX_WORKFLOW_COOKIE_VALUE_BYTES) {
    throw new Error(
      `Secondary workflow state exceeds the safe cookie value budget of ${MAX_WORKFLOW_COOKIE_VALUE_BYTES} bytes. Reduce selected workflow context and try again.`,
    );
  }
  return sealed;
}

export function openWorkflowState(
  sealed: string,
  secret = workflowSessionSecret(),
): StoredSecondaryWorkflowState | null {
  try {
    return parseStoredSecondaryWorkflowState(openSessionPayload(sealed, secret));
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
  const jar = await cookies();
  jar.set(WORKFLOW_COOKIE, sealWorkflowState(state), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/secondary",
    maxAge: WORKFLOW_SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSecondaryWorkflowSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(WORKFLOW_COOKIE);
}

export function workflowSessionToQueryParams(
  state: StoredSecondaryWorkflowState,
): QueryParams {
  const params: QueryParams = {};

  if (state.diagnosedConditionIds?.length) {
    params.diagnosed = [...state.diagnosedConditionIds];
  }

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
  };
}
