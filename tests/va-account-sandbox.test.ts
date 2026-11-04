import { createHash, randomBytes } from "node:crypto";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { NextRequest } from "next/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { loadVaAccountConfig, accountCookieName, accountTransactionCookieName, type VaAccountConfig } from "@/lib/va/account/config";
import { accountSessionKey, completeAccountLogin, disconnectAccount, readAccountSession, startAccountLogin } from "@/lib/va/account/oauth";
import { claimStatusesSchema, loadAccountData, ratingSummarySchema } from "@/lib/va/account/data";
import { createMemoryAccountStore, loadAccountStore, type AccountStore } from "@/lib/va/account/store";
import { GET, POST } from "@/app/va-account/oauth/[service]/[operation]/route";

const secret = "synthetic-account-encryption-secret-32-plus-characters";
const env = {
  VA_ACCOUNT_SANDBOX_ENABLED: "true", VA_ACCOUNT_ENV: "sandbox",
  VA_ACCOUNT_SESSION_SECRET: secret, APP_URL: "http://localhost:3141",
  VA_ACCOUNT_RATINGS_CLIENT_ID: "synthetic-ratings-client",
  VA_ACCOUNT_CLAIMS_CLIENT_ID: "synthetic-claims-client",
  VA_ACCOUNT_LOCAL_ONLY: "true", NODE_ENV: "test",
};
const config = loadVaAccountConfig("ratings", env)!;
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let jwks: { keys: object[] };
beforeAll(async () => {
  keys = await generateKeyPair("RS256", { extractable: true });
  jwks = { keys: [{ ...await exportJWK(keys.publicKey), kid: "synthetic-key", alg: "RS256", use: "sig" }] };
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status }); }
async function idToken(cfg: VaAccountConfig, nonce: string, changes: Record<string, unknown> = {}) {
  return new SignJWT({ nonce, ...changes }).setProtectedHeader({ alg: "RS256", kid: "synthetic-key" })
    .setIssuer(cfg.issuer).setAudience(cfg.clientId).setSubject("synthetic-subject")
    .setIssuedAt().setExpirationTime("5m").sign(keys.privateKey);
}
async function begin(store: AccountStore, cfg = config) {
  const login = await startAccountLogin(cfg, store);
  const query = new URL(login.url).searchParams;
  const nonce = query.get("nonce")!;
  return { ...login, query, nonce, callback: new URLSearchParams({ state: query.get("state")!, code: "synthetic-code" }) };
}
function provider(token: string, cfg = config, extra?: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (extra) {
      const response = await extra(url, init);
      if (response) return response;
    }
    if (url === cfg.tokenUrl) return json({ access_token: "SYNTHETIC_ACCESS", refresh_token: "SYNTHETIC_REFRESH", token_type: "Bearer", expires_in: 300, scope: `openid offline_access ${cfg.scope}`, id_token: token });
    if (url === cfg.keysUrl) return json(jwks);
    if (url === cfg.revocationUrl) return new Response(null, { status: 200 });
    if (url === cfg.apiUrl) return json({ data: { id: "DO_NOT_EXPOSE_ICN", type: "disability-rating", attributes: { combined_disability_rating: 40, combined_effective_date: "2020-01-01", legal_effective_date: null, individual_ratings: [{ disability_rating_id: "DO_NOT_EXPOSE_RATING_ID", diagnostic_text: "DO_NOT_EXPOSE_DIAGNOSIS", decision: "Service Connected", rating_percentage: 40, effective_date: "2020-01-01" }] } } });
    throw new Error("Unexpected synthetic endpoint");
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
async function connected(store = createMemoryAccountStore(secret), cfg = config) {
  const login = await begin(store, cfg);
  const token = await idToken(cfg, login.nonce);
  const fetcher = provider(token, cfg);
  const handle = await completeAccountLogin(cfg, store, login.callback, login.binding);
  return { store, handle, login, token, fetcher };
}

describe("sandbox account configuration", () => {
  it("fails closed by default, on production selection, missing secrets/clients, or unsafe origins", () => {
    expect(loadVaAccountConfig("ratings", {})).toBeNull();
    for (const change of [
      { VA_ACCOUNT_ENV: "production" }, { VA_ACCOUNT_SANDBOX_ENABLED: "false" },
      { VA_ACCOUNT_SESSION_SECRET: "short" }, { VA_ACCOUNT_RATINGS_CLIENT_ID: "" },
      { APP_URL: "http://example.test" }, { APP_URL: "https://app.test/redirect" },
      { APP_URL: "https://user:pass@app.test" }, { APP_URL: "https://app.test?next=evil" },
    ]) expect(loadVaAccountConfig("ratings", { ...env, ...change })).toBeNull();
    expect(config.apiUrl).toBe("https://sandbox-api.va.gov/services/veteran_verification/v2/summary/disability_rating");
    expect(config.authorizationUrl).toBe("https://sandbox-api.va.gov/oauth2/veteran-verification/v1/authorization");
    expect(config.callbackUrl).toBe(`${env.APP_URL}/va-account/oauth/ratings/callback`);
    expect(loadVaAccountConfig("claims", env)?.authorizationUrl).toBe("https://sandbox-api.va.gov/oauth2/claims/v1/authorization");
    expect(loadVaAccountConfig("ratings", { ...env, VA_ACCOUNT_RATINGS_CLIENT_SECRET: "unexpected-secret" })).toBeNull();
  });
  it("refuses memory storage on production, hosted, remote, or implicit local configuration", () => {
    expect(loadAccountStore(config, { ...env, NODE_ENV: "production" })).toBeNull();
    expect(loadAccountStore(config, { ...env, VERCEL: "1" })).toBeNull();
    expect(loadAccountStore(config, { ...env, VA_ACCOUNT_LOCAL_ONLY: "false" })).toBeNull();
    const remote = loadVaAccountConfig("ratings", { ...env, APP_URL: "https://app.test" })!;
    expect(loadAccountStore(remote, env)).toBeNull();
    expect(loadAccountStore(config, env)).not.toBeNull();
  });
});

describe("PKCE and authenticated callback", () => {
  it("uses random S256, minimal read scopes and server-stored verifier, then rejects replay", async () => {
    const { store, handle, login, fetcher } = await connected();
    expect(login.query.get("code_challenge_method")).toBe("S256");
    expect(login.query.get("scope")).toBe("openid offline_access disability_rating_summary.read");
    expect(login.query.get("redirect_uri")).toBe(config.callbackUrl);
    expect(login.url).not.toContain("code_verifier");
    expect(login.url).not.toContain("SYNTHETIC_ACCESS");
    const exchange = new URLSearchParams(fetcher.mock.calls.find(([u]) => String(u) === config.tokenUrl)![1]!.body as URLSearchParams);
    expect(exchange.get("grant_type")).toBe("authorization_code");
    expect(exchange.get("client_id")).toBe(config.clientId);
    const verifier = exchange.get("code_verifier")!;
    expect(verifier).toHaveLength(43);
    expect(createHash("sha256").update(verifier).digest("base64url")).toBe(login.query.get("code_challenge"));
    expect(handle).toHaveLength(43);
    expect((await readAccountSession(config, store, handle))?.subject).toBe("synthetic-subject");
    await expect(completeAccountLogin(config, store, login.callback, login.binding)).rejects.toThrow("Sandbox account operation unavailable");
    expect(fetcher.mock.calls.filter(([u]) => String(u) === config.tokenUrl)).toHaveLength(1);
  });
  it("rejects wrong browser bindings, state/service mix-ups, expired and denied callbacks before token exchange", async () => {
    const store = createMemoryAccountStore(secret); const login = await begin(store);
    const fetcher = provider(await idToken(config, login.nonce));
    await expect(completeAccountLogin(config, store, login.callback, randomBytes(32).toString("base64url"))).rejects.toThrow();
    await expect(completeAccountLogin(loadVaAccountConfig("claims", env)!, store, login.callback, login.binding)).rejects.toThrow();
    const duplicate = new URLSearchParams(login.callback); duplicate.append("state", login.query.get("state")!);
    await expect(completeAccountLogin(config, store, duplicate, login.binding)).rejects.toThrow();
    const denied = new URLSearchParams({ state: login.query.get("state")!, error: "access_denied", error_description: "SENSITIVE_SENTINEL" });
    await expect(completeAccountLogin(config, store, denied, login.binding)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    const expired = await begin(createMemoryAccountStore(secret));
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 301_000);
    await expect(completeAccountLogin(config, store, expired.callback, expired.binding)).rejects.toThrow();
  });
  it.each(["nonce", "issuer", "audience", "signature", "expiry"])("rejects an invalid ID token %s", async (fault) => {
    const store = createMemoryAccountStore(secret); const login = await begin(store);
    const signingKeys = fault === "signature" ? await generateKeyPair("RS256") : keys;
    const token = await new SignJWT({ nonce: fault === "nonce" ? "wrong" : login.nonce })
      .setProtectedHeader({ alg: "RS256", kid: "synthetic-key" })
      .setIssuer(fault === "issuer" ? "https://evil.test" : config.issuer)
      .setAudience(fault === "audience" ? "wrong-client" : config.clientId)
      .setSubject("synthetic-subject").setIssuedAt().setExpirationTime(fault === "expiry" ? Math.floor(Date.now() / 1000) - 60 : "5m")
      .sign(signingKeys.privateKey);
    provider(token);
    await expect(completeAccountLogin(config, store, login.callback, login.binding)).rejects.toThrow("Sandbox account operation unavailable");
  });
  it("allows only one concurrent redemption and never retries token exchanges", async () => {
    const store = createMemoryAccountStore(secret); const login = await begin(store);
    const fetcher = provider(await idToken(config, login.nonce));
    const results = await Promise.allSettled([1, 2].map(() => completeAccountLogin(config, store, login.callback, login.binding)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(fetcher.mock.calls.filter(([u]) => String(u) === config.tokenUrl)).toHaveLength(1);
  });
});

describe("read-only veteran data", () => {
  it("uses the authenticated token only, drops identity/diagnosis fields, and honors pacing", async () => {
    const { store, handle, fetcher } = await connected();
    const data = await loadAccountData(config, store, handle);
    expect(data.status).toBe("connected");
    expect(JSON.stringify(data)).not.toMatch(/DO_NOT_EXPOSE|SYNTHETIC_ACCESS|SYNTHETIC_REFRESH/);
    const call = fetcher.mock.calls.find(([url]) => String(url) === config.apiUrl)!;
    expect(call[1]?.headers).toEqual({ Accept: "application/json", Authorization: "Bearer SYNTHETIC_ACCESS" });
    expect(call[1]?.method).toBeUndefined();
    expect(call[1]?.redirect).toBe("error");
    expect(call[1]?.cache).toBe("no-store");
    expect(await loadAccountData(config, store, handle)).toEqual({ status: "rate-limited" });
    expect(await loadAccountData(config, store, "invalid")).toEqual({ status: "disconnected" });
  });
  it("reports an unreachable store as unavailable instead of a dropped connection", async () => {
    const { handle } = await connected();
    const store = createMemoryAccountStore(secret);
    // The session read fails because the coordinator cannot answer, not because
    // the handle is invalid. The page must not claim the connection ended.
    const unreachable: AccountStore = {
      put: (...args) => store.put(...args),
      read: async () => null,
      readOutcome: async () => ({ status: "unavailable" }),
      consume: (...args) => store.consume(...args),
      replace: (...args) => store.replace(...args),
      remove: (...args) => store.remove(...args),
    };

    expect(await loadAccountData(config, unreachable, handle)).toEqual({ status: "unavailable" });
  });
  it("accepts the documented null-rating record and rejects malformed/incomplete values", () => {
    expect(ratingSummarySchema.parse({ data: { attributes: { combined_disability_rating: null, combined_effective_date: null, legal_effective_date: null, individual_ratings: null } } }).combined_disability_rating).toBeNull();
    expect(ratingSummarySchema.safeParse({ data: { attributes: { combined_disability_rating: 101 } } }).success).toBe(false);
    expect(claimStatusesSchema.parse({ data: [{ id: "PRIVATE_CLAIM_ID", attributes: { claim_type: "Compensation", date_filed: "2020-01-01", status: "Complete", open: false, evss_id: 42 } }] })).toEqual([{ claim_type: "Compensation", date_filed: "2020-01-01", status: "Complete", open: false }]);
    expect(claimStatusesSchema.safeParse({ data: [{ attributes: { status: "invented" } }] }).success).toBe(false);
  });
  it.each([403, 429, 500, 503])("handles HTTP %i without a token refresh or upstream exposure", async (status) => {
    const { store, handle, token } = await connected();
    const fetcher = vi.fn(async (input: string | URL | Request) => json({ detail: "SENSITIVE_SENTINEL", at: String(input) }, status)); vi.stubGlobal("fetch", fetcher);
    const result = await loadAccountData(config, store, handle);
    expect(result.status).toBe(status === 403 ? "disconnected" : status === 429 ? "rate-limited" : "unavailable");
    // A refusal that is not a rejected credential must not mint a new one: one
    // platform call, and the token endpoint is never touched.
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls.every(([url]) => String(url) === config.apiUrl)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("SENSITIVE_SENTINEL");
    expect(token).toBeTruthy();
  });
  it("tries exactly one refresh on 401 and never replays the rejected token", async () => {
    const { store, handle } = await connected();
    // Everything is refused, the refresh included: the access token the
    // platform already rejected must not be sent again, and the attempt must
    // not become a loop.
    const fetcher = vi.fn(async (input: string | URL | Request) => json({ detail: "SENSITIVE_SENTINEL", at: String(input) }, 401));
    vi.stubGlobal("fetch", fetcher);
    const result = await loadAccountData(config, store, handle);
    expect(result.status).toBe("disconnected");
    expect(fetcher.mock.calls.filter(([url]) => String(url) === config.apiUrl)).toHaveLength(1);
    expect(fetcher.mock.calls.filter(([url]) => String(url) === config.tokenUrl)).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("SENSITIVE_SENTINEL");
    // The dead generation is gone, so the page cannot keep showing data.
    expect(await readAccountSession(config, store, handle)).toBeNull();
  });
  it("recovers a lapsed access token with one refresh and one replay", async () => {
    const { store, handle, token } = await connected();
    const presented: Array<string | null> = [];
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === config.keysUrl) return json(jwks);
      if (url === config.tokenUrl) {
        return json({ access_token: "ROTATED_ACCESS", refresh_token: "ROTATED_REFRESH", token_type: "Bearer", expires_in: 300, scope: `openid offline_access ${config.scope}`, id_token: token });
      }
      presented.push(new Headers(init?.headers).get("authorization"));
      return presented.length === 1
        ? json({ detail: "expired" }, 401)
        : json({ data: { attributes: { combined_disability_rating: 40, combined_effective_date: "2020-01-01", legal_effective_date: null, individual_ratings: null } } });
    });
    vi.stubGlobal("fetch", fetcher);

    const result = await loadAccountData(config, store, handle);

    // The veteran sees their data instead of a forced re-consent round trip.
    expect(result).toMatchObject({ status: "connected", service: "ratings", data: { combined_disability_rating: 40 } });
    // Two platform calls, and the replay carries the token the refresh minted —
    // not the one the platform had just rejected.
    expect(presented).toEqual(["Bearer SYNTHETIC_ACCESS", "Bearer ROTATED_ACCESS"]);
  });
  it("rejects an oversized API response with no fallback veteran data", async () => {
    const { store, handle } = await connected();
    vi.stubGlobal("fetch", vi.fn(async () => json({ data: "x".repeat(300_000) })));
    expect(await loadAccountData(config, store, handle)).toEqual({ status: "unavailable" });
  });
});

describe("session refresh and invalidation", () => {
  async function expiring() {
    const result = await connected();
    const key = accountSessionKey(config, result.handle);
    const current = await result.store.read(key) as Record<string, unknown>;
    await result.store.replace(key, current, { ...current, accessExpiresAt: Date.now() + 1_000 }, 1800);
    return { ...result, key, current };
  }
  it("rotates tokens without extending the session's absolute expiry", async () => {
    const { store, handle, current, token } = await expiring();
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input) === config.keysUrl) return json(jwks);
      expect(new URLSearchParams(init?.body as URLSearchParams).get("grant_type")).toBe("refresh_token");
      return json({ access_token: "ROTATED_ACCESS", refresh_token: "ROTATED_REFRESH", token_type: "Bearer", expires_in: 600, scope: `openid offline_access ${config.scope}`, id_token: token });
    }); vi.stubGlobal("fetch", fetcher);
    const renewed = await readAccountSession(config, store, handle);
    expect(renewed?.accessToken).toBe("ROTATED_ACCESS");
    expect(renewed?.refreshToken).toBe("ROTATED_REFRESH");
    expect(renewed?.expiresAt).toBe(current.expiresAt);
  });
  it("does not refresh twice concurrently or resurrect a session after logout", async () => {
    const { store, handle, key } = await expiring();
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>((done) => { resolve = done; })); vi.stubGlobal("fetch", fetcher);
    const pending = readAccountSession(config, store, handle);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(await readAccountSession(config, store, handle)).toBeNull();
    expect(await disconnectAccount(config, store, handle)).toEqual({ cleared: true, revoked: false });
    resolve(json({ access_token: "LATE_ACCESS", token_type: "Bearer", expires_in: 300, scope: `openid ${config.scope}` }));
    expect(await pending).toBeNull();
    expect(await store.read(key)).toBeNull();
  });
  it("invalidates on refresh failure and reports provider revocation failure separately", async () => {
    const { store, handle, key } = await expiring();
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "invalid_grant", detail: "SENSITIVE_SENTINEL" }, 400)));
    expect(await readAccountSession(config, store, handle)).toBeNull();
    expect((await store.read(key) as { kind: string }).kind).toBe("invalidated");
    const other = await connected();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    expect(await disconnectAccount(config, other.store, other.handle)).toEqual({ cleared: true, revoked: false });
    expect(await readAccountSession(config, other.store, other.handle)).toBeNull();
  });
});

describe("shared encrypted session store", () => {
  it("requires atomic command support, encrypts values, and rejects HTTP-success command errors", async () => {
    const sharedEnv = { ...env, VA_ACCOUNT_STORE_URL: "https://store.test", VA_ACCOUNT_STORE_TOKEN: "SYNTHETIC_STORE_TOKEN" };
    const store = loadAccountStore(config, sharedEnv)!;
    const commands: unknown[][] = [];
    const fetcher = vi.fn(async (_input: unknown, init?: RequestInit) => { const command = JSON.parse(String(init?.body)); commands.push(command); return json({ result: command[0] === "SET" ? "OK" : null }); });
    vi.stubGlobal("fetch", fetcher);
    expect(await store.put("synthetic", { accessToken: "PRIVATE_TOKEN" }, 60)).toBe(true);
    expect(JSON.stringify(commands)).not.toContain("PRIVATE_TOKEN");
    await store.consume("synthetic");
    expect(commands[1][0]).toBe("GETDEL");
    expect(fetcher.mock.calls[0][1]?.redirect).toBe("error");
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "ERR unsupported" })));
    expect(await store.put("synthetic", { value: 1 }, 60)).toBe(false);
    expect(await store.remove("synthetic")).toBe(false);
    expect(await store.read("synthetic")).toBeNull();
  });
  it("distinguishes a missing entry from a store that could not answer", async () => {
    const sharedEnv = { ...env, VA_ACCOUNT_STORE_URL: "https://store.test", VA_ACCOUNT_STORE_TOKEN: "SYNTHETIC_STORE_TOKEN" };
    const store = loadAccountStore(config, sharedEnv)!;

    vi.stubGlobal("fetch", vi.fn(async () => json({ result: null })));
    expect(await store.readOutcome("synthetic")).toEqual({ status: "missing" });

    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    expect(await store.readOutcome("synthetic")).toEqual({ status: "unavailable" });
    expect(await store.read("synthetic")).toBeNull();
  });
});

describe("account route consent, cookies, and CSRF", () => {
  const args = (operation: string) => ({ params: Promise.resolve({ service: "ratings", operation }) });
  function configure() { for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value); }
  it("rejects unconfigured, cross-origin, GET login, and missing consent without contacting VA", async () => {
    vi.stubEnv("VA_ACCOUNT_SANDBOX_ENABLED", "false");
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const url = `${env.APP_URL}/va-account/oauth/ratings/start`;
    expect((await POST(new NextRequest(url, { method: "POST" }), args("start"))).status).toBe(503);
    configure();
    expect(loadVaAccountConfig("ratings")).not.toBeNull();
    expect(loadAccountStore(loadVaAccountConfig("ratings")!)).not.toBeNull();
    expect(new URL(new NextRequest(url).url).origin).toBe(config.appOrigin);
    expect((await POST(new NextRequest(url, { method: "POST", headers: { origin: "https://evil.test" } }), args("start"))).status).toBe(403);
    expect((await GET(new NextRequest(url), args("start"))).status).toBe(405);
    const response = await POST(new NextRequest(url, { method: "POST", headers: { origin: env.APP_URL, "content-type": "application/x-www-form-urlencoded" }, body: "consent=no" }), args("start"));
    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("starts with consent and ends with a strict opaque cookie and fixed no-store redirect", async () => {
    configure();
    const start = await POST(new NextRequest(`${env.APP_URL}/va-account/oauth/ratings/start`, { method: "POST", headers: { origin: env.APP_URL, "content-type": "application/x-www-form-urlencoded" }, body: "consent=sandbox-read-only" }), args("start"));
    expect(start.status).toBe(200);
    expect(start.headers.get("location")).toBeNull();
    const url = new URL((await start.json()).authorizationUrl);
    const binding = start.cookies.get(accountTransactionCookieName("ratings"))!.value;
    expect(start.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(start.headers.get("set-cookie")).toContain("HttpOnly");
    const token = await idToken(config, url.searchParams.get("nonce")!);
    provider(token);
    const callback = new NextRequest(`${config.callbackUrl}?state=${url.searchParams.get("state")}&code=synthetic-code`, { headers: { cookie: `${accountTransactionCookieName("ratings")}=${binding}` } });
    const response = await GET(callback, args("callback"));
    expect(response.headers.get("location")).toBe(`${env.APP_URL}/va-account?notice=connected`);
    expect(response.cookies.get(accountCookieName("ratings"))!.value).toHaveLength(43);
    expect(response.headers.get("set-cookie")).toContain("SameSite=strict");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("set-cookie")).not.toMatch(/SYNTHETIC_ACCESS|SYNTHETIC_REFRESH|eyJ/);
  });
  it("keeps an existing connection live when a reconnect cannot start", async () => {
    configure();
    const store = loadAccountStore(config)!;
    // The preceding route test's successful login leaves its own two-second
    // budget entry in this shared store; clear it before connecting.
    await store.remove(`login-budget:${config.fingerprint}`);
    const { handle, fetcher } = await connected(store);
    const upstreamCalls = fetcher.mock.calls.length;

    // A durable login-budget entry makes startAccountLogin fail before it
    // creates a transaction, which is the shape of a refused reconnect.
    await store.remove(`login-budget:${config.fingerprint}`);
    expect(await store.put(`login-budget:${config.fingerprint}`, { kind: "budget" }, 60)).toBe(true);

    const response = await POST(
      new NextRequest(`${env.APP_URL}/va-account/oauth/ratings/start`, {
        method: "POST",
        headers: {
          origin: env.APP_URL,
          "content-type": "application/x-www-form-urlencoded",
          cookie: `${accountCookieName("ratings")}=${handle}`,
        },
        body: "consent=sandbox-read-only",
      }),
      args("start"),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${env.APP_URL}/va-account?notice=unavailable`);
    // The refused reconnect neither deleted nor revoked the live session, and
    // it made no upstream call of its own.
    expect(await readAccountSession(config, store, handle)).not.toBeNull();
    expect(fetcher.mock.calls.length).toBe(upstreamCalls);

    // ...so disconnecting afterwards still clears and revokes it.
    const disconnect = await POST(
      new NextRequest(`${env.APP_URL}/va-account/oauth/ratings/disconnect`, {
        method: "POST",
        headers: { origin: env.APP_URL, cookie: `${accountCookieName("ratings")}=${handle}` },
      }),
      args("disconnect"),
    );
    expect(disconnect.headers.get("location")).toBe(`${env.APP_URL}/va-account?notice=disconnected`);
    expect(await readAccountSession(config, store, handle)).toBeNull();
  });
});
