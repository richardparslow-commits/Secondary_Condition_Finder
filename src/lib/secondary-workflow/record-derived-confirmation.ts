import type { ConditionCatalog } from "@/lib/catalog/schema";
import type { RecordClaimStatus } from "@/lib/evidence/record-condition-discovery";
import type { BrowserWorkflowContextInput } from "./browser-context";

export interface VeteranReviewedRecordCondition {
  conditionId: string;
  claimStatus: RecordClaimStatus;
  sourceIds: string[];
}

const CLAIM_STATUSES = new Set<RecordClaimStatus>([
  "not-yet-claimed", "pending", "denied", "unknown",
]);

/**
 * Adds only explicit veteran-reviewed, catalog-recognized records to the
 * existing local recommendation intake. The status is a self-report and never
 * proves that VA has accepted, denied or rated a claim.
 *
 * Caller MUST separately enforce local excerpt classifications and require an
 * explicit, opt-in UI action before constructing these confirmations.
 */
export function confirmRecordDerivedConditions(
  context: BrowserWorkflowContextInput,
  confirmations: readonly VeteranReviewedRecordCondition[],
  catalog: ConditionCatalog,
): BrowserWorkflowContextInput {
  if (!confirmations.length) return context;
  const allowed = new Set(catalog.map((c) => c.id));
  const rated = new Set(context.serviceConnectedConditionIds ?? []);
  const diagnosed = new Set(context.diagnosedConditionIds ?? []);
  const confirmed = new Set(context.recordDiscoveredConditionIds ?? []);
  const statuses = { ...context.recordClaimStatusByConditionId };
  const sources = { ...context.recordSourceIdsByConditionId };

  for (const row of confirmations) {
    if (!allowed.has(row.conditionId) || rated.has(row.conditionId) ||
      !CLAIM_STATUSES.has(row.claimStatus) ||
      !Array.isArray(row.sourceIds) || row.sourceIds.length < 1 || row.sourceIds.length > 8 ||
      row.sourceIds.some((id) => typeof id !== "string" || !id.trim() || id.length > 128)) {
      throw new Error("Unrecognized or unsafe record-derived research confirmation.");
    }
    if (diagnosed.has(row.conditionId) && !confirmed.has(row.conditionId)) {
      // The veteran already chose this condition on Step 1: never change its
      // origin or claim status merely because a record mentions it.
      continue;
    }
    diagnosed.add(row.conditionId);
    confirmed.add(row.conditionId);
    statuses[row.conditionId] = row.claimStatus;
    sources[row.conditionId] = [...new Set([...(sources[row.conditionId] ?? []), ...row.sourceIds])].slice(0, 8);
  }
  if (confirmed.size > 30) throw new Error("Too many record-derived research topics.");
  return {
    ...context,
    diagnosedConditionIds: [...diagnosed],
    recordDiscoveredConditionIds: [...confirmed],
    recordClaimStatusByConditionId: statuses,
    recordSourceIdsByConditionId: sources,
  };
}

/** Source withdrawal must also revoke topics supported only by that source. */
export function withdrawRecordSource(
  context: BrowserWorkflowContextInput,
  sourceId: string,
): BrowserWorkflowContextInput {
  if (!sourceId) return context;
  const sources = { ...context.recordSourceIdsByConditionId };
  const removed = new Set<string>();
  for (const id of context.recordDiscoveredConditionIds ?? []) {
    const original = sources[id] ?? [];
    if (!original.includes(sourceId)) continue;
    const next = original.filter((source) => source !== sourceId);
    if (next.length === 0) {
      removed.add(id);
      delete sources[id];
    } else {
      sources[id] = next;
    }
  }
  if (!removed.size && Object.keys(sources).every((id) =>
    JSON.stringify(sources[id]) === JSON.stringify(context.recordSourceIdsByConditionId?.[id]))) {
    return context;
  }
  const statuses = { ...context.recordClaimStatusByConditionId };
  for (const id of removed) delete statuses[id];
  return {
    ...context,
    diagnosedConditionIds: (context.diagnosedConditionIds ?? []).filter((id) => !removed.has(id)),
    recordDiscoveredConditionIds: (context.recordDiscoveredConditionIds ?? []).filter((id) => !removed.has(id)),
    recordClaimStatusByConditionId: statuses,
    recordSourceIdsByConditionId: sources,
  };
}

export function withdrawRecordCondition(
  context: BrowserWorkflowContextInput,
  conditionId: string,
): BrowserWorkflowContextInput {
  if (!(context.recordDiscoveredConditionIds ?? []).includes(conditionId)) return context;
  const statuses = { ...context.recordClaimStatusByConditionId };
  const sources = { ...context.recordSourceIdsByConditionId };
  delete statuses[conditionId];
  delete sources[conditionId];
  return {
    ...context,
    diagnosedConditionIds: (context.diagnosedConditionIds ?? []).filter((id) => id !== conditionId),
    recordDiscoveredConditionIds: (context.recordDiscoveredConditionIds ?? []).filter((id) => id !== conditionId),
    recordClaimStatusByConditionId: statuses,
    recordSourceIdsByConditionId: sources,
  };
}

/** Clears only record-derived selections, never manual Step 1 diagnoses. */
export function clearRecordDerivedConditions(
  context: BrowserWorkflowContextInput,
): BrowserWorkflowContextInput {
  const derived = new Set(context.recordDiscoveredConditionIds ?? []);
  return {
    ...context,
    diagnosedConditionIds: (context.diagnosedConditionIds ?? []).filter((id) => !derived.has(id)),
    recordDiscoveredConditionIds: [],
    recordClaimStatusByConditionId: {},
    recordSourceIdsByConditionId: {},
  };
}
