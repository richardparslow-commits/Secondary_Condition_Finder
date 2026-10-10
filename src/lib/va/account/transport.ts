import "server-only";

import { type AccountEnv, type VaAccountConfig } from "./config";
import { accountDemoFixtureResponse } from "./demo-fixtures";

/**
 * The single outbound call site for the sandbox account flow.
 *
 * `oauth.ts` (token, JWKS, revocation) and `client.ts` (the credentialed read)
 * used to call `fetch` themselves. They call this instead, for two reasons:
 *
 *   1. **One reviewed egress point.** `tests/phi-logging-boundary.test.ts` keeps
 *      an inventory of every module that can make an outbound call. Moving the
 *      seam to four call sites would have left that inventory describing modules
 *      that no longer reach the network, so the account flow now has exactly one
 *      place to review — and a bare `fetch` reappearing in `oauth.ts` or
 *      `client.ts` fails that test rather than passing unnoticed.
 *   2. **The demo seam is a delegation, not a fork.** With the fixture gate
 *      closed this performs the real call. With it open, the synthetic provider
 *      answers the configured VA URLs and every other URL still goes out, so the
 *      store, the reference cache, and anything future keep their own paths.
 *
 * The gate is evaluated per call rather than captured when the transport is
 * built, so a process that changes the flag between requests cannot be holding a
 * stale decision.
 */
export function accountTransport(
  config: VaAccountConfig,
  env: AccountEnv = process.env,
): typeof fetch {
  return async (input, init) => {
    const fixture = await accountDemoFixtureResponse(config, env, input, init);
    if (fixture) return fixture;
    return fetch(input, init);
  };
}

/**
 * Demo-only bridge for the OAuth transaction nonce, re-exported so the
 * authorization module has a single account-transport import and never names the
 * fixture module. It is a no-op unless the gate is open.
 */
export { rememberDemoNonce } from "./demo-fixtures";
