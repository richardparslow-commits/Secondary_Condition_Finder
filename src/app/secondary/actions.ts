"use server";

import { redirect } from "next/navigation";

import { loadConditionCatalog } from "@/lib/catalog/load";
import {
  parseDiagnosedSelection,
  parseDocumentsSelection,
  parseRatingsSelection,
  parseServiceConnectedSelection,
  type QueryParams,
} from "@/lib/secondary-workflow/state";
import {
  clearSecondaryWorkflowSession,
  readSecondaryWorkflowSession,
  workflowSessionToQueryParams,
  writeSecondaryWorkflowSession,
} from "@/lib/secondary-workflow/session";

function appendFormData(params: QueryParams, formData: FormData): QueryParams {
  const next: QueryParams = { ...params };
  const keys = new Set<string>();

  for (const [key] of formData.entries()) keys.add(key);

  for (const key of keys) {
    const values = formData
      .getAll(key)
      .filter((value): value is string => typeof value === "string");
    if (values.length === 1) next[key] = values[0];
    if (values.length > 1) next[key] = values;
  }

  return next;
}

export async function saveDiagnosedSelection(formData: FormData): Promise<void> {
  const catalog = loadConditionCatalog();
  const parsed = parseDiagnosedSelection(appendFormData({}, formData), catalog);

  await writeSecondaryWorkflowSession({
    diagnosedConditionIds: parsed.diagnosedConditionIds,
  });

  redirect("/secondary/service-connected");
}

export async function saveServiceConnectedSelection(formData: FormData): Promise<void> {
  const catalog = loadConditionCatalog();
  const current = await readSecondaryWorkflowSession();
  const parsed = parseServiceConnectedSelection(
    appendFormData(workflowSessionToQueryParams(current), formData),
    catalog,
  );

  await writeSecondaryWorkflowSession({
    diagnosedConditionIds: parsed.diagnosedConditionIds,
    serviceConnectedConditionIds: parsed.serviceConnectedConditionIds,
    ratingsByConditionId: {},
  });

  redirect("/secondary/ratings");
}

export async function saveRatingsSelection(formData: FormData): Promise<void> {
  const catalog = loadConditionCatalog();
  const current = await readSecondaryWorkflowSession();
  const parsed = parseRatingsSelection(
    appendFormData(workflowSessionToQueryParams(current), formData),
    catalog,
  );

  await writeSecondaryWorkflowSession({
    diagnosedConditionIds: parsed.diagnosedConditionIds,
    serviceConnectedConditionIds: parsed.serviceConnectedConditionIds,
    ratingsByConditionId: parsed.ratingsByConditionId,
  });

  redirect("/secondary/upload");
}

export async function saveDocumentsSelection(formData: FormData): Promise<void> {
  const catalog = loadConditionCatalog();
  const current = await readSecondaryWorkflowSession();
  const parsed = parseDocumentsSelection(
    appendFormData(workflowSessionToQueryParams(current), formData),
    catalog,
  );

  await writeSecondaryWorkflowSession(parsed);
  redirect("/secondary/suggestions");
}

export async function finishSecondaryWorkflow(): Promise<void> {
  await clearSecondaryWorkflowSession();
  redirect("/secondary");
}

export async function restartSecondaryWorkflow(): Promise<void> {
  await clearSecondaryWorkflowSession();
  redirect("/secondary/diagnosed");
}
