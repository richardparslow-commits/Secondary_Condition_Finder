import { cookies } from "next/headers";
import { z } from "zod";

import {
  openSessionPayload,
  sealSessionPayload,
  workflowSessionSecret,
} from "@/lib/workflow-session-crypto";
import {
  ratingFieldName,
  type QueryParams,
  type SecondaryWorkflowState,
} from "./state";

const WORKFLOW_COOKIE = "secondary-workflow-v2";
const WORKFLOW_MAX_AGE_SECONDS = 30 * 60;

const storedWorkflowStateSchema = z.object({
  diagnosedConditionIds: z.array(z.string().min(1)).optional(),
  serviceConnectedConditionIds: z.array(z.string().min(1)).optional(),
  ratingsByConditionId: z
    .record(z.string(), z.number().int().min(0).max(100).nullable())
    .optional(),
  documentsShared: z.boolean().optional(),
});

export type StoredSecondaryWorkflowState = z.infer<
  typeof storedWorkflowStateSchema
>;

export function sealWorkflowState(
  state: StoredSecondaryWorkflowState,
  secret = workflowSessionSecret(),
): string {
  return sealSessionPayload(storedWorkflowStateSchema.parse(state), secret);
}

export function openWorkflowState(
  sealed: string,
  secret = workflowSessionSecret(),
): StoredSecondaryWorkflowState | null {
  try {
    return storedWorkflowStateSchema.parse(openSessionPayload(sealed, secret));
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
    maxAge: WORKFLOW_MAX_AGE_SECONDS,
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
  };
}
