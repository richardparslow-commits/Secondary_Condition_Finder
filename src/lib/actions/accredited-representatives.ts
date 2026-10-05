"use server";

import { redirect } from "next/navigation";

import { auditLog } from "@/lib/observability/audit";

/**
 * Only application routes may be used as a post-action destination. `returnTo`
 * is attacker-controllable form data (a hidden input is not validation), so an
 * unvalidated value would make this action an open redirect and would write
 * attacker text into the audit log.
 */
const ALLOWED_RETURN_PATHS = [
  "/secondary/suggestions",
  "/secondary/evidence",
  "/presumptive/results",
] as const;
const DEFAULT_RETURN_PATH = "/secondary/suggestions";

function safeReturnPath(raw: string | null): string {
  return raw && (ALLOWED_RETURN_PATHS as readonly string[]).includes(raw)
    ? raw
    : DEFAULT_RETURN_PATH;
}

function validationPath(code: string, returnTo: string): string {
  return `${returnTo}?error=${encodeURIComponent(code)}`;
}

function textValue(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

/**
 * Redirect to the suggestions page with accredited representative search params.
 *
 * Form fields: `zip` (5-digit string, required), `radiusMiles` ("25"|"50"|"100"),
 * `type` ("VSO"|"agent"|"attorney"), `returnTo` (default: /secondary/suggestions).
 * Success: redirect to {returnTo}?zip={zip}&radiusMiles={radius}&type={type}.
 * Errors: invalid-zip, invalid-radius, invalid-type.
 * See docs/api-specification.md for full contract.
 */
export async function searchAccreditedRepresentatives(
  formData: FormData,
): Promise<void> {
  const zip = textValue(formData, "zip");
  const radiusRaw = textValue(formData, "radiusMiles");
  const typeRaw = textValue(formData, "type");
  const returnTo = safeReturnPath(textValue(formData, "returnTo"));

  if (!zip || !/^\d{5}$/.test(zip)) {
    redirect(validationPath("invalid-zip", returnTo));
  }

  const allowedRadii = new Set(["25", "50", "100"]);
  if (radiusRaw && !allowedRadii.has(radiusRaw)) {
    redirect(validationPath("invalid-radius", returnTo));
  }
  const allowedTypes = new Set(["VSO", "agent", "attorney"]);
  if (typeRaw && !allowedTypes.has(typeRaw)) {
    redirect(validationPath("invalid-type", returnTo));
  }

  const params = new URLSearchParams();
  params.set("zip", zip);
  if (radiusRaw) params.set("radiusMiles", radiusRaw);
  if (typeRaw) params.set("type", typeRaw);
  // Preserve return context for the GET handler; do not log zip contents as an attribute value.
  auditLog("accredited-rep-search", {
    status: "success",
    route: returnTo,
    count: 1,
  });
  redirect(`${returnTo}?${params.toString()}`);
}
