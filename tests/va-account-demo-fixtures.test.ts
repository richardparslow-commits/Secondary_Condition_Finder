import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/va-account/oauth/[service]/[operation]/route";
import {
  accountCookieName,
  accountTransactionCookieName,
  loadVaAccountConfig,
  type VaAccountConfig,
} from "@/lib/va/account/config";
import { loadAccountData, ratingSummarySchema } from "@/lib/va/account/data";
import {
  ACCOUNT_DEMO_FAULTS,
  ACCOUNT_DEMO_KEY_ID,
  ACCOUNT_DEMO_SUBJECT,
  accountDemoFixtureResponse,
  accountDemoFixturesEnabled,
  clearAccountDemoState,
  parseAccountDemoFault,
} from "@/lib/va/account/demo-fixtures";
import { completeAccountLogin, readAccountSession, startAccountLogin } from "@/lib/va/account/oauth";
import { createMemoryAccountStore, loadAccountStore } from "@/lib/va/account/store";
import { accountTransport } from "@/lib/va/account/transport";
import { callVaApi } from "@/lib/va/client";

/**
 * Contracts for the sandbox demo fixture seam.
 *
 * Two properties carry the weight here, and neither is about the fixture's
 * convenience:
 *
 *   1. **The gate fails closed.** Synthetic veteran data is only ever served to
 *      a non-distributed runtime that explicitly opted in, so a hosted or
 *      production deployment refuses regardless of configuration.
 *   2. **The real flow still runs.** Every test below drives the production
 *      authorization, session, read and revocation code; only the provider's
 *      responses are synthetic. The room is therefore wrong for a test that
 *      asserts the fixture's own behaviour in isolation from those paths.
 */

const secret = "demo-fixture-encryption-secret-32-plus-characters";

let nextPort = 3300;
/**
 * A distinct port per test. The configuration fingerprint covers the app
 * origin, so this isolates each test's account keys — and with them the
 * single-flight login budget (a two-second TTL) and any stored 429 cooldown,
 * which would otherwise leak between tests that share a service.
 */
function demoEnv(overrides: Record<string, string> = {}): Record<string, string> {
  nextPort += 1;
  return {
    VA_ACCOUNT_SANDBOX_ENABLED: "true",
    VA_ACCOUNT_ENV: "sandbox",
    VA_ACCOUNT_SESSION_SECRET: secret,
    APP_URL: `http://localhost:${nextPort}`,
    VA_ACCOUNT_RATINGS_CLIENT_ID: "demo-ratings-client",
    VA_ACCOUNT_CLAIMS_CLIENT_ID: "demo-claims-client",
    VA_ACCOUNT_LOCAL_ONLY: "true",
    NODE_ENV: "test",
    VA_ACCOUNT_DEMO_FIXTURES: "true",
    ...overrides,
  };
}

function configure(env: Record<string, string>): void {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
}

const args = (service: string, operation: string) => ({
  params: Promise.resolve({ service, operation }),
});

afterEach(() => {
  clearAccountDemoState();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("demo fixture gate", () => {
  it("is closed unless the flag is exactly true and the runtime is not distributed", () => {
    expect(accountDemoFixturesEnabled({})).toBe(false);
    // Any other spelling is a different value, not a truthy one.
    for (const value of ["1", "TRUE", "True", "yes", "true ", " true"]) {
      expect(accountDemoFixturesEnabled({ VA_ACCOUNT_DEMO_FIXTURES: value })).toBe(false);
    }
    expect(accountDemoFixturesEnabled({ VA_ACCOUNT_DEMO_FIXTURES: "true" })).toBe(true);
  });

  it("refuses every runtime the shared fact calls distributed, even when opted in", () => {
    const optedIn = { VA_ACCOUNT_DEMO_FIXTURES: "true" };
    // Production is refused through the runtime classification rather than a
    // private check, so this cannot disagree with the store and cache.
    expect(accountDemoFixturesEnabled({ ...optedIn, NODE_ENV: "production" })).toBe(false);
    for (const marker of ["VERCEL", "AWS_LAMBDA_FUNCTION_NAME", "FUNCTIONS_WORKER_RUNTIME", "K_SERVICE"]) {
      expect(accountDemoFixturesEnabled({ ...optedIn, [marker]: "1" }), marker).toBe(false);
    }
  });

  it("answers nothing and delegates to the real transport when the gate is closed", async () => {
    const config = { keysUrl: "https://sandbox-api.va.gov/keys" } as VaAccountConfig;
    // With the gate closed the provider has no answer at all...
    expect(await accountDemoFixtureResponse(config, {}, config.keysUrl)).toBeNull();

    // ...and the account flow's single egress point performs the real call.
    const real = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", real);
    const response = await accountTransport(config, {})(config.keysUrl);

    expect(response.status).toBe(200);
    expect(real).toHaveBeenCalledTimes(1);
  });

  it("answers only the configured VA endpoints, never the store's host", async () => {
    const env = demoEnv();
    const config = loadVaAccountConfig("ratings", env)!;

    expect(await accountDemoFixtureResponse(config, env, config.apiUrl)).not.toBeNull();
    // The session store is the application's infrastructure, not VA's: a URL that
    // is not one of the four provider endpoints must fall through to the network.
    expect(await accountDemoFixtureResponse(config, env, "https://store.test/command")).toBeNull();
  });

  it("treats an unrecognized fault name as no fault rather than an open field", () => {
    expect(ACCOUNT_DEMO_FAULTS).toContain("none");
    expect(parseAccountDemoFault(undefined)).toBe("none");
    expect(parseAccountDemoFault("600")).toBe("none");
    expect(parseAccountDemoFault("invalid-payload")).toBe("invalid-payload");
    expect(parseAccountDemoFault("429")).toBe("429");
  });
});

describe("synthetic provider over the real authorization flow", () => {
  it("completes PKCE, session, and read end to end with zero real network calls", async () => {
    const env = demoEnv();
    configure(env);
    // Any leak past the seam hits this and fails loudly, so "offline and
    // deterministic" is proven rather than asserted.
    const realFetch = vi.fn(() => {
      throw new Error("the fixture leaked to the real network");
    });
    vi.stubGlobal("fetch", realFetch);

    const config = loadVaAccountConfig("ratings", env)!;
    const store = createMemoryAccountStore(secret);
    const login = await startAccountLogin(config, store);
    const query = new URL(login.url).searchParams;
    expect(query.get("code_challenge_method")).toBe("S256");
    expect(login.url).not.toContain("code_verifier");

    const handle = await completeAccountLogin(
      config,
      store,
      new URLSearchParams({ state: query.get("state")!, code: "demo-code" }),
      login.binding,
    );

    expect(handle).toHaveLength(43);
    expect(await readAccountSession(config, store, handle)).toMatchObject({
      subject: ACCOUNT_DEMO_SUBJECT,
      service: "ratings",
    });

    const data = await loadAccountData(config, store, handle);
    expect(data).toMatchObject({ status: "connected", service: "ratings" });
    if (data.status !== "connected" || data.service !== "ratings") {
      throw new Error("expected a connected ratings read");
    }
    expect(data.data.combined_disability_rating).toBe(70);
    expect(data.data.individual_ratings).toHaveLength(3);
    expect(data.data.individual_ratings?.every((rating) => rating.decision === "Service Connected")).toBe(true);

    expect(realFetch).not.toHaveBeenCalled();
  });

  it("serves the claims shape for the claims service", async () => {
    const env = demoEnv();
    configure(env);
    const config = loadVaAccountConfig("claims", env)!;
    const store = createMemoryAccountStore(secret);
    const login = await startAccountLogin(config, store);
    const handle = await completeAccountLogin(
      config,
      store,
      new URLSearchParams({ state: new URL(login.url).searchParams.get("state")!, code: "demo-code" }),
      login.binding,
    );

    const data = await loadAccountData(config, store, handle);

    expect(data).toMatchObject({ status: "connected", service: "claims" });
    if (data.status !== "connected" || data.service !== "claims") {
      throw new Error("expected a connected claims read");
    }
    expect(data.data).toHaveLength(3);
    expect(data.data.map((claim) => claim.claim_type)).toEqual(["Compensation", "Compensation", "Dependency"]);
  });

  it("invents no condition names or identity fields the schemas do not carry", async () => {
    const env = demoEnv();
    configure(env);
    const config = loadVaAccountConfig("ratings", env)!;
    const store = createMemoryAccountStore(secret);
    const login = await startAccountLogin(config, store);
    const handle = await completeAccountLogin(
      config,
      store,
      new URLSearchParams({ state: new URL(login.url).searchParams.get("state")!, code: "demo-code" }),
      login.binding,
    );

    const data = await loadAccountData(config, store, handle);

    // The rating-summary schema has no field for a condition name or a diagnosis
    // and strips unknown keys, so the fixture must not carry one either: the demo
    // shows three service-connected rating records, and the presenter supplies
    // the scenario's condition names from the script.
    expect(JSON.stringify(data)).not.toMatch(/Tinnitus|PTSD|Knee|diagnostic_text|icn|ICN/i);
    expect(JSON.stringify(data)).not.toMatch(/demo-access-token|demo-refresh-token/);
  });

  it("serves a public JWKS and never private key material", async () => {
    const env = demoEnv();
    const config = loadVaAccountConfig("ratings", env)!;
    const response = await accountDemoFixtureResponse(config, env, config.keysUrl);
    expect(response).not.toBeNull();
    const jwks = (await response!.json()) as { keys: Record<string, unknown>[] };

    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0]).toMatchObject({ kty: "RSA", kid: ACCOUNT_DEMO_KEY_ID, alg: "RS256" });
    // A private component reaching a served document would be the real bug here.
    for (const field of ["d", "p", "q", "dp", "dq", "qi"]) {
      expect(jwks.keys[0][field], field).toBeUndefined();
    }
  });

  it("enforces the nonce against the fixture rather than skipping verification", async () => {
    const env = demoEnv();
    configure(env);
    const config = loadVaAccountConfig("ratings", env)!;
    const store = createMemoryAccountStore(secret);
    const login = await startAccountLogin(config, store);
    const state = new URL(login.url).searchParams.get("state")!;

    // Dropping the bridge means the minted token cannot carry the transaction's
    // nonce. A fixture that bypassed verification would still succeed here.
    clearAccountDemoState();

    await expect(
      completeAccountLogin(config, store, new URLSearchParams({ state, code: "demo-code" }), login.binding),
    ).rejects.toThrow("Sandbox account operation unavailable");
  });
});

describe("injectable upstream faults", () => {
  async function connectedSession(fault: string) {
    const env = demoEnv({ VA_ACCOUNT_DEMO_FAULT: fault });
    configure(env);
    const config = loadVaAccountConfig("ratings", env)!;
    const store = createMemoryAccountStore(secret);
    const login = await startAccountLogin(config, store);
    const handle = await completeAccountLogin(
      config,
      store,
      new URLSearchParams({ state: new URL(login.url).searchParams.get("state")!, code: "demo-code" }),
      login.binding,
    );
    return { env, config, store, handle };
  }

  it.each([
    ["503", "unavailable"],
    ["invalid-payload", "unavailable"],
  ])("reports a %s read as %s and substitutes nothing", async (fault, status) => {
    const { config, store, handle } = await connectedSession(fault);

    const data = await loadAccountData(config, store, handle);

    expect(data).toEqual({ status });
  });

  it("honours a 429 through the account cooldown and does not read again", async () => {
    const { config, store, handle } = await connectedSession("429");

    expect(await loadAccountData(config, store, handle)).toEqual({ status: "rate-limited" });
    // The second call is refused by the stored cooldown, not by the fixture.
    expect(await loadAccountData(config, store, handle)).toEqual({ status: "rate-limited" });
  });

  it("refreshes exactly once on a 401 and reports the connection as ended", async () => {
    const { config, store, handle } = await connectedSession("401");

    expect(await loadAccountData(config, store, handle)).toEqual({ status: "disconnected" });

    // The read reported `disconnected`, which is the unauthenticated state the
    // page renders. The refresh itself succeeded before the replay was rejected,
    // so the survivor is the ROTATED generation — which is what proves exactly
    // one refresh happened and that the replay carried the token it minted.
    //
    // Note the asymmetry this pins rather than hides: the session is erased when
    // the refresh *cannot complete* (see the account suite's "tries exactly one
    // refresh" case), but a signed-in session that is refreshed and then still
    // refused is left in place for the next read. Only 403 clears it here.
    const survivor = await readAccountSession(config, store, handle);
    expect(survivor?.accessToken).toBe("va-account-demo-access-token-rotated");
  });

  it("surfaces a timeout as an unavailable read rather than a hang", async () => {
    const { config, store, handle } = await connectedSession("timeout");

    // A short deadline keeps the assertion fast; the fixture only settles when
    // the caller's own controller aborts, so this exercises the real timeout path.
    const outcome = await callVaApi(config, store, handle, config.apiUrl, ratingSummarySchema, {
      timeoutMs: 50,
    });

    expect(outcome).toEqual({ ok: false, reason: "unavailable", status: null });
  });

  it("reads normally when no fault is injected", async () => {
    const { config, store, handle } = await connectedSession("none");

    expect(await loadAccountData(config, store, handle)).toMatchObject({ status: "connected" });
  });
});

describe("route-level revocation", () => {
  it("revokes at the provider, clears both cookies, and leaves the UI unauthenticated", async () => {
    const env = demoEnv();
    configure(env);
    const service = "ratings";
    const base = `${env.APP_URL}/va-account/oauth/${service}`;

    const start = await POST(
      new NextRequest(`${base}/start`, {
        method: "POST",
        headers: { origin: env.APP_URL, "content-type": "application/x-www-form-urlencoded" },
        body: "consent=sandbox-read-only",
      }),
      args(service, "start"),
    );
    expect(start.status).toBe(200);
    const authorization = new URL((await start.json()).authorizationUrl);
    const binding = start.cookies.get(accountTransactionCookieName(service))!.value;

    const callback = await GET(
      new NextRequest(
        `${base}/callback?state=${authorization.searchParams.get("state")}&code=demo-code`,
        { headers: { cookie: `${accountTransactionCookieName(service)}=${binding}` } },
      ),
      args(service, "callback"),
    );
    expect(callback.headers.get("location")).toBe(`${env.APP_URL}/va-account?notice=connected`);
    const handle = callback.cookies.get(accountCookieName(service))!.value;
    expect(handle).toHaveLength(43);

    const config = loadVaAccountConfig(service, env)!;
    const store = loadAccountStore(config, env)!;
    expect(await readAccountSession(config, store, handle)).not.toBeNull();

    const disconnect = await POST(
      new NextRequest(`${base}/disconnect`, {
        method: "POST",
        headers: { origin: env.APP_URL, cookie: `${accountCookieName(service)}=${handle}` },
      }),
      args(service, "disconnect"),
    );

    // `disconnected` is only reported when the provider accepted the revocation,
    // so this proves the tokens were revoked rather than merely forgotten.
    expect(disconnect.status).toBe(303);
    expect(disconnect.headers.get("location")).toBe(`${env.APP_URL}/va-account?notice=disconnected`);
    const cleared = disconnect.headers.get("set-cookie") ?? "";
    expect(cleared).toContain(`${accountCookieName(service)}=`);
    expect(cleared).toContain(`${accountTransactionCookieName(service)}=`);
    expect(cleared.match(/Max-Age=0/gi)?.length).toBeGreaterThanOrEqual(2);
    // The unauthenticated state is the absence of a readable session.
    expect(await readAccountSession(config, store, handle)).toBeNull();
  });

  it("refuses a cross-origin revocation without touching the session", async () => {
    const env = demoEnv();
    configure(env);
    const service = "ratings";
    const config = loadVaAccountConfig(service, env)!;
    const store = loadAccountStore(config, env)!;

    const response = await POST(
      new NextRequest(`${env.APP_URL}/va-account/oauth/${service}/disconnect`, {
        method: "POST",
        headers: { origin: "https://evil.test" },
      }),
      args(service, "disconnect"),
    );

    expect(response.status).toBe(403);
    await expect(store.read("session:ratings:anything")).resolves.toBeNull();
  });
});
