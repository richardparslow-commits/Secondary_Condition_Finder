import { NextRequest, NextResponse } from "next/server";

import {
  ACCOUNT_TRANSACTION_COOKIE_PATH,
  ACCOUNT_TRANSACTION_SECONDS,
  accountCookieSecure,
  accountTransactionCookieName,
  loadVaAccountConfig,
} from "@/lib/va/account/config";
import { startAccountLogin } from "@/lib/va/account/oauth";
import { loadAccountStore } from "@/lib/va/account/store";

/**
 * Restricted-API login entry point: a thin adapter over the reviewed sandbox
 * account flow, not a second OAuth implementation.
 *
 * `GET /api/auth/login` loads the claims-service account config, mints one
 * login transaction (`startAccountLogin`: cryptographically random `state`,
 * S256 PKCE `code_verifier`/`code_challenge`, `nonce`), stores only the
 * transaction *binding* in an HttpOnly cookie, and redirects (303) to the
 * discovery-verified VA authorization URL. The verifier itself never leaves
 * the server store.
 *
 * What this route deliberately does NOT do:
 * - It does not build authorization URLs, challenges, or state by itself —
 *   that logic lives in exactly one place (`account/oauth.ts`), so a fix
 *   there fixes both entry points.
 * - It does not use generic `oauth2/v0/*` endpoints or caller-supplied
 *   scopes: the config registry pins the per-service authorization URL
 *   (`/oauth2/claims/v1/authorization`) and scope (`claim.read`), verified
 *   against VA discovery.
 * - It does not bypass the rate-limit inventory: see `api-route-policies.ts`.
 *
 * A GET login initiator is safe here: completing the flow requires the
 * victim's own VA authentication, and the resulting session handle is set as
 * an HttpOnly cookie on the victim's browser only — an attacker who tricks a
 * browser into starting a login gains no session.
 *
 * Live-registration note: `startAccountLogin` sends the canonical
 * `redirect_uri` (`/va-account/oauth/claims/callback`), so a real VA round
 * trip lands on the existing callback until the VA client registration
 * allows the adapter URL and the authorization call carries it. The adapter
 * callback below is complete and tested, but it only completes flows whose
 * `redirect_uri` pointed at it — wiring that registration is a VA-side step,
 * not a code gap.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = loadVaAccountConfig("claims");
  const store = config ? loadAccountStore(config) : null;
  if (!config || !store || new URL(request.url).origin !== config.appOrigin) {
    return NextResponse.json(
      { error: "Sandbox connection is disabled or unconfigured." },
      { status: 503, headers: PRIVATE },
    );
  }
  try {
    const login = await startAccountLogin(config, store);
    const response = NextResponse.redirect(login.url, { status: 303, headers: PRIVATE });
    // Binding only (a random handle into the server-side transaction, not the
    // verifier). Lax so the top-level navigation to VA and back carries it.
    // The path must cover the callback VA actually redirects to
    // (`/va-account/oauth/claims/callback`), not just this adapter's routes;
    // scoping it to /api/auth silently dropped the binding and every login
    // landed on connection-failed (Heal s1-api-login-never-connects-claims-1).
    // 5-minute TTL bounds the round trip.
    response.cookies.set(
      accountTransactionCookieName(config.service),
      login.binding,
      {
        httpOnly: true,
        secure: accountCookieSecure(config),
        sameSite: "lax",
        path: ACCOUNT_TRANSACTION_COOKIE_PATH,
        maxAge: ACCOUNT_TRANSACTION_SECONDS,
      },
    );
    return response;
  } catch {
    return NextResponse.json(
      { error: "Login could not be started." },
      { status: 503, headers: PRIVATE },
    );
  }
}
