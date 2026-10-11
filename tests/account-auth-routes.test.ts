import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { NextRequest } from "next/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { GET as callbackGET } from "@/app/api/auth/callback/route";
import { GET as loginGET } from "@/app/api/auth/login/route";
import {
  accountCookieName,
  accountTransactionCookieName,
  loadVaAccountConfig,
} from "@/lib/va/account/config";

/**
 * Contracts for the restricted-API auth adapters
 * (`src/app/api/auth/login/route.ts`, `src/app/api/auth/callback/route.ts`).
 *
 * The adapters delegate to the reviewed account flow, so these tests pin the
 * delegation rather than re-proving PKCE: login mints a transaction and
 * redirects to the verified authorization URL with a binding cookie; the
 * callback redeems once (state mismatch, replay, and provider-denied flows
 * all land on the failure page with the temp cookie cleared); both fail
 * closed with 503 when the sandbox integration is disabled.
 *
 * The second suite is the ATO evidence: replay, cross-transaction, missing
 * artifact, upstream-failure, and verifier-secrecy cases proving the flow is
 * secure against CSRF and interception. Deliberate departures from
 * textbook-OAuth test sketches, each load-bearing:
 *
 * - No `node-mocks-http`: App Router handlers take Web `Request`s, so the
 *   suite constructs native `NextRequest`s — the same object production
 *   passes. (`node-mocks-http` is not even installed.)
 * - No `cookies()` mock: the routes never call it. `response.cookies.set()`
 *   sets exactly one binding cookie; state and verifier live only in the
 *   server-side transaction store, which is the interception defense being
 *   proved, not a seam to mock away.
 * - 303, not 302, and failure redirects, not 403/400 statuses: the routes
 *   follow the repository's notice-redirect convention so no error, token,
 *   or upstream document ever enters a response body.
 * - Verified per-service URLs, not generic `oauth2/v0/*`: the config
 *   registry pins discovery-verified endpoints VA actually serves.
 */

const secret = "synthetic-adapter-encryption-secret-32-plus-characters";
const APP_URL = "http://localhost:3142";
const env = {
  VA_ACCOUNT_SANDBOX_ENABLED: "true",
  VA_ACCOUNT_ENV: "sandbox",
  VA_ACCOUNT_SESSION_SECRET: secret,
  APP_URL,
  VA_ACCOUNT_CLAIMS_CLIENT_ID: "synthetic-claims-client",
  VA_ACCOUNT_LOCAL_ONLY: "true",
  NODE_ENV: "test",
};

const config = loadVaAccountConfig("claims", env)!;
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let jwks: { keys: object[] };

beforeAll(async () => {
  keys = await generateKeyPair("RS256", { extractable: true });
  jwks = {
    keys: [{ ...(await exportJWK(keys.publicKey)), kid: "synthetic-key", alg: "RS256", use: "sig" }],
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

let secretCounter = 0;

function stubEnv(overrides: Record<string, string | undefined> = {}) {
  for (const [key, value] of Object.entries({ ...env, ...overrides })) {
    if (value === undefined) vi.stubEnv(key, "");
    else vi.stubEnv(key, value);
  }
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status });
}

async function idToken(nonce: string) {
  return new SignJWT({ nonce })
    .setProtectedHeader({ alg: "RS256", kid: "synthetic-key" })
    .setIssuer(config.issuer)
    .setAudience(config.clientId)
    .setSubject("synthetic-subject")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(keys.privateKey);
}

function provider(token: string) {
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url === config.tokenUrl) {
      return json({
        access_token: "SYNTHETIC_ACCESS",
        refresh_token: "SYNTHETIC_REFRESH",
        token_type: "Bearer",
        expires_in: 300,
        scope: `openid offline_access ${config.scope}`,
        id_token: token,
      });
    }
    if (url === config.keysUrl) return json(jwks);
    throw new Error(`Unexpected synthetic endpoint: ${url}`);
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

function loginRequest() {
  return new NextRequest(`${APP_URL}/api/auth/login`);
}

function bindingFrom(response: Response): string {
  const header = response.headers.get("set-cookie") ?? "";
  const match = header.match(
    new RegExp(`${accountTransactionCookieName("claims")}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]!) : "";
}

async function beginAdapter() {
  // Unique secret per login: the route resolves a module-cached store keyed by
  // secret, and a reused store would reject the second login-budget put — the
  // same reason production fingerprints scope one budget each. The callback
  // must run under the same secret or it resolves a different store.
  secretCounter += 1;
  const loginSecret = `${secret}-${secretCounter}`;
  stubEnv({ VA_ACCOUNT_SESSION_SECRET: loginSecret });
  const login = await loginGET(loginRequest());
  return { login, binding: bindingFrom(login), loginSecret };
}

describe("GET /api/auth/login", () => {
  it("redirects to the verified claims authorization URL with a binding cookie", async () => {
    const { login, binding } = await beginAdapter();
    expect(login.status).toBe(303);
    const target = new URL(login.headers.get("location")!);
    expect(`${target.origin}${target.pathname}`).toBe(
      "https://sandbox-api.va.gov/oauth2/claims/v1/authorization",
    );
    expect(target.searchParams.get("response_type")).toBe("code");
    expect(target.searchParams.get("code_challenge_method")).toBe("S256");
    expect(target.searchParams.get("code_challenge")).toBeTruthy();
    expect(target.searchParams.get("state")).toBeTruthy();
    expect(binding).toBeTruthy();
    const setCookie = login.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Path=/api/auth");
  });

  it("fails closed with 503 when the sandbox integration is disabled", async () => {
    stubEnv({ VA_ACCOUNT_SANDBOX_ENABLED: "false" });
    const response = await loginGET(loginRequest());
    expect(response.status).toBe(503);
  });
});

describe("GET /api/auth/callback", () => {
  async function callback(params: URLSearchParams, binding: string, loginSecret?: string) {
    stubEnv(loginSecret ? { VA_ACCOUNT_SESSION_SECRET: loginSecret } : {});
    return callbackGET(
      new NextRequest(`${APP_URL}/api/auth/callback?${params.toString()}`, {
        headers: { cookie: `${accountTransactionCookieName("claims")}=${binding}` },
      }),
    );
  }

  it("redeems a fresh transaction, sets the session cookie, and clears the binding", async () => {
    const { login, binding, loginSecret } = await beginAdapter();
    const state = new URL(login.headers.get("location")!).searchParams.get("state")!;
    const nonce = new URL(login.headers.get("location")!).searchParams.get("nonce")!;
    provider(await idToken(nonce));

    const response = await callback(
      new URLSearchParams({ code: "synthetic-code", state }),
      binding,
      loginSecret,
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${APP_URL}/va-account?notice=connected`);
    const cookies = response.headers.get("set-cookie") ?? "";
    expect(cookies).toContain(`${accountCookieName("claims")}=`);
    expect(cookies).toContain("SameSite=strict");
    // Identical session artifact to the existing flow (same name, same
    // /va-account path): one client must never hold two same-named handles.
    expect(cookies).toContain("Path=/va-account");
    // Transaction cookie cleared on the success path.
    expect(cookies).toMatch(
      new RegExp(`${accountTransactionCookieName("claims")}=;`),
    );
  });

  it("rejects a tampered state without redeeming and clears the binding", async () => {
    const { login, binding, loginSecret } = await beginAdapter();
    const state = new URL(login.headers.get("location")!).searchParams.get("state")!;
    const fetcher = provider(await idToken("unused"));

    const response = await callback(
      new URLSearchParams({ code: "synthetic-code", state: `${state}x` }),
      binding,
      loginSecret,
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${APP_URL}/va-account?notice=connection-failed`);
    expect(fetcher).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie") ?? "").toMatch(
      new RegExp(`${accountTransactionCookieName("claims")}=;`),
    );
  });

  it("sends a provider-denied callback to the failure page with no token call", async () => {
    const { binding } = await beginAdapter();
    const fetcher = provider(await idToken("unused"));

    const response = await callback(
      new URLSearchParams({ error: "access_denied", state: "anything" }),
      binding,
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${APP_URL}/va-account?notice=connection-failed`);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when the sandbox integration is disabled", async () => {
    stubEnv({ VA_ACCOUNT_SANDBOX_ENABLED: "false" });
    const response = await callbackGET(
      new NextRequest(`${APP_URL}/api/auth/callback?code=x&state=y`),
    );
    expect(response.status).toBe(503);
  });
});

describe("CSRF and interception resistance (ATO evidence)", () => {
  /** Individual Set-Cookie values; undici preserves them separately. */
  function setCookies(response: Response): string[] {
    const get = (
      response.headers as Headers & { getSetCookie?: () => string[] }
    ).getSetCookie;
    if (typeof get === "function") return get.call(response.headers);
    return [response.headers.get("set-cookie") ?? ""];
  }

  function authUrl(login: Response): URL {
    return new URL(login.headers.get("location")!);
  }

  async function callback(
    params: URLSearchParams,
    binding: string,
    loginSecret: string,
  ) {
    stubEnv({ VA_ACCOUNT_SESSION_SECRET: loginSecret });
    return callbackGET(
      new NextRequest(`${APP_URL}/api/auth/callback?${params.toString()}`, {
        headers: { cookie: `${accountTransactionCookieName("claims")}=${binding}` },
      }),
    );
  }

  it("replaying a redeemed callback fails closed with no second exchange", async () => {
    const { login, binding, loginSecret } = await beginAdapter();
    const state = authUrl(login).searchParams.get("state")!;
    const nonce = authUrl(login).searchParams.get("nonce")!;
    const fetcher = provider(await idToken(nonce));
    const params = new URLSearchParams({ code: "synthetic-code", state });

    const first = await callback(params, binding, loginSecret);
    expect(first.headers.get("location")).toBe(`${APP_URL}/va-account?notice=connected`);
    const exchanges = fetcher.mock.calls.length;
    expect(exchanges).toBeGreaterThan(0);

    // The transaction was consumed single-use: the identical replay — the
    // shape an intercepted callback would take — finds nothing to redeem.
    const replay = await callback(params, binding, loginSecret);
    expect(replay.status).toBe(303);
    expect(replay.headers.get("location")).toBe(`${APP_URL}/va-account?notice=connection-failed`);
    expect(fetcher.mock.calls.length).toBe(exchanges);
    expect(replay.headers.get("set-cookie") ?? "").not.toContain(
      `${accountCookieName("claims")}=`,
    );
  });

  it("a binding from one login does not authorize another login's state", async () => {
    const first = await beginAdapter();
    const second = await beginAdapter();
    const stateB = authUrl(second.login).searchParams.get("state")!;
    const fetcher = provider(await idToken("unused"));

    // Attacker swaps in their own transaction cookie, or replays a stale one:
    // the state names transaction B but the binding belongs to A.
    const response = await callback(
      new URLSearchParams({ code: "synthetic-code", state: stateB }),
      first.binding,
      second.loginSecret,
    );
    expect(response.headers.get("location")).toBe(
      `${APP_URL}/va-account?notice=connection-failed`,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("a missing binding cookie fails without a token call", async () => {
    const { login, loginSecret } = await beginAdapter();
    const state = authUrl(login).searchParams.get("state")!;
    const fetcher = provider(await idToken("unused"));

    const response = await callback(new URLSearchParams({ code: "synthetic-code", state }), "", loginSecret);
    expect(response.headers.get("location")).toBe(`${APP_URL}/va-account?notice=connection-failed`);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("missing code and state parameters fail closed", async () => {
    const { binding, loginSecret } = await beginAdapter();
    const fetcher = provider(await idToken("unused"));

    const response = await callback(new URLSearchParams(), binding, loginSecret);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${APP_URL}/va-account?notice=connection-failed`);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("an upstream token failure sets no session", async () => {
    const { login, binding, loginSecret } = await beginAdapter();
    const state = authUrl(login).searchParams.get("state")!;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );

    const response = await callback(
      new URLSearchParams({ code: "synthetic-code", state }),
      binding,
      loginSecret,
    );
    expect(response.headers.get("location")).toBe(`${APP_URL}/va-account?notice=connection-failed`);
    expect(response.headers.get("set-cookie") ?? "").not.toContain(
      `${accountCookieName("claims")}=`,
    );
  });

  it("pins the authorization request to the verified claims contract", async () => {
    const { login } = await beginAdapter();
    const target = authUrl(login);
    expect(target.searchParams.get("scope")?.split(/\s+/).sort()).toEqual(
      ["claim.read", "offline_access", "openid"],
    );
    expect(target.searchParams.get("redirect_uri")).toBe(
      `${APP_URL}/va-account/oauth/claims/callback`,
    );
    // S256 challenge: 32 bytes, base64url, unpadded — 43 characters.
    expect(target.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(target.searchParams.get("response_type")).toBe("code");
    expect(target.searchParams.get("code_challenge_method")).toBe("S256");

    // Fresh entropy per login: captured values never replay into each other.
    const other = await beginAdapter();
    const otherTarget = authUrl(other.login);
    expect(otherTarget.searchParams.get("state")).not.toBe(
      target.searchParams.get("state"),
    );
    expect(otherTarget.searchParams.get("nonce")).not.toBe(
      target.searchParams.get("nonce"),
    );
  });

  it("the verifier crosses only the server-to-VA boundary", async () => {
    const { login, binding, loginSecret } = await beginAdapter();
    const state = authUrl(login).searchParams.get("state")!;
    const nonce = authUrl(login).searchParams.get("nonce")!;
    const fetcher = provider(await idToken(nonce));

    // Login exposes exactly one cookie (the binding) and no verifier material
    // in the URL: there is nothing client-side to intercept.
    expect(setCookies(login)).toHaveLength(1);
    expect(login.headers.get("location")).not.toContain("code_verifier");
    expect(login.headers.get("location")).not.toContain("verifier");

    await callback(new URLSearchParams({ code: "synthetic-code", state }), binding, loginSecret);
    const calls = fetcher.mock.calls as unknown as Array<[unknown, RequestInit?]>;
    const tokenCall = calls.find(([input]) => String(input) === config.tokenUrl);
    expect(tokenCall, "token exchange must have occurred").toBeDefined();
    const body = new URLSearchParams(String(tokenCall![1]?.body));
    expect(body.get("grant_type")).toBe("authorization_code");
    // The server retrieved the 43-character verifier from its own store and
    // sent it server-to-VA: the client never held it, so it cannot leak it.
    expect(body.get("code_verifier")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("the session handle is opaque and never the token", async () => {
    const { login, binding, loginSecret } = await beginAdapter();
    const state = authUrl(login).searchParams.get("state")!;
    const nonce = authUrl(login).searchParams.get("nonce")!;
    provider(await idToken(nonce));

    const response = await callback(
      new URLSearchParams({ code: "synthetic-code", state }),
      binding,
      loginSecret,
    );
    const session = setCookies(response).find((cookie) =>
      cookie.startsWith(`${accountCookieName("claims")}=`),
    );
    expect(session, "session cookie must be set").toBeDefined();
    const value = decodeURIComponent(session!.split(";")[0]!.split("=")[1]!);
    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(value).not.toContain("SYNTHETIC_ACCESS");
  });
});
