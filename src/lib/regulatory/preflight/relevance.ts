import type { FederalRegisterDiscovery, RegulatoryPreflightChange, ReviewScope } from "./types";
import type { RegulatoryAction } from "../schema";

const VA_REVIEW_TERMS = /\b(?:disability|compensation|service[- ]connection|presumpt|rating schedule|diagnostic code|toxic exposure|burn pit|particulate matter|PACT Act|TERA|effective date|veterans benefits|claimant|claims|appeal|38\s*CFR|secondary service connection)\b/i;

export const federalRegisterDiscoveryIsReviewRelevant = (discovery: FederalRegisterDiscovery): boolean => {
  if (["rule", "interim-final-rule", "proposed-rule", "correction"].includes(discovery.type)) return true;
  const text = `${discovery.title} ${discovery.rawAction ?? ""} ${discovery.abstract ?? ""} ${discovery.signals.join(" ")}`;
  return VA_REVIEW_TERMS.test(text);
};

export const actionIsReviewRelevant = (action: RegulatoryAction): boolean => {
  if (action.cfrReferences.some((reference) => reference.title === 38)) return true;
  if (action.impact && (
    action.impact.affectedConditionIds.length > 0
    || action.impact.affectedClaimTheories.length > 0
    || action.impact.affectedDiagnosticCodes.length > 0
    || action.impact.affectedPresumptions.length > 0
  )) return true;
  return VA_REVIEW_TERMS.test(action.title);
};

export const changeMatchesReviewScope = (
  change: RegulatoryPreflightChange,
  scope: ReviewScope | undefined,
): boolean => {
  if (!scope) return true;
  const requestedConditions = new Set(scope.conditionIds ?? []);
  const requestedTheories = new Set(scope.claimTheories ?? []);
  const requestedCodes = new Set(scope.diagnosticCodes ?? []);
  const impact = change.impact;
  const hasAuthoredImpact = impact.affectedConditionIds.length
    + impact.affectedClaimTheories.length
    + impact.affectedDiagnosticCodes.length
    + impact.affectedPresumptions.length
    + impact.affectedEffectiveDateRules.length > 0;
  if (!hasAuthoredImpact) return true; // Unknown impact remains visible; silence would be unsafe.
  return impact.affectedConditionIds.some((value) => requestedConditions.has(value))
    || impact.affectedClaimTheories.some((value) => requestedTheories.has(value))
    || impact.affectedDiagnosticCodes.some((value) => requestedCodes.has(value));
};
