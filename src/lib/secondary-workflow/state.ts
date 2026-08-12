import { z } from "zod";

import { indexById } from "@/lib/catalog/lookup";
import type { ConditionCatalog } from "@/lib/catalog/schema";

const MAX_CONTEXT_ITEMS = 20;
const MAX_CONTEXT_ITEM_LENGTH = 160;

export interface SecondaryWorkflowState {
  diagnosedConditionIds: string[];
  serviceConnectedConditionIds: string[];
  ratingsByConditionId: Record<string, number | null>;
  documentsShared: boolean;
  medications?: string[];
  treatments?: string[];
}

export type QueryValue = string | string[] | undefined;
export type QueryParams = Record<string, QueryValue>;

const diagnosedSelectionSchema = z.object({
  diagnosedConditionIds: z.array(z.string().min(1)).min(1, {
    message: "Select at least one diagnosed condition to continue.",
  }),
});

const serviceConnectedSelectionSchema = z
  .object({
    diagnosedConditionIds: z.array(z.string().min(1)).min(1),
    serviceConnectedConditionIds: z.array(z.string().min(1)).min(1, {
      message: "Select at least one condition that is already service connected.",
    }),
  })
  .refine(
    (value) =>
      value.serviceConnectedConditionIds.every((id) =>
        value.diagnosedConditionIds.includes(id),
      ),
    {
      message:
        "Service-connected selections must come from the diagnosed conditions you selected.",
      path: ["serviceConnectedConditionIds"],
    },
  );

const documentsSharedSchema = z.object({
  documentsShared: z.enum(["yes", "no"]),
});

function toArray(value: QueryValue): string[] {
  if (!value) return [];

  return (Array.isArray(value) ? value : [value])
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function first(value: QueryValue): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function parseContextEntries(value: QueryValue, label: string): string[] {
  if (!value) return [];
  const entries = dedupe(
    (Array.isArray(value) ? value : [value])
      .flatMap((entry) => entry.split(/\r?\n/))
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

  if (entries.length > MAX_CONTEXT_ITEMS) {
    throw new Error(`${label} context is limited to ${MAX_CONTEXT_ITEMS} entries.`);
  }
  if (entries.some((entry) => entry.length > MAX_CONTEXT_ITEM_LENGTH)) {
    throw new Error(
      `${label} entries must be ${MAX_CONTEXT_ITEM_LENGTH} characters or fewer.`,
    );
  }
  return entries;
}

function toKnownConditionIds(catalog: ConditionCatalog, ids: string[]): string[] {
  const known = indexById(catalog);
  return dedupe(ids).filter((id) => known.has(id));
}

function parseRawDiagnosedConditionIds(
  params: QueryParams,
  catalog: ConditionCatalog,
): string[] {
  return toKnownConditionIds(catalog, toArray(params.diagnosed));
}

function parseRawServiceConnectedConditionIds(
  params: QueryParams,
  diagnosedConditionIds: string[],
): string[] {
  const explicit = toArray(params.serviceConnected);
  if (explicit.length > 0) {
    return dedupe(explicit).filter((id) => diagnosedConditionIds.includes(id));
  }

  return diagnosedConditionIds.filter(
    (id) => first(params[`serviceConnected-${id}`]) === "yes",
  );
}

export function parseDiagnosedPrefill(
  params: QueryParams,
  catalog: ConditionCatalog,
): string[] {
  return parseRawDiagnosedConditionIds(params, catalog);
}

export function parseServiceConnectedPrefill(
  params: QueryParams,
  catalog: ConditionCatalog,
): { diagnosedConditionIds: string[]; serviceConnectedConditionIds: string[] } {
  const diagnosedConditionIds = parseDiagnosedPrefill(params, catalog);

  return {
    diagnosedConditionIds,
    serviceConnectedConditionIds: parseRawServiceConnectedConditionIds(
      params,
      diagnosedConditionIds,
    ),
  };
}

export function parseDiagnosedSelection(
  params: QueryParams,
  catalog: ConditionCatalog,
): { diagnosedConditionIds: string[] } {
  return diagnosedSelectionSchema.parse({
    diagnosedConditionIds: parseRawDiagnosedConditionIds(params, catalog),
  });
}

export function parseServiceConnectedSelection(
  params: QueryParams,
  catalog: ConditionCatalog,
): { diagnosedConditionIds: string[]; serviceConnectedConditionIds: string[] } {
  const diagnosed = parseDiagnosedSelection(params, catalog).diagnosedConditionIds;

  return serviceConnectedSelectionSchema.parse({
    diagnosedConditionIds: diagnosed,
    serviceConnectedConditionIds: parseRawServiceConnectedConditionIds(
      params,
      diagnosed,
    ),
  });
}

export function ratingFieldName(conditionId: string): string {
  return `rating-${conditionId}`;
}

function parseRatingValue(raw: string | undefined): number | null {
  if (!raw || raw === "decline") return null;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    throw new Error("Ratings must be whole numbers from 0 through 100.");
  }

  return parsed;
}

export function parseRatingsSelection(
  params: QueryParams,
  catalog: ConditionCatalog,
): {
  diagnosedConditionIds: string[];
  serviceConnectedConditionIds: string[];
  ratingsByConditionId: Record<string, number | null>;
} {
  const serviceConnected = parseServiceConnectedSelection(params, catalog);
  const ratingsByConditionId: Record<string, number | null> = {};

  for (const id of serviceConnected.serviceConnectedConditionIds) {
    ratingsByConditionId[id] = parseRatingValue(first(params[ratingFieldName(id)]));
  }

  return {
    diagnosedConditionIds: serviceConnected.diagnosedConditionIds,
    serviceConnectedConditionIds: serviceConnected.serviceConnectedConditionIds,
    ratingsByConditionId,
  };
}

export function parseRatingsPrefill(
  params: QueryParams,
  conditionIds: string[],
): Record<string, number | null> {
  const ratingsByConditionId: Record<string, number | null> = {};

  for (const id of conditionIds) {
    try {
      ratingsByConditionId[id] = parseRatingValue(first(params[ratingFieldName(id)]));
    } catch {
      ratingsByConditionId[id] = null;
    }
  }

  return ratingsByConditionId;
}

function parseDocumentsShared(value: QueryValue): boolean {
  const parsed = documentsSharedSchema.parse({
    documentsShared: first(value),
  });

  return parsed.documentsShared === "yes";
}

export function parseDocumentsSharedPrefill(value: QueryValue): boolean {
  return first(value) === "yes";
}

export function parseDocumentsSelection(
  params: QueryParams,
  catalog: ConditionCatalog,
): SecondaryWorkflowState {
  const ratings = parseRatingsSelection(params, catalog);
  const medications = parseContextEntries(params.medications, "Medication");
  const treatments = parseContextEntries(params.treatments, "Treatment");

  return {
    ...ratings,
    documentsShared: parseDocumentsShared(params.documentsShared),
    ...(medications.length > 0 ? { medications } : {}),
    ...(treatments.length > 0 ? { treatments } : {}),
  };
}

export function parseWorkflowState(
  params: QueryParams,
  catalog: ConditionCatalog,
): SecondaryWorkflowState {
  return parseDocumentsSelection(params, catalog);
}

export function workflowStateToSearchParams(
  state: SecondaryWorkflowState,
): URLSearchParams {
  const searchParams = new URLSearchParams();

  for (const id of state.diagnosedConditionIds) {
    searchParams.append("diagnosed", id);
  }

  for (const id of state.serviceConnectedConditionIds) {
    searchParams.append("serviceConnected", id);
  }

  for (const id of state.serviceConnectedConditionIds) {
    const value = state.ratingsByConditionId[id];
    searchParams.set(ratingFieldName(id), value === null ? "decline" : String(value));
  }

  searchParams.set("documentsShared", state.documentsShared ? "yes" : "no");

  // Medication and treatment context is intentionally excluded from URL
  // serialization. It belongs only in the encrypted short-lived workflow session.
  return searchParams;
}
