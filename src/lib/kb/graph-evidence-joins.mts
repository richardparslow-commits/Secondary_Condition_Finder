import type { KbNodeMapping, KnowledgeBase } from "./schema";

/**
 * ARCH-01: each adjacency edge must reference an authored suggestion with
 * citations and the same legal classification. This is an integrity check,
 * not verification or publication approval: supported draft research edges
 * and their original citation verification flags remain permitted.
 *
 * Type-only imports keep this usable by the native Node corpus generator as
 * well as the server loader and browser-safe corpus builder.
 *
 * Publication is a *separate* fact from this join (audit A08): the join accepts
 * draft-backed edges because the adjacency graph is a research layer, while the
 * authored corpus's `draft` flag is the publication layer that gates
 * recommendation output. Rather than pretend the two are in parity, each
 * surface derives the hop's publication state through
 * `mappingProvenanceResolver` (`src/lib/engine/graph-pathway-projection.ts`, one
 * implementation for the server's full corpus and the browser's published-only
 * corpus) and discloses it per route; `tests/graph-pathway-provenance.test.ts`
 * pins that separation across both representations.
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
