"use server";

import { redirect } from "next/navigation";

import { loadConditionCatalog } from "@/lib/catalog/load";
import {
  MAX_CONTEXT_ITEM_LENGTH,
  MAX_CONTEXT_ITEMS,
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
import {
  secondaryValidationPath,
  type SecondaryValidationCode,
  type SecondaryValidationPath,
} from "@/lib/secondary-workflow/validation";

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

function redirectValidation(
  path: SecondaryValidationPath,
  code: SecondaryValidationCode,
): never {
  redirect(secondaryValidationPath(path, code));
}

function nonEmptyValues(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function contextEntries(formData: FormData, key: string): string[] {
  const value = formData.get(key);
  if (typeof value !== "string") return [];
  return [...new Set(value.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean))];
}

function validateContext(formData: FormData): void {
  for (const key of ["medications", "treatments"] as const) {
    const entries = contextEntries(formData, key);
    if (
      entries.length > MAX_CONTEXT_ITEMS ||
      entries.some((entry) => entry.length > MAX_CONTEXT_ITEM_LENGTH)
    ) {
      redirectValidation("/secondary/upload", "invalid-context");
    }
  }
}

export async function saveDiagnosedSelection(formData: FormData): Promise<void> {
  if (nonEmptyValues(formData, "diagnosed").length === 0) {
    redirectValidation("/secondary/diagnosed", "select-diagnosed");
  }

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
  const knownConditionIds = new Set(catalog.map((condition) => condition.id));
  const diagnosedConditionIds = (current.diagnosedConditionIds ?? []).filter((id) =>
    knownConditionIds.has(id),
  );

  if (diagnosedConditionIds.length === 0) {
    redirectValidation("/secondary/diagnosed", "select-diagnosed");
  }

  const answers = diagnosedConditionIds.map((id) =>
    formData.get(`serviceConnected-${id}`),
  );
  if (answers.some((answer) => answer !== "yes" && answer !== "no")) {
    const serviceConnectedAnswerDraft: Record<string, "yes" | "no"> = {};
    diagnosedConditionIds.forEach((id, index) => {
      const answer = answers[index];
      if (answer === "yes" || answer === "no") {
        serviceConnectedAnswerDraft[id] = answer;
      }
    });
    await writeSecondaryWorkflowSession({
      diagnosedConditionIds,
      serviceConnectedAnswerDraft,
    });
    redirectValidation("/secondary/service-connected", "answer-service-connected");
  }
  if (!answers.some((answer) => answer === "yes")) {
    await writeSecondaryWorkflowSession({
      diagnosedConditionIds,
      serviceConnectedConditionIds: [],
      ratingsByConditionId: {},
    });
    redirectValidation("/secondary/service-connected", "no-service-connected");
  }

  const currentParams = workflowSessionToQueryParams({
    ...current,
    diagnosedConditionIds,
  });
  delete currentParams.serviceConnected;
  const parsed = parseServiceConnectedSelection(
    appendFormData(currentParams, formData),
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
  const serviceConnectedConditionIds = current.serviceConnectedConditionIds ?? [];

  if (serviceConnectedConditionIds.length === 0) {
    redirectValidation("/secondary/service-connected", "no-service-connected");
  }

  for (const id of serviceConnectedConditionIds) {
    const value = formData.get(`rating-${id}`);
    if (typeof value !== "string" || value === "") {
      redirectValidation("/secondary/ratings", "select-rating");
    }
    if (value !== "decline") {
      const rating = Number(value);
      if (!Number.isInteger(rating) || rating < 0 || rating > 100) {
        redirectValidation("/secondary/ratings", "invalid-rating");
      }
    }
  }

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
  const documentsShared = formData.get("documentsShared");
  if (documentsShared !== "yes" && documentsShared !== "no") {
    redirectValidation("/secondary/upload", "select-documents");
  }
  validateContext(formData);

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
