import "server-only";

import { createHash } from "node:crypto";

export const VA_ACCOUNT_SERVICES = ["ratings", "claims"] as const;
export type VaAccountService = (typeof VA_ACCOUNT_SERVICES)[number];
export type AccountEnv = Record<string, string | undefined>;

// Official provider registry + ACG discovery, verified October 4, 2026.
// No production endpoint override exists in this phase.
const SERVICES = {
  ratings: {
    label: "Disability rating summary",
    authPath: "/oauth2/veteran-verification/v1",
    issuer: "https://deptva-eval.okta.com/oauth2/aus7y0sefudDrg2HI2p7",
    scope: "disability_rating_summary.read",
    apiPath: "/services/veteran_verification/v2/summary/disability_rating",
    envPrefix: "VA_ACCOUNT_RATINGS",
  },
  claims: {
    label: "Claim status",
    authPath: "/oauth2/claims/v1",
    issuer: "https://deptva-eval.okta.com/oauth2/aus7y0lyttrObgW622p7",
    scope: "claim.read",
    apiPath: "/services/claims/v1/claims",
    envPrefix: "VA_ACCOUNT_CLAIMS",
  },
} as const;

export const ACCOUNT_SESSION_SECONDS = 30 * 60;
export const ACCOUNT_TRANSACTION_SECONDS = 5 * 60;
/**
 * Where the single-use login binding cookie lives.
 *
 * The authorization request sends VA `config.callbackUrl` — the canonical
 * `/va-account/oauth/<service>/callback` — while the restricted-API adapter
 * keeps its own `/api/auth/callback`. Those subtrees share no narrower prefix,
 * so a path scoped to one of them is never sent to the other and the callback
 * fails with a missing binding (Heal s1-api-login-never-connects-claims-1).
 * The cookie is HttpOnly, single-use, and expires in five minutes; `/` is the
 * only path that lets either reviewed callback complete the flow.
 */
export const ACCOUNT_TRANSACTION_COOKIE_PATH = "/";
export const ACCOUNT_HTTP_TIMEOUT_MS = 4_000;
export const ACCOUNT_ORIGIN = "https://sandbox-api.va.gov";

export interface VaAccountConfig {
  service: VaAccountService;
  label: string;
  appOrigin: string;
  callbackUrl: string;
  authorizationUrl: string;
  tokenUrl: string;
  keysUrl: string;
  revocationUrl: string;
  apiUrl: string;
  issuer: string;
  scope: string;
  clientId: string;
  clientSecret?: string;
  authMethod: "none" | "client_secret_basic";
  encryptionSecret: string;
  fingerprint: string;
}

export function parseAccountService(value: string): VaAccountService | null {
  return VA_ACCOUNT_SERVICES.find((service) => service === value) ?? null;
}

export function accountAppOrigin(env: AccountEnv = process.env): string | null {
  try {
    const url = new URL(env.APP_URL ?? "");
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function loadVaAccountConfig(
  service: VaAccountService,
  env: AccountEnv = process.env,
): VaAccountConfig | null {
  if (env.VA_ACCOUNT_SANDBOX_ENABLED !== "true" || env.VA_ACCOUNT_ENV !== "sandbox") return null;
  const appOrigin = accountAppOrigin(env);
  const encryptionSecret = env.VA_ACCOUNT_SESSION_SECRET;
  const details = SERVICES[service];
  const clientId = env[`${details.envPrefix}_CLIENT_ID`]?.trim();
  const authMethod = env[`${details.envPrefix}_AUTH_METHOD`] ?? "none";
  const clientSecret = env[`${details.envPrefix}_CLIENT_SECRET`]?.trim();
  if (!appOrigin || !encryptionSecret || encryptionSecret.length < 32 || !clientId || clientId.length > 256) return null;
  if (authMethod !== "none" && authMethod !== "client_secret_basic") return null;
  if (authMethod === "client_secret_basic" && !clientSecret) return null;
  // An accidentally supplied secret cannot silently be ignored for a public client.
  if (authMethod === "none" && clientSecret) return null;
  const callbackUrl = `${appOrigin}/va-account/oauth/${service}/callback`;
  const authBase = `${ACCOUNT_ORIGIN}${details.authPath}`;
  const fingerprint = createHash("sha256")
    .update(JSON.stringify([service, appOrigin, clientId, authMethod, clientSecret ?? "", details.scope]))
    .digest("hex");
  return {
    service,
    label: details.label,
    appOrigin,
    callbackUrl,
    authorizationUrl: `${authBase}/authorization`,
    tokenUrl: `${authBase}/token`,
    keysUrl: `${authBase}/keys`,
    revocationUrl: `${authBase}/revoke`,
    apiUrl: `${ACCOUNT_ORIGIN}${details.apiPath}`,
    issuer: details.issuer,
    scope: details.scope,
    clientId,
    clientSecret: authMethod === "client_secret_basic" ? clientSecret : undefined,
    authMethod,
    encryptionSecret,
    fingerprint,
  };
}

export function accountCookieName(service: VaAccountService): string {
  return `va-account-${service}`;
}

export function accountTransactionCookieName(service: VaAccountService): string {
  return `va-account-login-${service}`;
}

export function accountCookieSecure(config: VaAccountConfig): boolean {
  return config.appOrigin.startsWith("https:");
}

/** Route Handlers need their own CSRF check; action IDs are not authorization. */
export function isSameOriginAccountPost(request: Request, config: VaAccountConfig): boolean {
  return request.method === "POST" &&
    request.headers.get("origin") === config.appOrigin &&
    new URL(request.url).origin === config.appOrigin;
}
