import { ratingFieldName, type SecondaryWorkflowState } from "@/lib/secondary-workflow/state";

interface Props {
  diagnosedConditionIds: string[];
  serviceConnectedConditionIds?: string[];
  ratingsByConditionId?: Record<string, number | null>;
  documentsShared?: boolean;
}

export function SecondaryWorkflowHiddenFields({
  diagnosedConditionIds,
  serviceConnectedConditionIds = [],
  ratingsByConditionId,
  documentsShared,
}: Props) {
  return (
    <>
      {diagnosedConditionIds.map((conditionId) => (
        <input key={`diagnosed-${conditionId}`} type="hidden" name="diagnosed" value={conditionId} />
      ))}

      {serviceConnectedConditionIds.map((conditionId) => (
        <input
          key={`service-connected-${conditionId}`}
          type="hidden"
          name="serviceConnected"
          value={conditionId}
        />
      ))}

      {ratingsByConditionId &&
        serviceConnectedConditionIds.map((conditionId) => (
          <input
            key={`rating-${conditionId}`}
            type="hidden"
            name={ratingFieldName(conditionId)}
            value={
              ratingsByConditionId[conditionId] === null
                ? "decline"
                : String(ratingsByConditionId[conditionId] ?? "decline")
            }
          />
        ))}

      {typeof documentsShared === "boolean" && (
        <input
          type="hidden"
          name="documentsShared"
          value={documentsShared ? "yes" : "no"}
        />
      )}
    </>
  );
}

export function toHiddenFieldState(state: SecondaryWorkflowState): Props {
  return {
    diagnosedConditionIds: state.diagnosedConditionIds,
    serviceConnectedConditionIds: state.serviceConnectedConditionIds,
    ratingsByConditionId: state.ratingsByConditionId,
    documentsShared: state.documentsShared,
  };
}
