"use server";

import { redirect } from "next/navigation";

import { auditLog } from "@/lib/observability/audit";
import { loadExposureCatalog } from "@/lib/presumptive/load";
import { listLocations, serviceHistorySchema } from "@/lib/presumptive/match";
import { clearPresumptiveSession, writePresumptiveSession } from "@/lib/presumptive/session";

export async function clearServiceHistory(): Promise<void> {
  await clearPresumptiveSession();
  redirect("/presumptive");
}

function textValue(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

function validationPath(code: "select-location" | "date-order" | "invalid-date"): string {
  return `/presumptive?error=${code}`;
}

/**
 * Save service branch, location, and date information for presumptive eligibility.
 *
 * Form fields: `serviceBranchCode` (string|string[]), `location` (string|string[]),
 * `serviceStart` (ISO date), `serviceEnd` (ISO date, must be after start).
 * Success: redirect to /presumptive/results.
 * Errors: select-location, date-order, invalid-date (via ?error= on /presumptive).
 * See docs/api-specification.md for full contract.
 */
export async function saveServiceHistory(formData: FormData): Promise<void> {
  const parsed = serviceHistorySchema.safeParse({
    serviceBranchCodes: formData
      .getAll("serviceBranchCode")
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean),
    locations: formData
      .getAll("location")
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean),
    serviceStart: textValue(formData, "serviceStart"),
    serviceEnd: textValue(formData, "serviceEnd"),
  });

  if (!parsed.success) {
    const issues = parsed.error.issues;
    if (issues.some((issue) => issue.path[0] === "locations")) {
      redirect(validationPath("select-location"));
    }
    if (issues.some((issue) => issue.path[0] === "serviceEnd" && issue.code === "custom")) {
      redirect(validationPath("date-order"));
    }
    redirect(validationPath("invalid-date"));
  }

  // Server-side membership allowlist: only authored catalog locations may be
  // stored. The schema alone accepts any 1-120 character string, so without
  // this check a client could persist arbitrary text into the encrypted
  // workflow cookie and drive matching against non-catalog values.
  const knownLocations = new Set(listLocations(loadExposureCatalog()));
  if (parsed.data.locations.some((location) => !knownLocations.has(location))) {
    auditLog("presumptive-service-history-saved", {
      status: "failure",
      route: "/presumptive",
    });
    redirect(validationPath("select-location"));
  }

  await writePresumptiveSession(parsed.data);
  auditLog("presumptive-service-history-saved", {
    status: "success",
    route: "/presumptive/results",
    count: parsed.data.locations.length,
  });
  redirect("/presumptive/results");
}
