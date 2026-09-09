"use server";

import { redirect } from "next/navigation";

import { auditLog } from "@/lib/observability/audit";
import { serviceHistorySchema } from "@/lib/presumptive/match";
import { writePresumptiveSession } from "@/lib/presumptive/session";

function textValue(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

function validationPath(code: "select-location" | "date-order" | "invalid-date"): string {
  return `/presumptive?error=${code}`;
}

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

  await writePresumptiveSession(parsed.data);
  auditLog("presumptive-service-history-saved", {
    status: "success",
    route: "/presumptive/results",
    count: parsed.data.locations.length,
  });
  redirect("/presumptive/results");
}
