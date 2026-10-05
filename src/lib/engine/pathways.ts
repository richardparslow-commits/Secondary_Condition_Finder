/**
 * Pathway and intermediate-chain helpers.
 *
 * Responsibility: build `IntermediatePathEdge` / `IntermediatePathway` objects
 * from authored KB mappings and assemble bounded two-edge research paths
 * through published mappings only. The two-edge shape defers to the shared
 * `MAX_PATHWAY_HOPS` cap (`@/lib/kb/pathway-depth`): if the cap ever drops
 * below two edges, this composer emits nothing rather than an over-depth
 * path. Paths are never promoted to direct nexus findings — both edges and
 * their provenance stay visible.
 */

import { isWithinPathwayDepth } from "@/lib/kb/pathway-depth";
import type { KnowledgeBase, SourceReference } from "@/lib/kb/schema";

import { CONSENSUS_ORDER } from "./ranking";
import type { IntermediatePathEdge, IntermediatePathway } from "./types";

function referenceIdentity(reference: SourceReference): string {
  return JSON.stringify(Object.entries(reference).sort(([left], [right]) => left.localeCompare(right)));
}

function dedupeReferences(references: SourceReference[]): SourceReference[] {
  const seen = new Map<string, SourceReference>();
  for (const reference of references) {
    const identity = referenceIdentity(reference);
    if (!seen.has(identity)) seen.set(identity, reference);
  }
  return [...seen.values()];
}

function pathEdge(
  conditionId: string,
  conditionName: string,
  suggestion: KnowledgeBase[number]["suggestions"][number],
  targetName: string,
): IntermediatePathEdge {
  return {
    conditionId,
    conditionName,
    targetConditionId: suggestion.conditionId,
    targetConditionName: targetName,
    rank: suggestion.rank,
    nexusClassification: suggestion.nexusClaim.nexusClassification,
    etiologicalConsensus: suggestion.evidentiaryProfile.etiologicalConsensus,
    rationale: suggestion.rationale,
    pathwayTypes: suggestion.pathwayIntelligence?.pathways ?? [],
    sourceReferences: [...suggestion.sourceReferences],
  };
}

function intermediatePathway(
  primary: { id: string; name: string },
  intermediate: { id: string; name: string },
  target: { id: string; name: string },
  firstSuggestion: KnowledgeBase[number]["suggestions"][number],
  secondSuggestion: KnowledgeBase[number]["suggestions"][number],
): IntermediatePathway {
  const firstEdge = pathEdge(primary.id, primary.name, firstSuggestion, intermediate.name);
  const secondEdge = pathEdge(intermediate.id, intermediate.name, secondSuggestion, target.name);
  return {
    primaryId: primary.id,
    primaryName: primary.name,
    intermediateId: intermediate.id,
    intermediateName: intermediate.name,
    targetId: target.id,
    targetName: target.name,
    label: "INTERMEDIATE_CHAIN",
    edges: [firstEdge, secondEdge],
    causalChain: `${primary.name} → ${intermediate.name} → ${target.name}`,
    sourceReferences: dedupeReferences([...firstSuggestion.sourceReferences, ...secondSuggestion.sourceReferences]),
  };
}

/**
 * Returns only explicit two-edge paths through published mappings. This is a
 * research-path feature, not transitive causal inference: both source edges
 * remain visible and the path is never promoted to a direct nexus claim. When
 * the shared pathway-depth cap is below two edges the composer returns an
 * empty list: there is no lawful intermediate chain to compose at a depth the
 * cap would reject.
 *
 * F-03: every composed edge must itself assert a nexus theory. An
 * ASSOCIATION_ONLY edge is hypothesized-only by schema contract, so composing
 * one into a chain would present a hypothesized cascade as a connectable
 * research path; association edges stay visible on their own cards only.
 */
export function findIntermediatePathways(
  primary: { id: string; name: string },
  mappings: Map<string, KnowledgeBase[number]>,
  byId: Map<string, { id: string; name: string }>,
  diagnosedSet: Set<string>,
  recognizedIds: Set<string>,
): IntermediatePathway[] {
  // Depth guard: the composer builds exactly two-edge chains, so it must
  // defer to the shared cap rather than encode its own copy of "2".
  if (!isWithinPathwayDepth(2)) return [];

  const firstMapping = mappings.get(primary.id);
  if (!firstMapping) return [];

  const paths: IntermediatePathway[] = [];
  for (const firstSuggestion of firstMapping.suggestions) {
    const intermediate = byId.get(firstSuggestion.conditionId);
    if (!intermediate || intermediate.id === primary.id || recognizedIds.has(intermediate.id)) continue;
    if (firstSuggestion.nexusClaim.nexusClassification === "ASSOCIATION_ONLY") continue;

    const secondMapping = mappings.get(intermediate.id);
    if (!secondMapping) continue;

    for (const secondSuggestion of secondMapping.suggestions) {
      if (
        secondSuggestion.conditionId === primary.id ||
        secondSuggestion.conditionId === intermediate.id ||
        secondSuggestion.nexusClaim.nexusClassification === "ASSOCIATION_ONLY" ||
        !diagnosedSet.has(secondSuggestion.conditionId) ||
        recognizedIds.has(secondSuggestion.conditionId)
      )
        continue;

      const target = byId.get(secondSuggestion.conditionId);
      if (!target) continue;
      paths.push(intermediatePathway(primary, intermediate, target, firstSuggestion, secondSuggestion));
    }
  }

  return dedupePathways(paths);
}

export function dedupePathways(pathways: IntermediatePathway[]): IntermediatePathway[] {
  return [
    ...new Map(
      pathways.map((pathway) => [`${pathway.primaryId}:${pathway.intermediateId}:${pathway.targetId}`, pathway]),
    ).values(),
  ];
}

/**
 * F-02: a two-edge intermediate chain is as weak as its weakest link — Math.max
 * picks the weaker (higher-rank) consensus tier so the chain cannot be stronger
 * than either edge. Per-target consensusRank (below) uses Math.min because a
 * target with multiple supporting primaries is as strong as its strongest edge.
 */
export function pathConsensusRank(path: IntermediatePathway): number {
  return Math.max(
    CONSENSUS_ORDER[path.edges[0].etiologicalConsensus],
    CONSENSUS_ORDER[path.edges[1].etiologicalConsensus],
  );
}

export { dedupeReferences, referenceIdentity };
