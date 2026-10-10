import "server-only";

import { z } from "zod";

import { ACCOUNT_HTTP_TIMEOUT_MS, type VaAccountConfig } from "./account/config";
import { readAccountSession } from "./account/oauth";
import { boundedAccountJson, type AccountStore } from "./account/store";
import { accountTransport } from "./account/transport";
import { parseRetryAfterMs } from "./circuit-breaker";

/**
 * The one place a VA platform request is made with a stored veteran session.
 *
 * Before this module there was no request wrapper at all: `account/oauth.ts`
 * owns the session lifecycle (login, refresh, revoke) and `account/data.ts`
 * owns the two read shapes, but nothing that *calls* the platform with the
 * session's access token. Two things follow from having exactly one:
 *
 *   1. **The token goes to one host and nowhere else.** The token is a bearer
 *      credential for the VA origin; a wrapper that follows a caller-supplied
 *      URL would hand that credential to whatever host the argument names, so
 *      the URL is resolved against the configured platform origin and refused
 *      before the token is attached.
 *   2. **A 401 is a refresh, not a retry loop.** The platform can reject a
 *      token our clock still considers fresh (revocation, a rotated
 *      generation, clock skew). That is what `force: true` on
 *      `readAccountSession` is for: it re-enters the existing
 *      compare-and-swap refresh — the only place a refresh may happen — and
 *      the request is replayed exactly once. A second 401 is the answer.
 *
 * Failure is a value, not an exception: callers get `ok: false` with a stable
 * reason, so a platform outage cannot be mistaken for data, and no response
 * body, token, or upstream error text is logged or echoed.
 */

/**
 * Outcome of one platform call. `status: null` means nothing came back at all.
 * `retryAfterMs` carries the platform's own `Retry-After` when it sent one, so
 * a caller can honour a 429 without re-reading a response this module already
 * consumed.
 */
export type VaApiOutcome<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; reason: "unauthorized" | "unavailable"; status: number | null; retryAfterMs?: number };

/**
 * Cap on one response body. The read APIs this serves return small JSON
 * summaries; a larger body is a symptom, not data, and is abandoned unread.
 */
const MAX_RESPONSE_BYTES = 256 * 1024;

function vaOrigin(config: VaAccountConfig): string {
  return new URL(config.apiUrl).origin;
}

/**
 * True only for a path on the configured platform origin.
 *
 * Same-origin is the property that matters: it is what stops the bearer token
 * from being attached to a request to anywhere else. Loopback stays allowed so
 * a local stand-in for the platform can be exercised; the store already
 * refuses to exist off loopback, so this cannot widen a hosted deployment.
 */
export function isVaPlatformUrl(config: VaAccountConfig, url: string): boolean {
  try {
    const parsed = new URL(url, config.apiUrl);
    if (parsed.origin !== vaOrigin(config)) return false;
    if (parsed.protocol === "https:") return true;
    return ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

interface Attempt {
  status: number;
  /** Parsed body for a successful status; `null` for any error status. */
  body: unknown;
  retryAfterMs?: number;
}

/**
 * One credentialled GET. The abort timer is cleared only after the body has
 * been read, so the deadline covers the whole exchange rather than just the
 * response headers; an error status is never read, because an upstream error
 * body is not ours to surface.
 */
async function attempt(
  config: VaAccountConfig,
  accessToken: string,
  url: string,
  timeoutMs: number,
): Promise<Attempt | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // A plain GET by default: this wrapper offers no method or body option, so
    // it cannot be talked into a write against the platform with this token.
    const response = await accountTransport(config)(new URL(url, config.apiUrl), {
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after")) ?? undefined;
      return { status: response.status, body: null, retryAfterMs };
    }
    return { status: response.status, body: await boundedAccountJson(response, MAX_RESPONSE_BYTES) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calls the platform with the session's access token, refreshing once on 401.
 *
 * @param schema Validates the payload before it is typed as `T`; a shape the
 * caller did not expect is `unavailable` rather than a cast.
 */
export async function callVaApi<T>(
  config: VaAccountConfig,
  store: AccountStore,
  handle: string,
  url: string,
  schema: z.ZodType<T>,
  options: { timeoutMs?: number } = {},
): Promise<VaApiOutcome<T>> {
  if (!isVaPlatformUrl(config, url)) return { ok: false, reason: "unavailable", status: null };
  const timeoutMs = options.timeoutMs ?? ACCOUNT_HTTP_TIMEOUT_MS;

  try {
    const session = await readAccountSession(config, store, handle);
    if (!session) return { ok: false, reason: "unauthorized", status: null };

    let result = await attempt(config, session.accessToken, url, timeoutMs);
    if (result?.status === 401) {
      // Exactly one refresh-and-replay. When the refresh cannot complete,
      // readAccountSession has already invalidated this generation, so the
      // session is gone by the time the caller sees `unauthorized`.
      const renewed = await readAccountSession(config, store, handle, { force: true });
      if (!renewed) return { ok: false, reason: "unauthorized", status: 401 };
      result = await attempt(config, renewed.accessToken, url, timeoutMs);
      if (result?.status === 401) return { ok: false, reason: "unauthorized", status: 401 };
    }

    if (!result) return { ok: false, reason: "unavailable", status: null };
    if (!result.body || result.status !== 200) {
      return { ok: false, reason: "unavailable", status: result.status, retryAfterMs: result.retryAfterMs };
    }
    const parsed = schema.safeParse(result.body);
    if (!parsed.success) return { ok: false, reason: "unavailable", status: result.status };
    return { ok: true, status: result.status, data: parsed.data };
  } catch {
    // A store or transport failure is a failure to serve, never data.
    return { ok: false, reason: "unavailable", status: null };
  }
}
