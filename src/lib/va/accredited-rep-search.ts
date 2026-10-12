/**
 * Accredited-representative locator search contract — shared by the Server
 * Action and the client surface that renders its result (audit A01).
 *
 * These live outside `src/lib/actions/accredited-representatives.ts`
 * deliberately: a Server Action module may only export async functions, and its
 * non-function exports do not exist at all in the client graph — Next replaces
 * the module with an action reference, so importing a constant or a type from
 * it type-checks and then answers **500** in the browser. The Forms Finder hit
 * exactly that (see `src/lib/va/forms-finder-search.ts`), which is why the same
 * split is used here rather than rediscovered. The architecture audit also
 * requires the server-action directive to appear only under `src/lib/actions/`,
 * which is another reason this module holds plain values and types rather than
 * an action (and why the directive is described here, never spelled out: the
 * placement rule matches the literal token, comments included).
 */
import type {
  AccreditedRepValidationCode,
} from "./accredited-representative-constants";
import type { AccreditedRepresentativeView } from "./accredited-representatives";

/**
 * Canonical refusal codes for the locator action.
 *
 * The three validation codes come from the module that already owns the
 * locator's vocabulary, so the action and the alert cannot drift apart.
 * `refused` is the PHI-free Server Action contract's own refusal, collapsed to
 * a single code on purpose: the contract reports no detail about what it
 * rejected, because any detail would be a description of the caller's input.
 */
export type AccreditedRepSearchErrorCode = AccreditedRepValidationCode | "refused";

/**
 * Copy shown for any refusal that is not one of the three field validations.
 * Names no submitted value, so the response is not a reflection channel.
 */
export const ACCREDITED_REP_REFUSAL_MESSAGE =
  "That search was not run. The locator accepts only a ZIP code, a radius, and a representative type — never personal or health information.";

/**
 * Action state rendered by the locator component. Plain JSON, safe to return:
 * `view` is the same `AccreditedRepresentativeView` the loader produces, and
 * `error` is a fixed constant — never a submitted value.
 */
export interface AccreditedRepSearchState {
  /**
   * `null` until a search has run, and after any refused search: a refusal
   * must not leave the previous result on screen as if it answered the new
   * request.
   */
  view: AccreditedRepresentativeView | null;
  error: AccreditedRepSearchErrorCode | null;
}
