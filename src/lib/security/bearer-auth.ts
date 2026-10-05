import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time Bearer-token authorization for operator endpoints.
 *
 * Fail-closed contract:
 * - No configured secret → unauthorized (never a bare/empty token match).
 * - Short secrets are rejected: a shared secret below 32 characters is not an
 *   acceptable operator credential, so a weak deployment value cannot
 *   silently authorize.
 * - The `Bearer ` scheme is required; a raw token without it is not accepted.
 * - Comparison is length-checked then constant-time.
 */
export const MIN_BEARER_SECRET_LENGTH = 32;

export function authorizeBearerRequest(
  request: Request,
  secret: string | undefined,
): boolean {
  if (!secret || secret.length < MIN_BEARER_SECRET_LENGTH) return false;

  const header = request.headers.get("authorization");
  if (!header || !/^Bearer\s+/i.test(header)) return false;

  const supplied = header.replace(/^Bearer\s+/i, "").trim();
  if (supplied.length === 0) return false;

  const left = Buffer.from(secret, "utf8");
  const right = Buffer.from(supplied, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}
