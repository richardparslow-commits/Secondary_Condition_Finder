"use server";

import { redirect } from "next/navigation";

import {
  ACCREDITED_REP_TYPE_VALUES,
  ACCREDITED_REP_VALIDATION_MESSAGES,
  APPROVED_RADIUS_MILES,
  ZIP_RE,
  type AccreditedRepType,
  type AccreditedRepValidationCode,
} from "@/lib/va/accredited-representative-constants";

function validationRedirect(
  base: string,
  code: AccreditedRepValidationCode,
  search: URLSearchParams,
): never {
  search.set("error", code);
  const qs = search.toString();
  redirect(qs ? `${base}?${qs}` : `${base}?error=${code}`);
}

function isValidRadius(n: unknown): boolean {
  return typeof n === "number" && (APPROVED_RADIUS_MILES as readonly number[]).includes(n);
}

/**
 * Server Action: validates zip/radius/type and redirects back to the
 * originating page with the search as query params (no zip persisted to
 * workflow cookie, no evidence/workflow state sent to VA).
 *
 * Mirrors the saveServiceHistory pattern — validated before any fetch.
 */
export async function searchRepresentatives(formData: FormData): Promise<void> {
  const returnTo = (formData.get("returnTo") as string | null)?.trim() || "/secondary/suggestions";
  // Allow-list return targets so the redirect cannot be abused as open-redirect.
  const allowedPrefixes = ["/secondary/suggestions", "/secondary/evidence", "/presumptive/results"];
  const base = allowedPrefixes.find((p) => returnTo.startsWith(p)) ?? "/secondary/suggestions";

  const zip = (formData.get("zip") as string | null)?.trim() ?? "";
  const radiusRaw = formData.get("radius");
  const typeRaw = (formData.get("type") as string | null)?.trim() ?? "";

  // Preserve existing query params (e.g. regSnapshot) so we don't clobber
  // the regulatory snapshot lock on suggestions/evidence.
  const incoming = new URLSearchParams();
  const existing = formData.get("existingQuery") as string | null;
  if (existing) {
    for (const [k, v] of new URLSearchParams(existing)) {
      if (k !== "zip" && k !== "radius" && k !== "type" && k !== "error") incoming.set(k, v);
    }
  }

  if (!ZIP_RE.test(zip)) {
    validationRedirect(base, "invalid-zip", incoming);
  }

  if (radiusRaw !== null && radiusRaw !== "") {
    const r = Number(radiusRaw);
    if (!Number.isInteger(r) || !isValidRadius(r)) {
      validationRedirect(base, "invalid-radius", incoming);
    }
    incoming.set("radius", String(r));
  }

  if (typeRaw) {
    if (!(ACCREDITED_REP_TYPE_VALUES as readonly string[]).includes(typeRaw)) {
      validationRedirect(base, "invalid-type", incoming);
    }
    incoming.set("type", typeRaw as AccreditedRepType);
  }

  incoming.set("zip", zip);
  incoming.delete("error");

  redirect(`${base}?${incoming.toString()}`);
}
