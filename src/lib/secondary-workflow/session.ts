import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { cookies } from "next/headers";
import { z } from "zod";

import {
  ratingFieldName,
  type QueryParams,
  type SecondaryWorkflowState,
} from "./state";

const WORKFLOW_COOKIE = "secondary-workflow-v2";
const WORKFLOW_MAX_AGE_SECONDS = 30 * 60;
const COOKIE_VERSION = "v1";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const MIN_SECRET_LENGTH = 32;
const DEVELOPMENT_ONLY_SECRET =
  "development-only-secondary-workflow-session-secret-not-for-production";

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

function sessionSecret(): string {
  const configured = process.env.SECONDARY_WORKFLOW_SESSION_SECRET;
  if (configured && configured.length >= MIN_SECRET_LENGTH) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `SECONDARY_WORKFLOW_SESSION_SECRET must be configured with at least ${MIN_SECRET_LENGTH} characters in production.`,
    );
  }

  return DEVELOPMENT_ONLY_SECRET;
}

function encryptionKey(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

export function sealWorkflowState(
  state: StoredSecondaryWorkflowState,
  secret = sessionSecret(),
): string {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `Workflow session secret must contain at least ${MIN_SECRET_LENGTH} characters.`,
    );
  }

  const validated = storedWorkflowStateSchema.parse(state);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  cipher.setAAD(Buffer.from(COOKIE_VERSION, "utf8"));

  const plaintext = Buffer.from(JSON.stringify(validated), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    COOKIE_VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

export function openWorkflowState(
  sealed: string,
  secret = sessionSecret(),
): StoredSecondaryWorkflowState | null {
  try {
    if (secret.length < MIN_SECRET_LENGTH) return null;

    const [version, ivValue, ciphertextValue, tagValue, extra] =
      sealed.split(".");
    if (
      version !== COOKIE_VERSION ||
      !ivValue ||
      !ciphertextValue ||
      !tagValue ||
      extra !== undefined
    ) {
      return null;
    }

    const iv = Buffer.from(ivValue, "base64url");
    const ciphertext = Buffer.from(ciphertextValue, "base64url");
    const tag = Buffer.from(tagValue, "base64url");
    if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES) return null;

    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(secret),
      iv,
      { authTagLength: AUTH_TAG_BYTES },
    );
    decipher.setAAD(Buffer.from(COOKIE_VERSION, "utf8"));
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");

    return storedWorkflowStateSchema.parse(JSON.parse(plaintext));
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
