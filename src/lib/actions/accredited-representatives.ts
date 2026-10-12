"use server";

import { z } from "zod";

import { auditLog } from "@/lib/observability/audit";
import {
  findPhiInputField,
  phiFreeActionInput,
  sanitizeActionInput,
} from "@/lib/security/phi-free-action-input";
import {
  ACCREDITED_REP_TYPE_VALUES,
  APPROVED_RADIUS_MILES,
  ZIP_RE,
  type AccreditedRepType,
} from "@/lib/va/accredited-representative-constants";
import { loadAccreditedRepresentatives } from "@/lib/va/accredited-representatives";
import type { AccreditedRepSearchState } from "@/lib/va/accredited-rep-search";

/**
 * Accredited-representative locator search — audit A01.
 *
 * The locator used to **redirect** with `{returnTo}?zip=&radiusMiles=&type=`, so
 * the ZIP a visitor typed was written into the address bar, browser history, any
 * copied or shared link, and the hosting/edge request line for the navigation.
 * A ZIP is a quasi-identifier and its low-entropy value is also enumerable in a
 * shared cache, so "the lookup is public directory data" was never the same
 * property as "the ZIP does not appear in a URL".
 *
 * This action returns the directory view as **action state** instead. The page
 * URL stays `/secondary/suggestions`, `/secondary/evidence`, or
 * `/presumptive/results` with no lookup query on every interaction, nothing is
 * redirected with the lookup, and the browser records no history entry carrying
 * it. The loader still sends the ZIP upstream to the VA accredited-representative
 * directory when live access is explicitly enabled (that is the upstream
 * contract and is not closable here), and host/CDN log retention for whichever
 * requests the operator runs remains an operator review — so this narrows the
 * exposure, it does not eliminate every copy of the ZIP.
 *
 * Input goes through the PHI-free Server Action contract
 * (`src/lib/security/phi-free-action-input.ts`): a PHI-shaped field name or an
 * oversized value is refused with a canonical code and never echoed back. The
 * whole POST body is checked for PHI-shaped names, not just the fields read
 * below, because an action is a public entrypoint and a crafted submit can add
 * keys. `zip` is the one quasi-identifier the locator legitimately accepts —
 * it is the query for a public directory lookup, and it is deliberately absent
 * from the contract's PHI name list for that reason (pinned by
 * `tests/phi-logging-boundary.test.ts`), still never emitted to a log sink.
 *
 * `returnTo` survives as an allowlisted **audit label only**: it is never used
 * to build a URL, and it stays allowlisted because the value reaches a log sink
 * (`route`). A hidden input is not a trust boundary, so an unvalidated value
 * would write attacker text into the audit log.
 *
 * Only the async action is exported here; the refusal copy and the state type
 * live in `src/lib/va/accredited-rep-search.ts`.
 */

const ALLOWED_RETURN_PATHS = [
  "/secondary/suggestions",
  "/secondary/evidence",
  "/presumptive/results",
] as const;
const DEFAULT_RETURN_PATH = "/secondary/suggestions";

function safeReturnPath(raw: string): string {
  return (ALLOWED_RETURN_PATHS as readonly string[]).includes(raw)
    ? raw
    : DEFAULT_RETURN_PATH;
}

function textValue(formData: FormData, key: string): string {
  const raw = formData.get(key);
  if (typeof raw !== "string") return "";
  return raw.trim();
}

const locatorInputSchema = phiFreeActionInput({
  zip: z.string().max(16),
  radiusMiles: z.string().max(8),
  type: z.string().max(16),
  returnTo: z.string().max(64),
});

/**
 * Runs one directory lookup and returns what the surface should render.
 *
 * `previous` is supplied by `useActionState` and is deliberately unused: a
 * lookup is stateless, and carrying the prior result forward would keep serving
 * a view the visitor did not just ask for.
 */
export async function searchAccreditedRepresentatives(
  previous: AccreditedRepSearchState,
  formData: FormData,
): Promise<AccreditedRepSearchState> {
  void previous;

  if (findPhiInputField(formData.keys())) {
    return { view: null, error: "refused" };
  }

  const input = sanitizeActionInput(locatorInputSchema, {
    zip: textValue(formData, "zip"),
    radiusMiles: textValue(formData, "radiusMiles"),
    type: textValue(formData, "type"),
    returnTo: textValue(formData, "returnTo"),
  });
  if (!input.ok) {
    // `sanitizeActionInput` collapses every schema failure into a canonical
    // code, so nothing from the request is described in the response.
    return { view: null, error: "refused" };
  }

  const { zip, radiusMiles, type } = input.data;
  if (!ZIP_RE.test(zip)) return { view: null, error: "invalid-zip" };

  const radius = radiusMiles ? Number(radiusMiles) : 50;
  if (!(APPROVED_RADIUS_MILES as readonly number[]).includes(radius)) {
    return { view: null, error: "invalid-radius" };
  }
  if (type && !(ACCREDITED_REP_TYPE_VALUES as readonly string[]).includes(type)) {
    return { view: null, error: "invalid-type" };
  }

  const view = await loadAccreditedRepresentatives({
    zip,
    radiusMiles: radius,
    type: type ? (type as AccreditedRepType) : undefined,
  });

  // The audit event carries the page the lookup came from and a count — never
  // the ZIP or any other lookup value.
  auditLog("accredited-rep-search", {
    status: "success",
    route: safeReturnPath(input.data.returnTo),
    count: 1,
  });

  return { view, error: null };
}
