import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const COOKIE_VERSION = "v1";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
export const MIN_WORKFLOW_SESSION_SECRET_LENGTH = 32;
const DEVELOPMENT_ONLY_SECRET =
  "development-only-workflow-session-secret-not-for-production";

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

  return DEVELOPMENT_ONLY_SECRET;
}

function encryptionKey(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

export function sealSessionPayload(
  payload: unknown,
  secret = workflowSessionSecret(),
): string {
  if (secret.length < MIN_WORKFLOW_SESSION_SECRET_LENGTH) {
    throw new Error(
      `Workflow session secret must contain at least ${MIN_WORKFLOW_SESSION_SECRET_LENGTH} characters.`,
    );
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  cipher.setAAD(Buffer.from(COOKIE_VERSION, "utf8"));

  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
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

    return JSON.parse(plaintext) as unknown;
  } catch {
    return null;
  }
}
