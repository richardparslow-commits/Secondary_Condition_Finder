import { NextRequest, NextResponse } from "next/server";

import {
  ACCOUNT_SESSION_SECONDS,
  ACCOUNT_TRANSACTION_COOKIE_PATH,
  accountCookieName,
  accountCookieSecure,
  accountTransactionCookieName,
  loadVaAccountConfig,
} from "@/lib/va/account/config";
import { completeAccountLogin } from "@/lib/va/account/oauth";
import { loadAccountStore } from "@/lib/va/account/store";

/**
 * Restricted-API authorization callback: a thin adapter over the reviewed
 * sandbox account flow, not a second OAuth implementation.
 *
 * `GET /api/auth/callback?code=…&state=…` redeems the authorization code by
 * delegating to `completeAccountLogin`, which performs every security check
 * in one reviewed place:
 *
 * - the incoming `state` must exactly match the stored transaction (CSRF
 *   block — a mismatch fails closed, including a missing binding cookie);
 * - the transaction is consumed single-use, so a replayed callback or a
 *   back-button resubmission cannot redeem twice;
 * - a VA `error` parameter (e.g. the veteran denied consent) aborts the
 *   exchange before any token call;
 * - the code is exchanged with the stored S256 `code_verifier`;
 * - the returned `id_token` is verified against the provider JWKS (issuer,
 *   audience, subject, nonce) and the granted scopes are allowlisted.
 *
 * Outcomes are 303 redirects with notice codes, never raw server errors, and
 * no token, code, or upstream document ever reaches a response body or log:
 *
 * - success → session handle cookie (HttpOnly, Secure, SameSite=Strict) +
 *   redirect to `SUCCESS_PATH`;
 * - any failure → redirect to `FAILURE_PATH`.
 *
 * The temporary transaction cookie is cleared on every path. The session
 * cookie intentionally reuses the existing flow's name and `/va-account`
 * path, so both entry points produce byte-identical session artifacts and no
 * client ever holds two same-named handles.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
};

/** Where a connected veteran lands; repoint when the claims dashboard exists. */
const SUCCESS_PATH = "/va-account?notice=connected";
/** Where every failed or denied callback lands; the code carries no detail. */
const FAILURE_PATH = "/va-account?notice=connection-failed";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = loadVaAccountConfig("claims");
  const store = config ? loadAccountStore(config) : null;
  if (!config || !store || new URL(request.url).origin !== config.appOrigin) {
    return NextResponse.json(
      { error: "Sandbox connection is disabled or unconfigured." },
      { status: 503, headers: PRIVATE },
    );
  }
  const binding = request.cookies.get(accountTransactionCookieName(config.service))?.value ?? "";
  let response: NextResponse;
  try {
    const handle = await completeAccountLogin(config, store, request.nextUrl.searchParams, binding);
    response = NextResponse.redirect(new URL(SUCCESS_PATH, config.appOrigin), {
      status: 303,
      headers: PRIVATE,
    });
    response.cookies.set(accountCookieName(config.service), handle, {
      httpOnly: true,
      secure: accountCookieSecure(config),
      sameSite: "strict",
      path: "/va-account",
      maxAge: ACCOUNT_SESSION_SECONDS,
    });
  } catch {
    response = NextResponse.redirect(new URL(FAILURE_PATH, config.appOrigin), {
      status: 303,
      headers: PRIVATE,
    });
  }
  response.cookies.set(accountTransactionCookieName(config.service), "", {
    path: ACCOUNT_TRANSACTION_COOKIE_PATH,
    maxAge: 0,
  });
  return response;
}
