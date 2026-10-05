import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";
import { z } from "zod";

import { ACCOUNT_HTTP_TIMEOUT_MS, ACCOUNT_SESSION_SECONDS, ACCOUNT_TRANSACTION_SECONDS, type VaAccountConfig } from "./config";
import { boundedAccountJson, type AccountStore } from "./store";

const random = () => randomBytes(32).toString("base64url");
const digest = (value: string) => createHash("sha256").update(value).digest("base64url");
const handleSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const tokensSchema = z.object({
  access_token: z.string().min(1).max(16_384),
  token_type: z.string().refine((value) => value.toLowerCase() === "bearer"),
  expires_in: z.number().int().positive().max(86_400),
  refresh_token: z.string().min(1).max(16_384).optional(),
  id_token: z.string().min(1).max(32_768).optional(),
  scope: z.string().max(2_000),
});
const transactionSchema = z.object({
  kind: z.literal("transaction"), service: z.string(), fingerprint: z.string(),
  binding: z.string(), verifier: handleSchema, nonce: handleSchema,
  expiresAt: z.number().int(),
});
const sessionSchema = z.object({
  kind: z.literal("session"), service: z.string(), fingerprint: z.string(), subject: z.string().min(1).max(256),
  accessToken: z.string().min(1).max(16_384), refreshToken: z.string().min(1).max(16_384).optional(),
  accessExpiresAt: z.number().int(), expiresAt: z.number().int(),
});
export type AccountSession = z.infer<typeof sessionSchema>;
export class AccountUnavailable extends Error {
  constructor() { super("Sandbox account operation unavailable"); }
}

function constantEqual(left: string, right: string): boolean {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function accountSessionKey(config: VaAccountConfig, handle: string) {
  return `session:${config.service}:${digest(handle)}`;
}
function transactionKey(config: VaAccountConfig, state: string) {
  return `login:${config.service}:${digest(state)}`;
}
function tokenHeaders(config: VaAccountConfig, body: URLSearchParams): Headers {
  const headers = new Headers({ "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" });
  if (config.authMethod === "client_secret_basic") {
    const credential = `${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret!)}`;
    headers.set("Authorization", `Basic ${Buffer.from(credential).toString("base64")}`);
  } else body.set("client_id", config.clientId);
  return headers;
}
async function postTokens(config: VaAccountConfig, body: URLSearchParams) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ACCOUNT_HTTP_TIMEOUT_MS);
  try {
    const response = await fetch(config.tokenUrl, {
      method: "POST", headers: tokenHeaders(config, body), body,
      redirect: "error", cache: "no-store", signal: controller.signal,
    });
    if (!response.ok) throw new AccountUnavailable();
    const parsed = tokensSchema.safeParse(await boundedAccountJson(response, 64 * 1024));
    if (!parsed.success) throw new AccountUnavailable();
    const scopes = new Set(parsed.data.scope.split(/\s+/));
    if (!scopes.has(config.scope) || !scopes.has("openid") || [...scopes].some((scope) => scope.endsWith(".write"))) throw new AccountUnavailable();
    return parsed.data;
  } catch { throw new AccountUnavailable(); }
  finally { clearTimeout(timer); }
}

async function verifyIdentity(config: VaAccountConfig, token: string, nonce?: string, subject?: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ACCOUNT_HTTP_TIMEOUT_MS);
  try {
    const response = await fetch(config.keysUrl, { redirect: "error", cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new AccountUnavailable();
    const json = await boundedAccountJson(response, 64 * 1024);
    const jwks = z.object({ keys: z.array(z.object({ kty: z.literal("RSA"), kid: z.string(), n: z.string(), e: z.string() }).passthrough()).min(1).max(20) }).parse(json);
    const { payload } = await jwtVerify(token, createLocalJWKSet(jwks as JSONWebKeySet), {
      algorithms: ["RS256"], issuer: config.issuer, audience: config.clientId,
      requiredClaims: ["sub", "exp", "iat"], clockTolerance: 5,
    });
    if (typeof payload.sub !== "string" || payload.sub.length > 256 ||
      (nonce !== undefined && payload.nonce !== nonce) ||
      (subject !== undefined && payload.sub !== subject) ||
      (payload.azp !== undefined && payload.azp !== config.clientId) ||
      (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== config.clientId) ||
      typeof payload.iat !== "number" || payload.iat > Date.now() / 1000 + 5) throw new AccountUnavailable();
    return payload.sub;
  } catch { throw new AccountUnavailable(); }
  finally { clearTimeout(timer); }
}

export async function startAccountLogin(config: VaAccountConfig, store: AccountStore) {
  const state = random(); const binding = random(); const verifier = random(); const nonce = random();
  const transaction = {
    kind: "transaction", service: config.service, fingerprint: config.fingerprint,
    binding: digest(binding), verifier, nonce, expiresAt: Date.now() + ACCOUNT_TRANSACTION_SECONDS * 1000,
  };
  if (!await store.put(`login-budget:${config.fingerprint}`, { kind: "budget" }, 2) ||
    !await store.put(transactionKey(config, state), transaction, ACCOUNT_TRANSACTION_SECONDS)) throw new AccountUnavailable();
  const url = new URL(config.authorizationUrl);
  url.search = new URLSearchParams({
    response_type: "code", response_mode: "query", client_id: config.clientId,
    redirect_uri: config.callbackUrl, scope: `openid offline_access ${config.scope}`,
    state, nonce, code_challenge: digest(verifier), code_challenge_method: "S256",
  }).toString();
  return { url: url.toString(), binding };
}

export async function completeAccountLogin(config: VaAccountConfig, store: AccountStore, params: URLSearchParams, binding: string) {
  const state = params.get("state");
  if (!state || params.getAll("state").length !== 1 || !handleSchema.safeParse(state).success || !handleSchema.safeParse(binding).success) throw new AccountUnavailable();
  const key = transactionKey(config, state);
  const observed = transactionSchema.safeParse(await store.read(key));
  if (!observed.success || observed.data.service !== config.service || observed.data.fingerprint !== config.fingerprint ||
    observed.data.expiresAt <= Date.now() || !constantEqual(observed.data.binding, digest(binding))) throw new AccountUnavailable();
  const consumed = transactionSchema.safeParse(await store.consume(key));
  if (!consumed.success || JSON.stringify(consumed.data) !== JSON.stringify(observed.data)) throw new AccountUnavailable();
  const code = params.get("code");
  if (params.has("error") || !code || code.length > 2048 || params.getAll("code").length !== 1) throw new AccountUnavailable();
  const tokens = await postTokens(config, new URLSearchParams({
    grant_type: "authorization_code", code, redirect_uri: config.callbackUrl, code_verifier: consumed.data.verifier,
  }));
  if (!tokens.id_token) throw new AccountUnavailable();
  const subject = await verifyIdentity(config, tokens.id_token, consumed.data.nonce);
  const handle = random();
  const session: AccountSession = {
    kind: "session", service: config.service, fingerprint: config.fingerprint, subject,
    accessToken: tokens.access_token, refreshToken: tokens.refresh_token,
    accessExpiresAt: Date.now() + tokens.expires_in * 1000,
    expiresAt: Date.now() + ACCOUNT_SESSION_SECONDS * 1000,
  };
  if (!await store.put(accountSessionKey(config, handle), session, ACCOUNT_SESSION_SECONDS)) throw new AccountUnavailable();
  return handle;
}

export async function readAccountSession(config: VaAccountConfig, store: AccountStore, handle: string): Promise<AccountSession | null> {
  if (!handleSchema.safeParse(handle).success) return null;
  const key = accountSessionKey(config, handle);
  const parsed = sessionSchema.safeParse(await store.read(key));
  if (!parsed.success || parsed.data.service !== config.service || parsed.data.fingerprint !== config.fingerprint || parsed.data.expiresAt <= Date.now()) return null;
  const session = parsed.data;
  if (session.accessExpiresAt > Date.now() + 30_000) return session;
  // Atomically move to an unreadable refreshing state. A second reader fails
  // closed, and logout deletion prevents CAS from resurrecting the session.
  const refreshing = { kind: "refreshing", fingerprint: config.fingerprint, id: random() };
  const ttl = Math.ceil((session.expiresAt - Date.now()) / 1000);
  if (!await store.replace(key, session, refreshing, ttl)) return null;
  try {
    if (!session.refreshToken) throw new AccountUnavailable();
    const tokens = await postTokens(config, new URLSearchParams({ grant_type: "refresh_token", refresh_token: session.refreshToken }));
    if (tokens.id_token) await verifyIdentity(config, tokens.id_token, undefined, session.subject);
    const renewed = { ...session, accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? session.refreshToken, accessExpiresAt: Date.now() + tokens.expires_in * 1000 };
    const current = await store.read(key);
    if (JSON.stringify(current) !== JSON.stringify(refreshing) || renewed.expiresAt <= Date.now() ||
      !await store.replace(key, refreshing, renewed, Math.ceil((renewed.expiresAt - Date.now()) / 1000))) return null;
    return renewed;
  } catch {
    // Only remove our own refreshing generation; never a replacement owner.
    const current = await store.read(key);
    if (JSON.stringify(current) === JSON.stringify(refreshing)) {
      await store.replace(key, refreshing, { kind: "invalidated" }, 1);
    }
    return null;
  }
}

export async function disconnectAccount(config: VaAccountConfig, store: AccountStore, handle: string) {
  const key = accountSessionKey(config, handle);
  const parsed = sessionSchema.safeParse(await store.read(key));
  if (!await store.remove(key)) return { cleared: false, revoked: false };
  if (!parsed.success) return { cleared: true, revoked: false };
  let revoked = true;
  for (const [hint, token] of [["refresh_token", parsed.data.refreshToken], ["access_token", parsed.data.accessToken]] as const) {
    if (!token) continue;
    const body = new URLSearchParams({ token, token_type_hint: hint });
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), ACCOUNT_HTTP_TIMEOUT_MS);
    try {
      const response = await fetch(config.revocationUrl, { method: "POST", body, headers: tokenHeaders(config, body), redirect: "error", cache: "no-store", signal: controller.signal });
      revoked = response.ok && revoked;
    } catch { revoked = false; }
    finally { clearTimeout(timer); }
  }
  return { cleared: true, revoked };
}
