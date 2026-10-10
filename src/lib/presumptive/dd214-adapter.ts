import { serviceHistorySchema, type ServiceHistory } from "./match";
import type { Dd214Extraction } from "@/lib/evidence/dd214-extract";

export interface Dd214AdapterResult {
  history: ServiceHistory | null;
  validationCode: "select-location" | "date-order" | "invalid-date" | null;
  warnings: string[];
}

/**
 * Converts a browser-local DD-214 extraction into a ServiceHistory draft.
 * The draft is never persisted until the Veteran confirms it on the
 * verification form. Confirmed values are saved to browser-local session
 * storage. Locations remain as-entered strings; matchPresumptives handles
 * exact-location matching separately.
 */
export function dd214ToServiceHistoryFields(
  extraction: Dd214Extraction,
  options?: { locationsOverride?: string[] },
): Dd214AdapterResult {
  const fields = extraction.fields;
  const locations = (options?.locationsOverride ?? fields.locations ?? []).map((s) => s.trim()).filter(Boolean);
  const draft: ServiceHistory = {
    serviceBranchCodes: fields.serviceBranchCodes,
    locations: locations.length > 0 ? locations : [""],
    serviceStart: fields.serviceStart ?? null,
    serviceEnd: fields.serviceEnd ?? null,
  };

  // Use schema validation to map to the existing presumptive error codes.
  const parsed = serviceHistorySchema.safeParse(draft);
  if (parsed.success) {
    return { history: parsed.data, validationCode: null, warnings: fields.warnings };
  }
  const issues = parsed.error.issues;
  if (issues.some((i) => i.path[0] === "locations")) {
    return { history: null, validationCode: "select-location", warnings: fields.warnings };
  }
  if (issues.some((i) => i.path[0] === "serviceEnd" && (i as { code?: string }).code === "custom")) {
    return { history: null, validationCode: "date-order", warnings: fields.warnings };
  }
  return { history: null, validationCode: "invalid-date", warnings: fields.warnings };
}
