import { describe, expect, it } from "vitest";

import {
  authorizeBearerRequest,
  MIN_BEARER_SECRET_LENGTH,
} from "@/lib/security/bearer-auth";

/**
 * Contracts for the operator bearer-token gate used by /api/admin/cache-clear
 * and /api/regulatory/preflight. The previous inline comparison accepted a
 * bare token without the `Bearer ` scheme and never enforced the documented
 * minimum secret length, so a weak or misconfigured deployment value could
 * silently authorize.
 */

const STRONG_SECRET = "a".repeat(48);

function requestWith(header?: string): Request {
  return new Request("https://example.test/api/admin/cache-clear", {
    method: "POST",
    headers: header ? { authorization: header } : {},
  });
}

describe("authorizeBearerRequest", () => {
  it("accepts the exact configured secret with the Bearer scheme", () => {
    expect(
      authorizeBearerRequest(requestWith(`Bearer ${STRONG_SECRET}`), STRONG_SECRET),
    ).toBe(true);
  });

  it("accepts a case-insensitive Bearer scheme", () => {
    expect(
      authorizeBearerRequest(requestWith(`bearer ${STRONG_SECRET}`), STRONG_SECRET),
    ).toBe(true);
  });

  it("fails closed when no secret is configured", () => {
    expect(authorizeBearerRequest(requestWith(`Bearer ${STRONG_SECRET}`), undefined)).toBe(
      false,
    );
    expect(authorizeBearerRequest(requestWith(`Bearer ${STRONG_SECRET}`), "")).toBe(false);
  });

  it("rejects a configured secret below the minimum length", () => {
    const short = "a".repeat(MIN_BEARER_SECRET_LENGTH - 1);
    expect(authorizeBearerRequest(requestWith(`Bearer ${short}`), short)).toBe(false);
    expect(MIN_BEARER_SECRET_LENGTH).toBeGreaterThanOrEqual(32);
  });

  it("requires the Bearer scheme — a bare token is not accepted", () => {
    expect(authorizeBearerRequest(requestWith(STRONG_SECRET), STRONG_SECRET)).toBe(false);
  });

  it("rejects missing, empty, and mismatched credentials", () => {
    expect(authorizeBearerRequest(requestWith(), STRONG_SECRET)).toBe(false);
    expect(authorizeBearerRequest(requestWith("Bearer "), STRONG_SECRET)).toBe(false);
    expect(
      authorizeBearerRequest(requestWith(`Bearer ${"b".repeat(48)}`), STRONG_SECRET),
    ).toBe(false);
    // Different lengths must not throw out of the constant-time comparison.
    expect(authorizeBearerRequest(requestWith("Bearer short"), STRONG_SECRET)).toBe(false);
  });
});
