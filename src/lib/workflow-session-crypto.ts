import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const COOKIE_VERSION = "v2";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
export const MIN_WORKFLOW_SESSION_SECRET_LENGTH = 32;
export const WORKFLOW_SESSION_MAX_AGE_SECONDS = 30 * 60;
const DEVELOPMENT_ONLY_SECRET =
  "development-only-workflow-session-secret-not-for-production";

interface SessionEnvelope {
  issuedAt: number;
  expiresAt: number;
  payload: unknown;
}

interface SealSessionOptions {
  nowMs?: number;
  maxAgeSeconds?: number;
}

interface OpenSessionOptions {
  nowMs?: number;
}

export function workflowSessionSecret(): string {
  const configured =
    process.env.WORKFLOW_SESSION_SECRET ??
    process.env.SECONDARY_WORKFLOW_SESSION_SECRET;

  if (
    configured &&
    configured.length >= MIN_WORKFLOW_SESSION_SECRET_LENGTH
  ) {
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `WORKFLOW_SESSION_SECRET must be configured with at least ${MIN_WORKFLOW_SESSION_SECRET_LENGTH} characters in production.`,
    );
  }

  // #9 observability: make non-production fallback explicit in logs
  if (process.env.NODE_ENV !== "test") {
    console.warn("[workflow-session] Using development-only session secret — not for production. Set WORKFLOW_SESSION_SECRET.");
  }

  return DEVELOPMENT_ONLY_SECRET;
}

function encryptionKey(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

function isSessionEnvelope(value: unknown): value is SessionEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<SessionEnvelope>;
  return (
    Number.isSafeInteger(candidate.issuedAt) &&
    Number.isSafeInteger(candidate.expiresAt) &&
    typeof candidate.issuedAt === "number" &&
    typeof candidate.expiresAt === "number" &&
    candidate.issuedAt >= 0 &&
    candidate.expiresAt > candidate.issuedAt &&
    Object.prototype.hasOwnProperty.call(candidate, "payload")
  );
}

export function sealSessionPayload(
  payload: unknown,
  secret = workflowSessionSecret(),
  options: SealSessionOptions = {},
): string {
  if (secret.length < MIN_WORKFLOW_SESSION_SECRET_LENGTH) {
    throw new Error(
      `Workflow session secret must contain at least ${MIN_WORKFLOW_SESSION_SECRET_LENGTH} characters.`,
    );
  }

  const nowMs = options.nowMs ?? Date.now();
  const maxAgeSeconds = options.maxAgeSeconds ?? WORKFLOW_SESSION_MAX_AGE_SECONDS;
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new Error("Workflow session issuance time must be a non-negative integer.");
  }
  if (!Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds <= 0) {
    throw new Error("Workflow session max age must be a positive integer number of seconds.");
  }

  const envelope: SessionEnvelope = {
    issuedAt: nowMs,
    expiresAt: nowMs + maxAgeSeconds * 1000,
    payload,
  };

  if (!Number.isSafeInteger(envelope.expiresAt)) {
    throw new Error("Workflow session expiry exceeds the supported time range.");
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  cipher.setAAD(Buffer.from(COOKIE_VERSION, "utf8"));

  const plaintext = Buffer.from(JSON.stringify(envelope), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    COOKIE_VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

export function openSessionPayload(
  sealed: string,
  secret = workflowSessionSecret(),
  options: OpenSessionOptions = {},
): unknown | null {
  try {
    if (secret.length < MIN_WORKFLOW_SESSION_SECRET_LENGTH) return null;

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
    const envelope = JSON.parse(plaintext) as unknown;
    if (!isSessionEnvelope(envelope)) return null;

    const nowMs = options.nowMs ?? Date.now();
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) return null;
    if (nowMs >= envelope.expiresAt) return null;

    return envelope.payload;
  } catch {
    return null;
  }
}

export function workflowSessionRuntimeReady(): boolean {
  if (process.env.NODE_ENV !== "production") return false;

  const configured = process.env.WORKFLOW_SESSION_SECRET;
  if (
    !configured ||
    configured.length < MIN_WORKFLOW_SESSION_SECRET_LENGTH
  ) {
    return false;
  }

  try {
    const probe = {
      kind: "workflow-session-runtime-readiness",
      version: 2,
    };
    const sealed = sealSessionPayload(probe, configured);
    const opened = openSessionPayload(sealed, configured);

    return (
      typeof opened === "object" &&
      opened !== null &&
      "kind" in opened &&
      opened.kind === probe.kind &&
      "version" in opened &&
      opened.version === probe.version
    );
  } catch {
    return false;
  }
}
