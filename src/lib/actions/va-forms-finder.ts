"use server";

import { z } from "zod";

import {
  phiFreeActionInput,
  sanitizeActionInput,
} from "@/lib/security/phi-free-action-input";
import { loadVaFormsFinder } from "@/lib/va/forms-finder";
import {
  FORMS_FINDER_QUERY_MAX_LENGTH,
  type VaFormsFinderSearchState,
} from "@/lib/va/forms-finder-search";

/**
 * Forms Finder search — audit A01.
 *
 * The finder used to be a **GET** form: the text a visitor typed travelled in
 * the request URL, so it landed in the address bar, browser history, any
 * copied/shared link, and the hosting/edge request log for the page load. The
 * identifier guard in `src/lib/va/forms-finder.ts` refuses a whole-input
 * identifier, but it deliberately still allows mixed text (a form keyword next
 * to a pasted number), so "refused obvious identifiers" was never the same as
 * "the free text does not appear in a URL".
 *
 * This action moves submission into the request body. The page URL stays
 * `/va-forms/finder` with no query on every interaction, nothing is redirected
 * with the query, and the browser records no history entry containing it. The
 * loader still sends the query upstream to the VA Forms endpoint as a query
 * parameter when live access is explicitly enabled (that is the upstream
 * contract and is not closable here), and host/CDN log retention for whichever
 * requests the operator runs remains an operator review — so this narrows the
 * exposure, it does not eliminate every copy of the text.
 *
 * Input goes through the PHI-free Server Action contract
 * (`src/lib/security/phi-free-action-input.ts`): a PHI-shaped field name or an
 * oversized value is refused with a canonical code and never echoed back. A
 * refusal returns the default view, so the refusal cannot be used as a channel
 * to read a value out of the server.
 *
 * Only the async action is exported here. The bound, the refusal copy, and the
 * state type live in `src/lib/va/forms-finder-search.ts` because a `"use
 * server"` module has no non-function exports in the client graph.
 */

const finderInputSchema = phiFreeActionInput({
  q: z.string().max(FORMS_FINDER_QUERY_MAX_LENGTH),
});

/**
 * Runs one finder search. `previous` is supplied by `useActionState` and is
 * deliberately unused: a search is stateless, and carrying the prior query
 * forward would keep a copy of it in the rendered state.
 */
export async function searchVaFormsFinder(
  previous: VaFormsFinderSearchState,
  formData: FormData,
): Promise<VaFormsFinderSearchState> {
  void previous;
  const raw = formData.get("q");
  const q = typeof raw === "string" ? raw : "";
  const input = sanitizeActionInput(finderInputSchema, { q });

  if (!input.ok) {
    // `sanitizeActionInput` collapses every schema failure into
    // `phi-shaped-field` because a Zod message can quote the caller's own text.
    // Above the field's own bound the honest code is `oversized-value`, and
    // neither code carries any of the submitted text.
    const refusal =
      q.length > FORMS_FINDER_QUERY_MAX_LENGTH ? "oversized-value" : input.code;
    // Default view only: the refusal path never places the submitted text in
    // the returned state.
    return { view: await loadVaFormsFinder(), refusal };
  }

  // The loader owns identifier refusal and the display bound, so the page and
  // the action share exactly one definition of "searchable text".
  return { view: await loadVaFormsFinder(input.data.q), refusal: null };
}
