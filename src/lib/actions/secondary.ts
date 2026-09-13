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
import { auditLog } from "@/lib/observability/audit";
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
  for (const key of ["medications", "treatments", "history"] as const) {
    const entries = contextEntries(formData, key);
    if (
      entries.length > MAX_CONTEXT_ITEMS ||
      entries.some((entry) => entry.length > MAX_CONTEXT_ITEM_LENGTH)
    ) {
      redirectValidation("/secondary/upload", "invalid-context");
    }
  }
}

/**
 * Save diagnosed condition selections.
 *
 * Form fields: `diagnosed` (string|string[]) — one or more catalog condition IDs.
 * Success: redirect to /secondary/service-connected.
 * Error: redirect to /secondary/diagnosed?error=select-diagnosed.
 * See docs/api-specification.md for full contract.
 */
export async function saveDiagnosedSelection(formData: FormData): Promise<void> {
  if (nonEmptyValues(formData, "diagnosed").length === 0) {
    redirectValidation("/secondary/diagnosed", "select-diagnosed");
  }

  const catalog = loadConditionCatalog();
  const parsed = parseDiagnosedSelection(appendFormData({}, formData), catalog);

  try {
    await writeSecondaryWorkflowSession({
      diagnosedConditionIds: parsed.diagnosedConditionIds,
    });
  } catch (error) {
    // #5: do not silently lose data — surface as validation error instead of advancing
    console.error("[secondary-workflow] Failed to persist diagnosed selection:", error instanceof Error ? error.message : String(error));
    auditLog("workflow-diagnosed-selected", { status: "failure", route: "/secondary/diagnosed" });
    redirectValidation("/secondary/diagnosed", "select-diagnosed");
  }

  auditLog("workflow-diagnosed-selected", { status: "success", route: "/secondary/diagnosed", count: parsed.diagnosedConditionIds.length });
  redirect("/secondary/service-connected");
}

/**
 * Save service-connected selections for diagnosed conditions.
 *
 * Form fields: `serviceConnected-{id}` ("yes"|"no") per diagnosed condition.
 * Success: redirect to /secondary/ratings.
 * Errors: select-diagnosed, answer-service-connected, no-service-connected.
 * See docs/api-specification.md for full contract.
 */
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
    try {
      await writeSecondaryWorkflowSession({
        diagnosedConditionIds,
        serviceConnectedAnswerDraft,
      });
    } catch (error) {
      console.error("[secondary-workflow] Failed to persist service-connected draft:", error instanceof Error ? error.message : String(error));
    }
    redirectValidation("/secondary/service-connected", "answer-service-connected");
  }
  if (!answers.some((answer) => answer === "yes")) {
    try {
      await writeSecondaryWorkflowSession({
        diagnosedConditionIds,
        serviceConnectedConditionIds: [],
        ratingsByConditionId: {},
      });
    } catch (error) {
      console.error("[secondary-workflow] Failed to persist no-service-connected state:", error instanceof Error ? error.message : String(error));
    }
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

  try {
    await writeSecondaryWorkflowSession({
      diagnosedConditionIds: parsed.diagnosedConditionIds,
      serviceConnectedConditionIds: parsed.serviceConnectedConditionIds,
      ratingsByConditionId: {},
    });
  } catch (error) {
    console.error("[secondary-workflow] Failed to persist service-connected selection:", error instanceof Error ? error.message : String(error));
    auditLog("workflow-service-connected-selected", { status: "failure", route: "/secondary/service-connected" });
    redirectValidation("/secondary/service-connected", "answer-service-connected");
  }

  auditLog("workflow-service-connected-selected", { status: "success", route: "/secondary/service-connected", count: parsed.serviceConnectedConditionIds.length });
  redirect("/secondary/ratings");
}

/**
 * Save disability ratings for service-connected conditions.
 *
 * Form fields: `rating-{id}` (string) — integer 0-100 or "decline" per condition.
 * Success: redirect to /secondary/upload.
 * Errors: no-service-connected, select-rating, invalid-rating.
 * See docs/api-specification.md for full contract.
 */
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

  try {
    await writeSecondaryWorkflowSession({
      diagnosedConditionIds: parsed.diagnosedConditionIds,
      serviceConnectedConditionIds: parsed.serviceConnectedConditionIds,
      ratingsByConditionId: parsed.ratingsByConditionId,
    });
  } catch (error) {
    console.error("[secondary-workflow] Failed to persist ratings selection:", error instanceof Error ? error.message : String(error));
    auditLog("workflow-ratings-selected", { status: "failure", route: "/secondary/ratings" });
    redirectValidation("/secondary/ratings", "select-rating");
  }

  auditLog("workflow-ratings-selected", { status: "success", route: "/secondary/ratings", count: Object.keys(parsed.ratingsByConditionId).length });
  redirect("/secondary/upload");
}

/**
 * Save document availability and optional context (medications, treatments, history).
 *
 * Form fields: `documentsShared` ("yes"|"no"), `medications`, `treatments`,
 * `history` (newline-separated strings, max 20 entries × 160 chars each).
 * Success: redirect to /secondary/suggestions.
 * Errors: select-documents, invalid-context.
 * See docs/api-specification.md for full contract.
 */
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

  try {
    await writeSecondaryWorkflowSession(parsed);
  } catch (error) {
    console.error("[secondary-workflow] Failed to persist documents context:", error instanceof Error ? error.message : String(error));
    auditLog("workflow-documents-context", { status: "failure", route: "/secondary/upload" });
    redirectValidation("/secondary/upload", "select-documents");
  }
  auditLog("workflow-documents-context", { status: "success", route: "/secondary/upload" });
  redirect("/secondary/suggestions");
}

/**
 * Clear the secondary workflow session and redirect to the landing page.
 * See docs/api-specification.md for full contract.
 */
export async function finishSecondaryWorkflow(): Promise<void> {
  await clearSecondaryWorkflowSession();
  auditLog("workflow-completed", { status: "success", route: "/secondary" });
  redirect("/secondary");
}

/**
 * Clear the secondary workflow session and restart from the diagnosed step.
 * See docs/api-specification.md for full contract.
 */
export async function restartSecondaryWorkflow(): Promise<void> {
  await clearSecondaryWorkflowSession();
  auditLog("workflow-restarted", { status: "success", route: "/secondary/diagnosed" });
  redirect("/secondary/diagnosed");
}
