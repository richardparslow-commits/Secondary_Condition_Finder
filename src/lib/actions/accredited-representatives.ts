"use server";

import { redirect } from "next/navigation";

import { auditLog } from "@/lib/observability/audit";

function validationPath(code: string): string {
  return `/secondary/suggestions?error=${encodeURIComponent(code)}`;
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
  const returnTo = textValue(formData, "returnTo") ?? "/secondary/suggestions";

  if (!zip || !/^\d{5}$/.test(zip)) {
    redirect(`${returnTo}?error=invalid-zip`);
  }

  const allowedRadii = new Set(["25", "50", "100"]);
  if (radiusRaw && !allowedRadii.has(radiusRaw)) {
    redirect(validationPath("invalid-radius"));
  }
  const allowedTypes = new Set(["VSO", "agent", "attorney"]);
  if (typeRaw && !allowedTypes.has(typeRaw)) {
    redirect(validationPath("invalid-type"));
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
