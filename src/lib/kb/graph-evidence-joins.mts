import type { KbNodeMapping, KnowledgeBase } from "./schema";

/**
 * ARCH-01: each adjacency edge must reference an authored suggestion with
 * citations and the same legal classification. This is an integrity check,
 * not verification or publication approval: supported draft research edges
 * and their original citation verification flags remain permitted.
 *
 * Type-only imports keep this usable by the native Node corpus generator as
 * well as the server loader and browser-safe corpus builder.
 */
export function assertGraphEvidenceJoins(
  kb: KnowledgeBase,
  nodes: readonly KbNodeMapping[],
): void {
  const mappingById = new Map(kb.map(mapping => [mapping.id, mapping]));
  for (const node of nodes) {
    for (const edge of node.outgoingEdges) {
      const suggestion = mappingById.get(node.nodeId)?.suggestions.find(
        candidate => candidate.conditionId === edge.targetConditionId,
      );
      if (!suggestion || !Array.isArray(suggestion.sourceReferences) || suggestion.sourceReferences.length === 0) {
        throw new Error(`[kb-graph] Missing authored evidence for ${node.nodeId} -> ${edge.targetConditionId}`);
      }
      if (suggestion.nexusClaim.nexusClassification !== edge.nexusClaim.nexusClassification) {
        throw new Error(`[kb-graph] Nexus classification mismatch for ${node.nodeId} -> ${edge.targetConditionId}`);
      }
    }
  }
}
