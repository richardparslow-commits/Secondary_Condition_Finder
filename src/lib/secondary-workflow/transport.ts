import { PERMANENT_AND_TOTAL_RATING_VALUE } from "./ratings";
import {
  ratingFieldName,
  type ConditionTimelineEntry,
  type QueryParams,
} from "./state";

/**
 * The subset of workflow state converted to parser input fields. Structurally
 * satisfied by `BrowserWorkflowContext` (PRIV-01 browser-local record), this
 * module is the client-safe conversion used by browser-local workflow steps.
 *
 * Client-safe by contract: no `next/headers`, no crypto, no server-only
 * imports — the browser may call this to rebuild parser input from its own
 * context.
 */
export interface TransportableWorkflowState {
  diagnosedConditionIds?: string[];
  serviceConnectedConditionIds?: string[];
  ratingsByConditionId?: Record<string, number | null>;
  permanentAndTotalConditionIds?: string[];
  documentsShared?: boolean;
  medications?: string[];
  treatments?: string[];
  history?: string[];
  symptomIds?: string[];
  conditionTimeline?: Record<string, ConditionTimelineEntry>;
}

export function workflowSessionToQueryParams(
  state: TransportableWorkflowState,
): QueryParams {
  const params: QueryParams = {};

  if (state.diagnosedConditionIds?.length) params.diagnosed = [...state.diagnosedConditionIds];
  if (state.serviceConnectedConditionIds?.length) {
    params.serviceConnected = [...state.serviceConnectedConditionIds];
  }

  if (state.ratingsByConditionId && state.serviceConnectedConditionIds) {
    for (const id of state.serviceConnectedConditionIds) {
      const value = state.ratingsByConditionId[id];
      if (value === undefined) continue;
      const permanentAndTotal =
        value === 100 && (state.permanentAndTotalConditionIds ?? []).includes(id);
      params[ratingFieldName(id)] =
        value === null
          ? "decline"
          : permanentAndTotal
            ? PERMANENT_AND_TOTAL_RATING_VALUE
            : String(value);
    }
  }

  if (typeof state.documentsShared === "boolean") {
    params.documentsShared = state.documentsShared ? "yes" : "no";
  }
  if (state.medications?.length) params.medications = [...state.medications];
  if (state.treatments?.length) params.treatments = [...state.treatments];
  if (state.history?.length) params.history = [...state.history];
  if (state.symptomIds?.length) params.symptomIds = [...state.symptomIds];
  if (state.conditionTimeline) {
    for (const [id, timeline] of Object.entries(state.conditionTimeline)) {
      if (timeline.onsetYear !== undefined) params[`onsetYear-${id}`] = String(timeline.onsetYear);
      if (timeline.diagnosisYear !== undefined) params[`diagnosisYear-${id}`] = String(timeline.diagnosisYear);
    }
  }

  return params;
}
