/**
 * Forms Finder search contract — shared by the Server Action and the client
 * surface that renders its result (audit A01).
 *
 * These live outside `src/lib/actions/va-forms-finder.ts` deliberately: a
 * Server Action module may only export async functions, and its non-function
 * exports do not exist at all in the client graph. Importing the bound or the
 * refusal copy from the action module compiled, type-checked, and then answered
 * **500** in the browser ("Export … doesn't exist in target module"), because
 * Next replaces the module with an action reference in the client bundle. The
 * unit tests could not see that: they import the action directly and never
 * build the client graph, which is why the split is pinned by a source pin in
 * `tests/va-forms-finder-no-url-exposure.test.ts` and exercised end to end by
 * the action-driven surface the tests mount.
 *
 * The architecture audit requires the server-action directive to appear only
 * under `src/lib/actions/`, which is another reason this module holds plain
 * values and types rather than an action.
 */
import type { VaFormsFinderView } from "./forms-finder";

/**
 * Bound on the search text. Matches the loader's own 120-character slice, so a
 * request cannot carry text longer than the page ever displays.
 */
export const FORMS_FINDER_QUERY_MAX_LENGTH = 120;

/**
 * App bound on one forms view, matching the shared cache DTO ceiling. The
 * loader keeps at most this many matches and the page discloses the bound when
 * it is reached; the previous 25-item cap silently dropped every match past the
 * twenty-fifth on a broad search.
 */
export const VA_FORMS_MAX_ITEMS = 200;

/** Copy shown for any refusal. Names no submitted value. */
export const FORMS_FINDER_REFUSAL_MESSAGE =
  "That search was not run. Search by VA form number, keyword, or title — never enter personal identifiers.";

/**
 * Copy shown when the lookup never reached the server at all (offline, DNS
 * failure, interrupted tunnel). Fixed text for the same reason as the refusal:
 * the request carried search text, and a failure response must not echo it.
 * Without this state the rejected action call reached the route error boundary
 * and replaced the whole finder, typed query included.
 */
export const FORMS_FINDER_UNAVAILABLE_MESSAGE =
  "The search could not run. Check your connection and try again.";

/**
 * Copy shown when the proxy refused the search because its reference-read
 * budget was exhausted. This is deliberately distinct from the offline copy:
 * the request reached the server, was answered 429 with Retry-After, and the
 * visitor should wait rather than diagnose a connection that is working
 * (Heal s7-rate-limited-search-says-check-connection-1).
 */
export const FORMS_FINDER_RATE_LIMITED_MESSAGE =
  "Too many searches were sent. Please wait a moment and try again later.";

/**
 * The proxy returns this exact fixed message as a text/plain 429 for Forms
 * Finder Server Action POSTs. Next's action client surfaces a text/plain error
 * body as the rejection message, so this is the only reliable client-side
 * signal that the rejection was a rate limit rather than a dropped connection.
 */
export function isFormsFinderRateLimitedError(error: unknown): boolean {
  return error instanceof Error && error.message === FORMS_FINDER_RATE_LIMITED_MESSAGE;
}

/** Action state rendered by the finder component. Plain JSON, safe to return. */
export interface VaFormsFinderSearchState {
  view: VaFormsFinderView;
  /**
   * Canonical failure code: `phi-shaped-field` / `oversized-value` when the
   * input was rejected, `rate-limited` when the proxy refused it, `unavailable`
   * when the request never reached the server, `null` on success. A fixed
   * constant — never the submitted text — so the response is not a reflection
   * channel.
   */
  refusal: "phi-shaped-field" | "oversized-value" | "rate-limited" | "unavailable" | null;
}
