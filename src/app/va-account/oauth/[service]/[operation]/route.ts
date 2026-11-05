import { NextRequest, NextResponse } from "next/server";

import {
  ACCOUNT_SESSION_SECONDS, ACCOUNT_TRANSACTION_COOKIE_PATH, ACCOUNT_TRANSACTION_SECONDS, accountCookieName,
  accountCookieSecure, accountTransactionCookieName, isSameOriginAccountPost,
  loadVaAccountConfig, parseAccountService,
} from "@/lib/va/account/config";
import { completeAccountLogin, disconnectAccount, startAccountLogin } from "@/lib/va/account/oauth";
import { loadAccountStore } from "@/lib/va/account/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PRIVATE = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer" };
type Context = { params: Promise<{ service: string; operation: string }> };

async function context(request: NextRequest, args: Context) {
  const params = await args.params;
  const service = parseAccountService(params.service);
  const config = service ? loadVaAccountConfig(service) : null;
  const store = config ? loadAccountStore(config) : null;
  if (!config || !store || new URL(request.url).origin !== config.appOrigin) return null;
  return { config, store, operation: params.operation };
}

function notice(origin: string, code: string) {
  return NextResponse.redirect(`${origin}/va-account?notice=${code}`, { status: 303, headers: PRIVATE });
}

async function consented(request: NextRequest): Promise<boolean> {
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded") || !request.body) return false;
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1024) { await reader.cancel(); return false; }
      chunks.push(value);
    }
    const params = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
    return params.getAll("consent").length === 1 && params.get("consent") === "sandbox-read-only";
  } finally { reader.releaseLock(); }
}

export async function POST(request: NextRequest, args: Context) {
  const ctx = await context(request, args);
  if (!ctx) return NextResponse.json({ error: "Sandbox connection is disabled or unconfigured." }, { status: 503, headers: PRIVATE });
  const { config, store, operation } = ctx;
  if (!isSameOriginAccountPost(request, config)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: PRIVATE });
  if (operation !== "start" && operation !== "disconnect") return NextResponse.json({ error: "Not found." }, { status: 404, headers: PRIVATE });
  try {
    if (operation === "start") {
      if (!await consented(request)) return NextResponse.json({ error: "Explicit sandbox read-only consent required." }, { status: 400, headers: PRIVATE });
      // Starting a replacement must not disturb the live connection. The old
      // session stays readable while the visitor is at VA, and only a completed
      // callback replaces it. Clearing the handle here ended a working
      // connection whenever the visitor abandoned the VA page (Heal
      // s6-abandoned-reconnect-drops-connection-1).
      const login = await startAccountLogin(config, store);
      // Return the authorization navigation URL, not a cross-origin fetch/form
      // redirect: connect-src/form-action remain 'self' under the global CSP.
      const response = NextResponse.json({ authorizationUrl: login.url }, { headers: PRIVATE });
      response.cookies.set(accountTransactionCookieName(config.service), login.binding, {
        httpOnly: true, secure: accountCookieSecure(config), sameSite: "lax",
        path: ACCOUNT_TRANSACTION_COOKIE_PATH, maxAge: ACCOUNT_TRANSACTION_SECONDS,
      });
      return response;
    }
    const handle = request.cookies.get(accountCookieName(config.service))?.value;
    const result = handle ? await disconnectAccount(config, store, handle) : { cleared: true, revoked: true };
    const response = notice(config.appOrigin, !result.cleared ? "cleanup-unconfirmed" : result.revoked ? "disconnected" : "revocation-unconfirmed");
    response.cookies.set(accountCookieName(config.service), "", { path: "/va-account", maxAge: 0 });
    response.cookies.set(accountTransactionCookieName(config.service), "", { path: ACCOUNT_TRANSACTION_COOKIE_PATH, maxAge: 0 });
    return response;
  } catch { return notice(config.appOrigin, "unavailable"); }
}

export async function GET(request: NextRequest, args: Context) {
  const ctx = await context(request, args);
  if (!ctx) return NextResponse.json({ error: "Sandbox connection is disabled or unconfigured." }, { status: 503, headers: PRIVATE });
  if (ctx.operation !== "callback") return NextResponse.json({ error: "Method not allowed." }, { status: 405, headers: { ...PRIVATE, Allow: "POST" } });
  const { config, store } = ctx;
  let response: NextResponse;
  try {
    const binding = request.cookies.get(accountTransactionCookieName(config.service))?.value ?? "";
    const oldHandle = request.cookies.get(accountCookieName(config.service))?.value;
    const handle = await completeAccountLogin(config, store, request.nextUrl.searchParams, binding);
    if (oldHandle && oldHandle !== handle && !(await disconnectAccount(config, store, oldHandle)).cleared) {
      // The new login succeeded, but the previous server-side session could not
      // be removed. Keep the existing handle rather than leaving an unreachable
      // old session behind, and revoke the unused replacement below.
      await disconnectAccount(config, store, handle);
      response = notice(config.appOrigin, "unavailable");
    } else {
      response = notice(config.appOrigin, "connected");
      response.cookies.set(accountCookieName(config.service), handle, {
        httpOnly: true, secure: accountCookieSecure(config), sameSite: "strict",
        path: "/va-account", maxAge: ACCOUNT_SESSION_SECONDS,
      });
    }
  } catch { response = notice(config.appOrigin, "connection-failed"); }
  response.cookies.set(accountTransactionCookieName(config.service), "", { path: ACCOUNT_TRANSACTION_COOKIE_PATH, maxAge: 0 });
  return response;
}
