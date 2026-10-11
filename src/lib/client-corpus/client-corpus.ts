/**
 * Browser-local client corpus (PRIV-01, accepted 2026-10-07).
 *
 * The accepted privacy contract keeps ALL veteran health context in the
 * browser: diagnoses, ratings, medications, treatments, history, symptoms and
 * chronology never reach the server. The recommendation engine is already
 * isomorphic — `recommend(catalog, kb, intake)` takes plain data — so the only
 * thing the client needs is this PUBLIC corpus of authored content, fetched
 * once as a uniform request that cannot reveal which conditions a visitor
 * selected.
 *
 * This module lives outside `src/lib/kb/` because the composition audit's
 * CLIENT-BOUNDARY rule forbids client modules from importing the kb layer; the
 * corpus is the sanctioned client-side stand-in for those loaders.
 *
 * The corpus contains catalog conditions, PUBLISHED (non-draft) mappings,
 * adjacency-graph nodes, and the public graph-anchor index (the citation
 * anchors the `/pathways` explorer already serves to every visitor, joined
 * here so the results surface renders the same anchors without the browser
 * needing draft mappings). It must never contain workflow state or anything
 * else that only exists because a visitor used the tool.
 */
import { z } from "zod";

import { conditionCatalogSchema, type ConditionCatalog } from "@/lib/catalog/schema";
import { anchorsForHop } from "@/lib/engine/graph-pathway-projection";
import { assertGraphEvidenceJoins } from "@/lib/kb/graph-evidence-joins.mts";
import type { GraphPathwayAnchorView } from "@/lib/engine/pathway-view";
import {
  KbNodeMappingSchema,
  knowledgeBaseSchema,
  type KbNodeMapping,
  type KnowledgeBase,
} from "@/lib/kb/schema";

export const CLIENT_CORPUS_VERSION = 2;

/** Public path of the generated artifact (see scripts/build-client-corpus.mjs). */
export const CLIENT_CORPUS_PATH = "/kb/client-corpus.json";

/** Metadata only; the artifact itself is served from `public/`. */
export const CLIENT_CORPUS_GENERATED_BY = "npm run build:client-corpus";

const graphAnchorViewSchema = z.object({
  label: z.string().min(1),
  sourceUrl: z.string().min(1).optional(),
  verified: z.boolean(),
});

const graphAnchorEntrySchema = z.object({
  sourceConditionId: z.string().min(1),
  targetConditionId: z.string().min(1),
  anchors: z.array(graphAnchorViewSchema),
});

export type ClientCorpusGraphAnchorEntry = z.infer<typeof graphAnchorEntrySchema>;

export interface ClientCorpus {
  version: number;
  conditions: ConditionCatalog;
  publishedMappings: KnowledgeBase;
  graph: KbNodeMapping[];
  /**
   * Public citation anchors per graph edge, derived from the same authored
   * references the `/pathways` explorer renders. Every edge must have one
   * nonempty anchor entry; missing or ambiguous entries are refused.
   */
  graphAnchors: ClientCorpusGraphAnchorEntry[];
}

/**
 * Builds the public corpus from the same loaders the server uses, so a parity
 * test can prove the client path produces identical recommendations.
 *
 * `knowledgeBase` must be the FULL authored corpus: drafts are excluded from
 * `publishedMappings`, but the graph-anchor join reads the whole corpus
 * exactly like `pathway-explorer.ts` does, so the browser renders the same
 * anchors the server-rendered explorer shows.
 */
export function buildClientCorpus(
  conditions: ConditionCatalog,
  knowledgeBase: KnowledgeBase,
  graph: readonly KbNodeMapping[],
): ClientCorpus {
  assertGraphEvidenceJoins(knowledgeBase, graph);
  const mappingById = new Map(
    knowledgeBase.map((mapping) => [mapping.id, mapping] as const),
  );
  const graphAnchors: ClientCorpusGraphAnchorEntry[] = [];
  for (const node of graph) {
    for (const edge of node.outgoingEdges) {
      const anchors = anchorsForHop(
        mappingById,
        edge.sourceConditionId,
        edge.targetConditionId,
      );
      graphAnchors.push({
        sourceConditionId: edge.sourceConditionId,
        targetConditionId: edge.targetConditionId,
        anchors,
      });
    }
  }

  return {
    version: CLIENT_CORPUS_VERSION,
    conditions,
    publishedMappings: knowledgeBase.filter((mapping) => !mapping.draft),
    graph: [...graph],
    graphAnchors,
  };
}

/** Lookup for `buildGraphPathwayMatchSectionViewFromData`'s anchor index. */
export function clientCorpusGraphAnchorIndex(
  corpus: ClientCorpus,
): Map<string, GraphPathwayAnchorView[]> {
  return new Map(
    corpus.graphAnchors.map((entry) => [
      `${entry.sourceConditionId}->${entry.targetConditionId}`,
      entry.anchors,
    ]),
  );
}

/**
 * Minimal structural check for a fetched artifact. This rejects an HTML error
 * page or an unrelated JSON file before it can masquerade as a corpus.
 */
export function isClientCorpus(input: unknown): input is ClientCorpus {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const candidate = input as Partial<ClientCorpus>;
  return (
    candidate.version === CLIENT_CORPUS_VERSION &&
    Array.isArray(candidate.conditions) &&
    Array.isArray(candidate.publishedMappings) &&
    Array.isArray(candidate.graph) &&
    Array.isArray(candidate.graphAnchors)
  );
}

/**
 * Parses a fetched artifact through the SAME schemas the server loaders use,
 * so the browser applies identical defaults and bounds. A raw JSON file that
 * omits defaulted fields (e.g. `governanceNotes: []`) normalizes to exactly
 * the data the server would have loaded — the parity test pins that.
 */
export function parseClientCorpus(input: unknown): ClientCorpus {
  if (!isClientCorpus(input)) {
    throw new Error(
      `Fetched artifact is not a client corpus v${CLIENT_CORPUS_VERSION} (expected conditions, publishedMappings, graph and graphAnchors arrays).`,
    );
  }
  const conditions = conditionCatalogSchema.safeParse(input.conditions);
  const publishedMappings = knowledgeBaseSchema.safeParse(input.publishedMappings);
  const graph = KbNodeMappingSchema.array().safeParse(input.graph);
  const graphAnchors = graphAnchorEntrySchema.array().safeParse(input.graphAnchors);
  if (!conditions.success) {
    throw new Error(`Client corpus conditions failed validation: ${conditions.error.message}`);
  }
  if (!publishedMappings.success) {
    throw new Error(
      `Client corpus publishedMappings failed validation: ${publishedMappings.error.message}`,
    );
  }
  if (!graph.success) {
    throw new Error(`Client corpus graph failed validation: ${graph.error.message}`);
  }
  if (!graphAnchors.success) {
    throw new Error(
      `Client corpus graphAnchors failed validation: ${graphAnchors.error.message}`,
    );
  }
  // Draft mappings are intentionally absent from this public artifact, so
  // their authored/classification join is certified at construction above.
  // At fetch time still require exactly one nonempty anchor entry per edge.
  const anchorKeys = new Set<string>();
  for (const entry of graphAnchors.data) {
    const key = `${entry.sourceConditionId}->${entry.targetConditionId}`;
    if (anchorKeys.has(key) || entry.anchors.length === 0) {
      throw new Error(`Client corpus graph anchor entry is empty or duplicated: ${key}`);
    }
    anchorKeys.add(key);
  }
  const edgeKeys = new Set(graph.data.flatMap(node => node.outgoingEdges.map(
    edge => `${edge.sourceConditionId}->${edge.targetConditionId}`,
  )));
  if (edgeKeys.size !== anchorKeys.size || [...edgeKeys].some(key => !anchorKeys.has(key))) {
    throw new Error("Client corpus graph anchors do not match its edges");
  }
  return {
    version: CLIENT_CORPUS_VERSION,
    conditions: conditions.data,
    publishedMappings: publishedMappings.data,
    graph: graph.data,
    graphAnchors: graphAnchors.data,
  };
}
