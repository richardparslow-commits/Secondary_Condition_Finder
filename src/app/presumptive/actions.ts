"use server";

import { redirect } from "next/navigation";

import { serviceHistorySchema } from "@/lib/presumptive/match";
import { writePresumptiveSession } from "@/lib/presumptive/session";

function textValue(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

export async function saveServiceHistory(formData: FormData): Promise<void> {
  const history = serviceHistorySchema.parse({
    locations: formData
      .getAll("location")
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean),
    serviceStart: textValue(formData, "serviceStart"),
    serviceEnd: textValue(formData, "serviceEnd"),
  });

  await writePresumptiveSession(history);
  redirect("/presumptive/results");
}
