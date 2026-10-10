import "server-only";

import { exportJWK, generateKeyPair, SignJWT } from "jose";

import { isDistributedRuntime } from "@/lib/runtime-deployment";

import { type AccountEnv, type VaAccountConfig } from "./config";

/**
 * Demo fixtures for the sandbox authenticated account flow.
 *
 * The VA review needs a demonstration that runs without a real Veteran record
 * and without a live sandbox registration, and it needs failure paths on demand
 * — you cannot ask the real sandbox to return `503` at a chosen moment. This
 * module supplies both at the **network boundary** rather than behind a product
 * URL.
 *
 * Why a transport seam and not a mock endpoint:
 *
 *   1. **No route ever serves veteran-shaped data.** `va/account/data.ts`
 *      returns `unavailable` rather than substituting account data, and a test
 *      names that rule ("no fallback veteran data"). A `/api/mock/...` route
 *      returning a synthetic Veteran would sit against it, and would be the one
 *      artifact a reviewer could reasonably read as the application inventing
 *      benefits data. Nothing here is reachable over HTTP.
 *   2. **The real machinery still runs.** The demo drives the actual `/va-account`
 *      UI: real S256 PKCE, the real single-use transaction, real cookie and CSRF
 *      handling, the real session store, real revocation. Only the VA provider's
 *      responses are synthetic, so the demo proves the flow rather than a
 *      parallel implementation of it.
 *   3. **Signature verification is not bypassed.** The fixture mints an RS256
 *      `id_token` and serves a matching JWKS, so `verifyIdentity` performs a
 *      genuine issuer/audience/nonce/signature check against it. A fixture that
 *      merely skipped verification would demonstrate nothing about the code that
 *      runs against VA.
 *
 * This module only *answers* requests. The outbound call belongs to
 * `transport.ts`, which owns the account flow's single reviewed egress point and
 * consults this module first; adding a second module that reaches the network
 * would have made the egress inventory in `tests/phi-logging-boundary.test.ts`
 * describe a flow it no longer matched.
 *
 * The gate is the shared runtime *fact* — never a private `NODE_ENV` comparison
 * — so this cannot disagree with the store and cache about what "distributed"
 * means, and a hosted or production runtime refuses regardless of the opt-in.
 *
 * The synthetic payloads reproduce the documented response *shape* only. They
 * deliberately carry no diagnosis text: the rating-summary schema has no field
 * for it, unknown keys are stripped, and the account tests pin that identity and
 * diagnosis fields never survive a read. The three rating records the demo shows
 * are therefore three service-connected *rating* entries, not three named
 * conditions; the presenter names them from this file's scenario table.
 */

/**
 * The synthetic subject every demo session is bound to.
 *
 * A refresh pins `sub` (see `verifyIdentity`'s `subject` argument), so this must
 * be stable across the token and refresh responses rather than random.
 */
export const ACCOUNT_DEMO_SUBJECT = "va-account-demo-subject";

/** Key id advertised in the demo JWKS and carried by the minted `id_token`. */
export const ACCOUNT_DEMO_KEY_ID = "va-account-demo-key";

/** Opt-in flag. Absent or any other value keeps the real transport. */
export const ACCOUNT_DEMO_FLAG = "VA_ACCOUNT_DEMO_FIXTURES";

/**
 * Injectable upstream fault. Chosen by the presenter to script the failure
 * demonstrations, because a live sandbox will not fail on request.
 *
 *   - `timeout`         — the request never completes; the transport's own
 *                         deadline aborts it.
 *   - `503`             — provider outage; the read reports `unavailable` and
 *                         substitutes nothing.
 *   - `429`             — rate limit carrying a real `Retry-After`; the account
 *                         path stores the cooldown and reports `rate-limited`.
 *   - `invalid-payload` — a well-formed HTTP 200 whose body fails the service
 *                         schema, proving validation rather than trust.
 *   - `401`             — one refresh and exactly one replay with the token the
 *                         refresh minted, then `disconnected`.
 */
export const ACCOUNT_DEMO_FAULTS = [
  "none",
  "timeout",
  "503",
  "429",
  "invalid-payload",
  "401",
] as const;
export type AccountDemoFault = (typeof ACCOUNT_DEMO_FAULTS)[number];

/** Any unrecognized value means "no injected fault" rather than an open field. */
export function parseAccountDemoFault(value: string | undefined): AccountDemoFault {
  return ACCOUNT_DEMO_FAULTS.find((fault) => fault === value) ?? "none";
}

/**
 * Whether the synthetic provider may serve this process.
 *
 * Requires the explicit opt-in and refuses any runtime the shared fact calls
 * distributed (which includes `NODE_ENV=production` and every hosting marker).
 * A loopback-only requirement is not added here because the session store
 * already enforces it for the local-only regime, and coupling the two would
 * refuse a shared-store rehearsal that leaks nothing (the data is synthetic).
 */
export function accountDemoFixturesEnabled(env: AccountEnv = process.env): boolean {
  if (env[ACCOUNT_DEMO_FLAG] !== "true") return false;
  return !isDistributedRuntime(env);
}

/* ─── Nonce bridge ────────────────────────────────────────────────────────
 *
 * A real provider learns the `nonce` from the authorization request it
 * receives. This fixture cannot: `startAccountLogin` builds that URL locally and
 * navigates the browser to it, so no fetch ever carries it. The transaction
 * nonce is therefore handed over explicitly at the moment it is created, and the
 * token endpoint reads it back.
 *
 * This is the only piece of demo state that outlives one request, it is keyed by
 * the configuration fingerprint, and it is written only when the gate is open.
 */

const pendingNonces = new Map<string, string>();

/** Called by `startAccountLogin`; a no-op unless the fixture gate is open. */
export function rememberDemoNonce(
  config: VaAccountConfig,
  nonce: string,
  env: AccountEnv = process.env,
): void {
  if (!accountDemoFixturesEnabled(env)) return;
  pendingNonces.set(config.fingerprint, nonce);
}

/** Test seam: drop remembered nonces so suites cannot leak into each other. */
export function clearAccountDemoState(): void {
  pendingNonces.clear();
  demoKeyMaterial = null;
}

/* ─── Synthetic provider ───────────────────────────────────────────────── */

let demoKeyMaterial: Promise<{
  privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
  jwks: { keys: Record<string, unknown>[] };
}> | null = null;

/** One RS256 key pair per process, reused so the JWKS and the token agree. */
function demoKeys() {
  demoKeyMaterial ??= (async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
    const jwk = await exportJWK(publicKey);
    return {
      privateKey,
      jwks: { keys: [{ ...jwk, kid: ACCOUNT_DEMO_KEY_ID, alg: "RS256", use: "sig" }] },
    };
  })();
  return demoKeyMaterial;
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function abortError(): Error {
  const error = new Error("The demo fixture never responds");
  error.name = "AbortError";
  return error;
}

/**
 * Honour the caller's deadline instead of hanging the request.
 *
 * The transport that called us sets its own `AbortController`, so a promise that
 * only settles on abort reproduces a real timeout through the real timeout path.
 */
function neverResponds(signal: AbortSignal | null | undefined): Promise<never> {
  return new Promise((_resolve, reject) => {
    if (!signal) return;
    if (signal.aborted) return reject(abortError());
    signal.addEventListener("abort", () => reject(abortError()), { once: true });
  });
}

async function tokenResponse(
  config: VaAccountConfig,
  fault: AccountDemoFault,
  grant: string,
): Promise<Response> {
  const { privateKey } = await demoKeys();
  const nonce = grant === "refresh_token" ? undefined : pendingNonces.get(config.fingerprint);
  const claims: Record<string, unknown> = { sub: ACCOUNT_DEMO_SUBJECT };
  if (nonce !== undefined) claims.nonce = nonce;
  const idToken = await new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: ACCOUNT_DEMO_KEY_ID })
    .setIssuer(config.issuer)
    .setAudience(config.clientId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);

  // A distinct token per grant, so a caller can tell a rotation from a replay in
  // one assertion. Obviously synthetic values, too: a screenshot cannot be
  // mistaken for a real credential and no reader has to guess whether it is live.
  const rotated = grant === "refresh_token";
  return jsonResponse({
    access_token: rotated ? "va-account-demo-access-token-rotated" : "va-account-demo-access-token",
    refresh_token: rotated ? "va-account-demo-refresh-token-rotated" : "va-account-demo-refresh-token",
    token_type: "Bearer",
    expires_in: 300,
    // `postTokens` refuses a response that omits the service scope, omits
    // `openid`, or carries any `.write` scope. A demo token is read-only too.
    scope: `openid offline_access ${config.scope}`,
    id_token: idToken,
  });
}

/** Three service-connected rating records — the shape, not a diagnosis list. */
function ratingFixture(fault: AccountDemoFault): unknown {
  if (fault === "invalid-payload") {
    // A 200 that must be rejected: the rating cap is 100.
    return { data: { attributes: { combined_disability_rating: 101 } } };
  }
  return {
    data: {
      attributes: {
        combined_disability_rating: 70,
        combined_effective_date: "2019-06-11",
        legal_effective_date: "2019-06-11",
        individual_ratings: [
          { decision: "Service Connected", rating_percentage: 10, effective_date: "2019-06-11" },
          { decision: "Service Connected", rating_percentage: 50, effective_date: "2020-02-18" },
          { decision: "Service Connected", rating_percentage: 10, effective_date: "2021-09-07" },
        ],
      },
    },
  };
}

/** Three existing claim statuses, spanning the documented status vocabulary. */
function claimsFixture(fault: AccountDemoFault): unknown {
  if (fault === "invalid-payload") {
    return { data: [{ attributes: { claim_type: "Compensation", date_filed: "2020-01-01", status: "invented", open: true } }] };
  }
  return {
    data: [
      { attributes: { claim_type: "Compensation", date_filed: "2020-03-04", status: "Complete", open: false } },
      { attributes: { claim_type: "Compensation", date_filed: "2023-11-16", status: "Evidence gathering, review, and decision", open: true } },
      { attributes: { claim_type: "Dependency", date_filed: "2025-01-09", status: "Initial review", open: true } },
    ],
  };
}

async function apiResponse(
  config: VaAccountConfig,
  fault: AccountDemoFault,
  signal: AbortSignal | null | undefined,
): Promise<Response> {
  if (fault === "timeout") return neverResponds(signal);
  if (fault === "503") return new Response(null, { status: 503 });
  // A rate limit the account path can honour: the header is real, and the
  // resulting cooldown comes from `loadAccountData`, not from the fixture.
  if (fault === "429") return new Response(null, { status: 429, headers: { "Retry-After": "60" } });
  if (fault === "401") return jsonResponse({ detail: "expired" }, 401);

  return jsonResponse(config.service === "ratings" ? ratingFixture(fault) : claimsFixture(fault));
}

/**
 * The synthetic answer for one request, or `null` when this process should reach
 * the network instead — the gate is closed, or the URL is not one of the four
 * configured VA endpoints.
 *
 * Matching is by exact configured URL rather than by origin, so the session
 * store's own host is never intercepted: these fixtures replace VA, not the
 * application's infrastructure.
 *
 * Returning `null` rather than falling through to `fetch` is deliberate. The
 * caller (`transport.ts`) owns the single outbound call, and this module holds no
 * egress at all — which is what keeps the reviewed egress inventory honest.
 */
export async function accountDemoFixtureResponse(
  config: VaAccountConfig,
  env: AccountEnv,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response | null> {
  if (!accountDemoFixturesEnabled(env)) return null;
  const fault = parseAccountDemoFault(env.VA_ACCOUNT_DEMO_FAULT);
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  if (url === config.keysUrl) {
    const { jwks } = await demoKeys();
    return jsonResponse(jwks);
  }
  if (url === config.tokenUrl) {
    const grant = new URLSearchParams(
      init?.body instanceof URLSearchParams ? init.body.toString() : "",
    ).get("grant_type");
    return tokenResponse(config, fault, grant ?? "");
  }
  if (url === config.revocationUrl) {
    // Revocation succeeding is what the demo must show, so the fixture answers
    // it. The `revocation-unconfirmed` path is exercised by pointing the store
    // of record at nothing rather than by breaking this response.
    return new Response(null, { status: 200 });
  }
  if (url === config.apiUrl) return apiResponse(config, fault, init?.signal);

  return null;
}
