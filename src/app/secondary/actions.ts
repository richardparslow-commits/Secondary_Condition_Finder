"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";

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

function isExpectedWorkflowValidationError(error: unknown): boolean {
  if (error instanceof ZodError) return true;
  if (!(error instanceof Error)) return false;

  return (
    error.message === "Ratings must be whole numbers from 0 through 100." ||
    error.message.startsWith("Medication context is limited to ") ||
    error.message.startsWith("Medication entries must be ") ||
    error.message.startsWith("Treatment context is limited to ") ||
    error.message.startsWith("Treatment entries must be ")
  );
}

function redirectExpectedValidation(error: unknown, location: string): never {
  if (isExpectedWorkflowValidationError(error)) redirect(location);
  throw error;
}

export async function saveDiagnosedSelection(formData: FormData): Promise<void> {
  const catalog = loadConditionCatalog();
  let parsed: ReturnType<typeof parseDiagnosedSelection>;

  try {
    parsed = parseDiagnosedSelection(appendFormData({}, formData), catalog);
  } catch (error) {
    redirectExpectedValidation(error, "/secondary/diagnosed?error=diagnosed-required");
  }

  await writeSecondaryWorkflowSession({ diagnosedConditionIds: parsed.diagnosedConditionIds });
  redirect("/secondary/service-connected");
}

export async function saveServiceConnectedSelection(formData: FormData): Promise<void> {
  const catalog = loadConditionCatalog();
  const current = await readSecondaryWorkflowSession();
  let parsed: ReturnType<typeof parseServiceConnectedSelection>;

  try {
    parsed = parseServiceConnectedSelection(
      appendFormData(workflowSessionToQueryParams(current), formData),
      catalog,
    );
  } catch (error) {
    redirectExpectedValidation(error, "/secondary/service-connected?error=service-connected-required");
  }

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
  let parsed: ReturnType<typeof parseRatingsSelection>;

  try {
    parsed = parseRatingsSelection(
      appendFormData(workflowSessionToQueryParams(current), formData),
      catalog,
    );
  } catch (error) {
    redirectExpectedValidation(error, "/secondary/ratings?error=invalid-rating");
  }

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
  let parsed: ReturnType<typeof parseDocumentsSelection>;

  try {
    parsed = parseDocumentsSelection(
      appendFormData(workflowSessionToQueryParams(current), formData),
      catalog,
    );
  } catch (error) {
    redirectExpectedValidation(error, "/secondary/upload?error=invalid-context");
  }

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
