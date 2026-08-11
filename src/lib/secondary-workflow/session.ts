import { cookies } from "next/headers";
import { z } from "zod";

import {
  ratingFieldName,
  type QueryParams,
  type SecondaryWorkflowState,
} from "./state";

const WORKFLOW_COOKIE = "secondary-workflow-v1";
const WORKFLOW_MAX_AGE_SECONDS = 30 * 60;

const storedWorkflowStateSchema = z.object({
  diagnosedConditionIds: z.array(z.string().min(1)).optional(),
  serviceConnectedConditionIds: z.array(z.string().min(1)).optional(),
  ratingsByConditionId: z.record(z.string(), z.number().int().min(0).max(100).nullable()).optional(),
  documentsShared: z.boolean().optional(),
});

export type StoredSecondaryWorkflowState = z.infer<typeof storedWorkflowStateSchema>;

function encodeState(state: StoredSecondaryWorkflowState): string {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

function decodeState(raw: string): StoredSecondaryWorkflowState | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    return storedWorkflowStateSchema.parse(JSON.parse(json));
  } catch {
    return null;
  }
}

export async function readSecondaryWorkflowSession(): Promise<StoredSecondaryWorkflowState> {
  const jar = await cookies();
  const raw = jar.get(WORKFLOW_COOKIE)?.value;
  if (!raw) return {};

  return decodeState(raw) ?? {};
}

export async function writeSecondaryWorkflowSession(
  state: StoredSecondaryWorkflowState,
): Promise<void> {
  const jar = await cookies();
  jar.set(WORKFLOW_COOKIE, encodeState(state), {
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
