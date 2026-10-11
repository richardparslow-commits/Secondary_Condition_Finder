import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { callVaApi, isVaPlatformUrl } from "@/lib/va/client";
import { loadVaAccountConfig } from "@/lib/va/account/config";
import { completeAccountLogin, readAccountSession, startAccountLogin } from "@/lib/va/account/oauth";
import { createMemoryAccountStore } from "@/lib/va/account/store";

/**
 * The VA platform client: one credentialled request, one refresh on 401, one
 * replay. What is pinned here is the set of properties that make it safe to be
 * the only caller of the platform:
 *
 *   - the bearer token is attached only to the configured platform origin, so a
 *     caller-supplied URL cannot exfiltrate it;
 *   - a 401 causes exactly one refresh through the session store and exactly
 *     one replay — never a retry loop, and never a stale token replayed;
 *   - when the refresh cannot complete, the session is invalidated rather than
 *     left to look connected;
 *   - failure is a value (unavailable/unauthorized), so an outage or an
 *     unexpected payload cannot be read as data, and no upstream body is echoed.
 */

const secret = "synthetic-account-encryption-secret-32-plus-characters";
const env = {
  VA_ACCOUNT_SANDBOX_ENABLED: "true",
  VA_ACCOUNT_ENV: "sandbox",
  VA_ACCOUNT_SESSION_SECRET: secret,
  APP_URL: "http://localhost:3141",
  VA_ACCOUNT_CLAIMS_CLIENT_ID: "synthetic-claims-client",
  VA_ACCOUNT_LOCAL_ONLY: "true",
  NODE_ENV: "test",
};
const config = loadVaAccountConfig("claims", env)!;
const payloadSchema = z.object({ data: z.array(z.object({ id: z.string() })) });
const okPayload = { data: [{ id: "synthetic-id" }] };

let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let jwks: { keys: object[] };
beforeAll(async () => {
  keys = await generateKeyPair("RS256", { extractable: true });
  jwks = { keys: [{ ...(await exportJWK(keys.publicKey)), kid: "synthetic-key", alg: "RS256", use: "sig" }] };
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status });
}

function tokens(access: string, refresh: string | null, idToken: string) {
  return {
    access_token: access,
    ...(refresh ? { refresh_token: refresh } : {}),
    token_type: "Bearer",
    expires_in: 300,
    scope: `openid offline_access ${config.scope}`,
    id_token: idToken,
  };
}

/** Every request the client made, in order, with the credential it presented. */
type Call = { url: string; authorization: string | undefined };

/**
 * A session in the store, produced by the real login flow (PKCE + state +
 * id_token verification), so the client is exercised against a genuine session
 * rather than a hand-built record.
 */
async function connectedSession() {
  const store = createMemoryAccountStore(secret);
  const login = await startAccountLogin(config, store);
  const query = new URL(login.url).searchParams;
  const idToken = await new SignJWT({ nonce: query.get("nonce")! })
    .setProtectedHeader({ alg: "RS256", kid: "synthetic-key" })
    .setIssuer(config.issuer)
    .setAudience(config.clientId)
    .setSubject("synthetic-subject")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(keys.privateKey);
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, authorization: new Headers(init?.headers).get("authorization") ?? undefined });
      if (url === config.tokenUrl) return json(tokens("ACCESS_1", "REFRESH_1", idToken));
      if (url === config.keysUrl) return json(jwks);
      throw new Error(`unexpected endpoint in the login leg: ${url}`);
    }),
  );
  const handle = await completeAccountLogin(
    config,
    store,
    new URLSearchParams({ state: query.get("state")!, code: "synthetic-code" }),
    login.binding,
  );
  calls.length = 0;
  return { store, handle, calls, idToken };
}

describe("VA platform client", () => {
  it("calls the platform with the session token and validates the payload", async () => {
    const { store, handle, calls } = await connectedSession();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), authorization: new Headers(init?.headers).get("authorization") ?? undefined });
        return json(okPayload);
      }),
    );

    const outcome = await callVaApi(config, store, handle, config.apiUrl, payloadSchema);

    expect(outcome).toEqual({ ok: true, status: 200, data: okPayload });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(config.apiUrl);
    expect(calls[0].authorization).toBe("Bearer ACCESS_1");
  });

  it("refreshes once on a 401 and replays with the new token", async () => {
    const { store, handle, calls, idToken } = await connectedSession();
    let apiCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, authorization: new Headers(init?.headers).get("authorization") ?? undefined });
        if (url === config.keysUrl) return json(jwks);
        if (url === config.tokenUrl) {
          // The refresh grant, and only the refresh grant, may reach here. The
          // renewed id_token is verified against the JWKS above, so the session
          // the replay borrows is one the flow actually accepted.
          expect(String(init?.body)).toContain("grant_type=refresh_token");
          return json(tokens("ACCESS_2", "REFRESH_2", idToken));
        }
        apiCalls += 1;
        return apiCalls === 1 ? new Response(null, { status: 401 }) : json(okPayload);
      }),
    );

    const outcome = await callVaApi(config, store, handle, config.apiUrl, payloadSchema);

    expect(outcome).toEqual({ ok: true, status: 200, data: okPayload });
    // Two platform calls (rejected, replayed) and exactly one refresh.
    expect(apiCalls).toBe(2);
    expect(calls.filter((call) => call.url === config.tokenUrl)).toHaveLength(1);
    expect(calls.filter((call) => call.url === config.apiUrl).map((call) => call.authorization)).toEqual([
      "Bearer ACCESS_1",
      "Bearer ACCESS_2",
    ]);
  });

  it("stops after one replay when the refreshed token is also rejected", async () => {
    const { store, handle, calls, idToken } = await connectedSession();
    let apiCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, authorization: new Headers(init?.headers).get("authorization") ?? undefined });
        if (url === config.keysUrl) return json(jwks);
        if (url === config.tokenUrl) return json(tokens("ACCESS_2", "REFRESH_2", idToken));
        apiCalls += 1;
        return new Response(null, { status: 401 });
      }),
    );

    const outcome = await callVaApi(config, store, handle, config.apiUrl, payloadSchema);

    expect(outcome).toEqual({ ok: false, reason: "unauthorized", status: 401 });
    // A third attempt would be a retry loop, and the token is known bad.
    expect(apiCalls).toBe(2);
    expect(calls.filter((call) => call.url === config.tokenUrl)).toHaveLength(1);
  });

  it("invalidates the session when the refresh leg itself fails", async () => {
    // The platform rejects the access token and the token endpoint is down, so
    // there is no way back to a usable credential. The client must not replay
    // the token it knows is bad, and must not leave a session that looks alive.
    const { store, handle, calls } = await connectedSession();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, authorization: new Headers(init?.headers).get("authorization") ?? undefined });
        if (url === config.keysUrl) return json(jwks);
        // The refresh endpoint is down, so the renewal cannot complete.
        if (url === config.tokenUrl) return new Response(null, { status: 500 });
        return new Response(null, { status: 401 });
      }),
    );

    const outcome = await callVaApi(config, store, handle, config.apiUrl, payloadSchema);

    expect(outcome).toEqual({ ok: false, reason: "unauthorized", status: 401 });
    // The rejected token is never replayed…
    expect(calls.filter((call) => call.url === config.apiUrl)).toHaveLength(1);
    // …and the session is no longer usable, which is what the caller acts on.
    expect(await readAccountSession(config, store, handle)).toBeNull();
  });

  it("reports an unauthorized outcome when there is no usable session", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    const outcome = await callVaApi(config, createMemoryAccountStore(secret), "not-a-session-handle", config.apiUrl, payloadSchema);

    expect(outcome).toEqual({ ok: false, reason: "unauthorized", status: null });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refuses a URL on another origin without attaching the token", async () => {
    const { store, handle } = await connectedSession();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    const outcome = await callVaApi(config, store, handle, "https://attacker.example/collect", payloadSchema);

    expect(outcome).toEqual({ ok: false, reason: "unavailable", status: null });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("accepts the platform origin, and only the platform origin", () => {
    expect(isVaPlatformUrl(config, "/services/claims/v1/claims")).toBe(true);
    expect(isVaPlatformUrl(config, config.apiUrl)).toBe(true);
    // Look-alike host, protocol-relative host, and the production origin: all
    // resolve somewhere else, so none may carry the sandbox session's token.
    expect(isVaPlatformUrl(config, "https://sandbox-api.va.gov.evil.example/oauth2")).toBe(false);
    expect(isVaPlatformUrl(config, "//evil.example/oauth2/claims/v1/token")).toBe(false);
    expect(isVaPlatformUrl(config, "https://api.va.gov/services/claims/v1/claims")).toBe(false);
    // A relative path is resolved against the platform, so a malformed path is
    // refused by the platform (and by the payload schema) rather than by a
    // guard whose job is the origin, not path validity.
    expect(isVaPlatformUrl(config, "not-a-path")).toBe(true);
  });

  it("treats an unexpected payload shape as unavailable, never as data", async () => {
    const { store, handle } = await connectedSession();
    vi.stubGlobal("fetch", vi.fn(async () => json({ data: "not-an-array" })));

    const outcome = await callVaApi(config, store, handle, config.apiUrl, payloadSchema);

    expect(outcome).toEqual({ ok: false, reason: "unavailable", status: 200 });
  });

  it("reports a non-401 platform error without reading its body", async () => {
    const { store, handle } = await connectedSession();
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        seen.push(String(input));
        return new Response("DO_NOT_EXPOSE_UPSTREAM_ERROR", { status: 503 });
      }),
    );

    const outcome = await callVaApi(config, store, handle, config.apiUrl, payloadSchema);

    expect(outcome).toEqual({ ok: false, reason: "unavailable", status: 503 });
    expect(seen).toEqual([config.apiUrl]);
  });

  it("abandons an oversized body instead of buffering it", async () => {
    const { store, handle } = await connectedSession();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x".repeat(300 * 1024), { status: 200 })));

    const outcome = await callVaApi(config, store, handle, config.apiUrl, payloadSchema);

    expect(outcome).toEqual({ ok: false, reason: "unavailable", status: null });
  });

  it("caps the exchange with the caller's timeout", async () => {
    const { store, handle } = await connectedSession();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: string | URL | Request, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      ),
    );

    const outcome = await callVaApi(config, store, handle, config.apiUrl, payloadSchema, { timeoutMs: 25 });

    expect(outcome).toEqual({ ok: false, reason: "unavailable", status: null });
  });
});
