import "server-only";

import { z } from "zod";

import { parseRetryAfterMs } from "./circuit-breaker";

/**
 * Authenticated HTTP client for the restricted VA Lighthouse APIs
 * (Benefits Claims, Intake) using the Authorization Code Grant with PKCE.
 *
 * Two interceptors, one wrapper:
 *
 *   1. **401 — single-flight refresh-and-replay.** When the platform rejects
 *      the access token, in-flight and newly arriving requests do not each
 *      fire their own refresh. They attach to one shared refresh promise
 *      (see `refreshInFlight` and the state machine below), and the original
 *      request is replayed exactly once with the new bearer token. A second
 *      401 is the answer, not a loop.
 *   2. **429/503 — honour-and-backoff.** A `Retry-After` instruction is
 *      waited out exactly (capped by `MAX_RETRY_AFTER_WAIT_MS` so one header
 *      cannot park a server request indefinitely); without one, attempts wait
 *      `2^n` seconds with bounded additive jitter, up to `MAX_RETRIES`.
 *
 * Deliberate divergence from `api.ts`, documented so the next reader does not
 * "unify" them: the public-reference policy retries a 429 in-request only
 * when the instruction fits under one second and otherwise falls back
 * immediately, because a terminology lookup has a labelled local fallback.
 * A claim or intake submission has no fallback — answering without the
 * platform would be fabrication — so this client waits and completes instead.
 * Every wait here is bounded, and the outcome still reports `rate_limited`
 * instead of hanging when the budget is spent.
 *
 * Failure is a value, never an exception and never a log line: this module
 * imports no logger and touches no console, so a token, a request body, or an
 * upstream error document cannot reach a sink. Error bodies are cancelled
 * unread; success bodies are read under `MAX_RESPONSE_BYTES` and validated
 * against the caller's schema before they are typed.
 *
 * The single-flight refresh is per-process memory: it deduplicates the burst
 * inside one instance, not across the fleet. Concurrent instances may each
 * perform one refresh for the same generation, which the token endpoint
 * tolerates (refresh-token rotation hands each caller its own next token).
 */

// ---------------------------------------------------------------------------
// Token storage seam.
// ---------------------------------------------------------------------------

/** What the wiring layer persists between requests (cookie, session store). */
export interface VaStoredTokens {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms when `accessToken` stops being sent pre-emptively. */
  accessExpiresAt?: number;
}

/**
 * Persistence the caller provides. The default in-memory implementation below
 * is a wiring placeholder for local development and tests — production must
 * supply a store backed by encrypted cookies or the server session store, and
 * must clear it when this client reports `unauthorized`.
 */
export interface VaTokenStore {
  getStoredTokens(): VaStoredTokens | null | Promise<VaStoredTokens | null>;
  updateStoredTokens(tokens: VaStoredTokens): void | Promise<void>;
}

/** Non-persistent store: keeps tokens only for the process lifetime. */
export function createInMemoryTokenStore(
  initial: VaStoredTokens | null = null,
): VaTokenStore {
  let current = initial;
  return {
    getStoredTokens: () => current,
    updateStoredTokens: (tokens) => {
      current = tokens;
    },
  };
}

// ---------------------------------------------------------------------------
// Wire shapes (validated, never logged or echoed).
// ---------------------------------------------------------------------------

/** The token endpoint's success document. */
const tokenResponseSchema = z.object({
  access_token: z.string().min(1).max(16_384),
  token_type: z.string().refine((value) => value.toLowerCase() === "bearer"),
  expires_in: z.number().int().positive().max(86_400),
  refresh_token: z.string().min(1).max(16_384).optional(),
  scope: z.string().max(4_000).optional(),
});

/** A VA JSON:API error document. Parsed only to confirm shape; discarded. */
const vaErrorDocumentSchema = z.object({
  errors: z
    .array(
      z.object({
        status: z.string().max(8).optional(),
        title: z.string().max(256).optional(),
        detail: z.string().max(1_000).optional(),
      }),
    )
    .max(25)
    .optional(),
});

// ---------------------------------------------------------------------------
// Policy constants.
// ---------------------------------------------------------------------------

/** Sandbox token endpoint for the ACG-with-PKCE token exchange. */
export const VA_SANDBOX_TOKEN_URL = "https://sandbox-api.va.gov/oauth2/v0/token";
/** Sandbox origin for the restricted APIs; request paths resolve under it. */
export const VA_SANDBOX_API_ORIGIN = "https://sandbox-api.va.gov";
/** Retries after the first attempt; total attempts are this value plus one. */
export const VA_CLIENT_MAX_RETRIES = 4;
/** First backoff step; attempt n waits `BASE * 2^n` (1s, 2s, 4s, 8s). */
export const VA_CLIENT_BACKOFF_BASE_MS = 1_000;
/** Ceiling on one exponential step, before jitter. */
export const VA_CLIENT_BACKOFF_CAP_MS = 8_000;
/** Fraction of the step added as jitter; never subtracted, so no step is zero. */
export const VA_CLIENT_BACKOFF_JITTER_RATIO = 0.25;
/**
 * Longest a single `Retry-After` instruction is waited out in-request. Past
 * this the request stops retrying and reports `rate_limited` instead of
 * holding a server request open for a minute-plus upstream window.
 */
export const VA_CLIENT_MAX_RETRY_AFTER_WAIT_MS = 30_000;
/** Per-attempt deadline covering headers and body. */
export const VA_CLIENT_REQUEST_TIMEOUT_MS = 10_000;
/** Cap on one success body; anything larger is abandoned, not data. */
export const VA_CLIENT_MAX_RESPONSE_BYTES = 1_024 * 1_024;
/** Clock-skew margin: a token this close to expiry is refreshed, not sent. */
const ACCESS_TOKEN_SKEW_MS = 30_000;

/** Statuses that wait and replay: rate-limited, or transiently unavailable. */
const RETRYABLE_STATUS = new Set([429, 503]);

// ---------------------------------------------------------------------------
// Outcomes.
// ---------------------------------------------------------------------------

export type VaClientFailureReason =
  | "unauthorized"
  | "rate_limited"
  | "unavailable"
  | "invalid-request";

export type VaApiClientOutcome<T> =
  | { ok: true; status: number; data: T; attempts: number }
  | {
      ok: false;
      reason: VaClientFailureReason;
      status: number | null;
      attempts: number;
    };

export interface VaApiClientConfig {
  /** Pinned platform origin; bearer tokens are never sent anywhere else. */
  apiOrigin?: string;
  /** Token endpoint for the refresh-token grant. */
  tokenUrl?: string;
  /** Public client id issued for the restricted scope. */
  clientId: string;
  store: VaTokenStore;
  timeoutMs?: number;
  maxRetries?: number;
  random?: () => number;
}

export interface VaApiRequest<T> {
  /** Path under `apiOrigin`, e.g. `/services/claims/v1/claims`. */
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON-encodable body for methods that send one. */
  body?: unknown;
  /** Validates the success payload before it is typed as `T`. */
  schema: z.ZodType<T>;
}

// ---------------------------------------------------------------------------
// Refresh state machine.
//
// IDLE --(401 or expiring token; no flight)--> REFRESHING --(tokens stored)--> IDLE (replay)
//                                                \--(exchange failed)--> IDLE (unauthorized)
//
// While REFRESHING, every request — the one that saw the 401 and any that
// arrive mid-flight — awaits the same promise instead of exchanging its own
// refresh. The promise resolves to the new access token or to null, and each
// waiter then decides independently: replay once (401 waiters) or proceed
// (fresh arrivals). A generation check comes first: if the store already
// holds a different access token than the one that was rejected, a sibling
// request refreshed ahead of us and no exchange is needed at all.
// ---------------------------------------------------------------------------

export class VaRestrictedApiClient {
  private readonly apiOrigin: string;
  private readonly tokenUrl: string;
  private readonly clientId: string;
  private readonly store: VaTokenStore;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly random: () => number;
  private refreshInFlight: Promise<string | null> | null = null;

  constructor(config: VaApiClientConfig) {
    this.apiOrigin = config.apiOrigin ?? VA_SANDBOX_API_ORIGIN;
    this.tokenUrl = config.tokenUrl ?? VA_SANDBOX_TOKEN_URL;
    this.clientId = config.clientId;
    this.store = config.store;
    this.timeoutMs = config.timeoutMs ?? VA_CLIENT_REQUEST_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? VA_CLIENT_MAX_RETRIES;
    this.random = config.random ?? Math.random;
  }

  /**
   * One authenticated call with refresh-and-replay plus honour-and-backoff.
   * `attempts` counts every request line sent, including the replay.
   */
  async request<T>(args: VaApiRequest<T>): Promise<VaApiClientOutcome<T>> {
    const url = this.resolveUrl(args.path);
    if (!url) {
      return { ok: false, reason: "invalid-request", status: null, attempts: 0 };
    }

    let attempts = 0;
    let refreshed = false;
    let accessToken = await this.accessToken(false);
    if (!accessToken) {
      return { ok: false, reason: "unauthorized", status: null, attempts };
    }

    for (let retry = 0; ; retry += 1) {
      attempts += 1;
      const response = await this.send(url, args, accessToken);
      if (!response) {
        // Transport failure or timeout: no status, but retryable while the
        // retry budget lasts — a dropped socket is not a refusal.
        if (retry < this.maxRetries) {
          await sleep(backoffDelayMs(retry, this.random));
          continue;
        }
        return { ok: false, reason: "unavailable", status: null, attempts };
      }

      if (response.status === 401 && !refreshed) {
        // Exactly one refresh-and-replay per logical request.
        response.body?.cancel().catch(() => undefined);
        refreshed = true;
        accessToken = await this.accessToken(true, accessToken);
        if (!accessToken) {
          return { ok: false, reason: "unauthorized", status: 401, attempts };
        }
        continue;
      }

      if (RETRYABLE_STATUS.has(response.status) && retry < this.maxRetries) {
        const instructed = response.headers
          ? (parseRetryAfterMs(response.headers.get("retry-after")) ?? undefined)
          : undefined;
        response.body?.cancel().catch(() => undefined);
        const waitMs = retryWaitMs(retry, instructed, this.random);
        if (waitMs === null) {
          return {
            ok: false,
            reason: response.status === 429 ? "rate_limited" : "unavailable",
            status: response.status,
            attempts,
          };
        }
        await sleep(waitMs);
        continue;
      }

      if (response.status >= 200 && response.status < 300) {
        const parsed = await this.readSuccess<T>(response, args.schema);
        if (!parsed) {
          return {
            ok: false,
            reason: "unavailable",
            status: response.status,
            attempts,
          };
        }
        return { ok: true, status: response.status, data: parsed, attempts };
      }

      response.body?.cancel().catch(() => undefined);
      if (response.status === 401 || response.status === 429) {
        return {
          ok: false,
          reason: response.status === 401 ? "unauthorized" : "rate_limited",
          status: response.status,
          attempts,
        };
      }
      return { ok: false, reason: "unavailable", status: response.status, attempts };
    }
  }

  /**
   * Resolve a caller path against the pinned origin. Same-origin is the
   * property that matters: the bearer token is attached only after this
   * check, so a caller-supplied path can never steer the credential to
   * another host, a non-HTTPS URL, or a URL with embedded credentials.
   */
  private resolveUrl(path: string): URL | null {
    try {
      const url = new URL(path, this.apiOrigin);
      if (url.origin !== new URL(this.apiOrigin).origin) return null;
      if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
      if (url.username || url.password) return null;
      return url;
    } catch {
      return null;
    }
  }

  /**
   * A usable access token, refreshing when forced or when the stored one is
   * missing, expiring, or (on `force`) was just rejected. `rejected` carries
   * the token the platform refused so a sibling's newer generation is
   * adopted without a redundant exchange.
   */
  private async accessToken(
    force: boolean,
    rejected?: string,
  ): Promise<string | null> {
    const stored = await this.store.getStoredTokens();
    if (
      !force &&
      stored &&
      (!stored.accessExpiresAt ||
        stored.accessExpiresAt > Date.now() + ACCESS_TOKEN_SKEW_MS)
    ) {
      return stored.accessToken;
    }
    if (
      force &&
      stored &&
      rejected !== undefined &&
      stored.accessToken !== rejected
    ) {
      // A sibling request already rotated the generation while we were in
      // flight; adopt its token instead of burning the refresh grant.
      return stored.accessToken;
    }
    if (!stored?.refreshToken) return null;
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.performRefresh(stored.refreshToken).finally(
        () => {
          this.refreshInFlight = null;
        },
      );
    }
    return this.refreshInFlight;
  }

  /**
   * Exchange one refresh grant for the next generation and persist it. The
   * response is validated before anything is stored; any failure resolves
   * null so every waiter reports `unauthorized` together.
   */
  private async performRefresh(refreshToken: string): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.clientId,
      });
      const response = await fetch(this.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
        redirect: "error",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        response.body?.cancel().catch(() => undefined);
        return null;
      }
      const parsed = tokenResponseSchema.safeParse(
        await readBoundedJson(response, VA_CLIENT_MAX_RESPONSE_BYTES),
      );
      if (!parsed.success) return null;
      const stored: VaStoredTokens = {
        accessToken: parsed.data.access_token,
        refreshToken: parsed.data.refresh_token ?? refreshToken,
        accessExpiresAt: Date.now() + parsed.data.expires_in * 1_000,
      };
      await this.store.updateStoredTokens(stored);
      return stored.accessToken;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** One attempt: the abort deadline covers headers and body together. */
  private async send<T>(
    url: URL,
    args: VaApiRequest<T>,
    accessToken: string,
  ): Promise<{ status: number; headers: Headers; body: ReadableStream | null } | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const init: RequestInit = {
        method: args.method ?? "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        cache: "no-store",
        signal: controller.signal,
      };
      if (args.body !== undefined && init.method !== "GET") {
        (init.headers as Record<string, string>)["Content-Type"] = "application/json";
        init.body = JSON.stringify(args.body);
      }
      const response = await fetch(url, init);
      return {
        status: response.status,
        headers: response.headers,
        body: response.body,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Read, bound, parse, and validate one success payload. An error document
   * that arrives with a 2xx is shape-checked and discarded — a 2xx the
   * caller did not expect is `unavailable`, not data.
   */
  private async readSuccess<T>(
    response: { status: number; body: ReadableStream | null },
    schema: z.ZodType<T>,
  ): Promise<T | null> {
    // Re-wrap the captured stream as a Response to reuse the bounded reader.
    const payload = await readBoundedJson(
      new Response(response.body),
      VA_CLIENT_MAX_RESPONSE_BYTES,
    );
    if (payload === null) return null;
    if (vaErrorDocumentSchema.safeParse(payload).success) {
      const errors = (payload as { errors?: unknown }).errors;
      if (errors !== undefined) return null;
    }
    const parsed = schema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  }
}

/**
 * Backoff math: `delay = min(BASE * 2^retry, CAP) + floor(step * JITTER * r)`.
 * With defaults that is 1s, 2s, 4s, 8s, each stretched up to 25% longer.
 * Jitter is only ever added, so a step can never collapse to zero and a
 * fleet waking from the same 503 does not retry in lockstep.
 */
export function backoffDelayMs(
  retry: number,
  random: () => number = Math.random,
): number {
  const step = Math.min(
    VA_CLIENT_BACKOFF_BASE_MS * 2 ** retry,
    VA_CLIENT_BACKOFF_CAP_MS,
  );
  return step + Math.floor(step * VA_CLIENT_BACKOFF_JITTER_RATIO * random());
}

/**
 * How long to wait before replaying a 429/503. An upstream `Retry-After` is
 * honoured exactly — unless it exceeds `MAX_RETRY_AFTER_WAIT_MS`, in which
 * case the request stops retrying (null) instead of holding the server
 * request open for the whole window. Without an instruction, exponential
 * backoff with jitter applies.
 */
export function retryWaitMs(
  retry: number,
  retryAfterMs: number | undefined,
  random: () => number = Math.random,
): number | null {
  if (retryAfterMs !== undefined) {
    if (!Number.isFinite(retryAfterMs) || retryAfterMs < 0) {
      return backoffDelayMs(retry, random);
    }
    if (retryAfterMs > VA_CLIENT_MAX_RETRY_AFTER_WAIT_MS) return null;
    return retryAfterMs;
  }
  return backoffDelayMs(retry, random);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read a JSON body under a byte cap. Returns null for an empty, oversized,
 * unreadable, or non-JSON body — all of which the caller treats as
 * `unavailable` without ever surfacing upstream bytes.
 */
async function readBoundedJson(
  response: Response,
  maxBytes: number,
): Promise<unknown | null> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
  if (total === 0) return null;
  const text = new TextDecoder().decode(Buffer.concat(chunks));
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
