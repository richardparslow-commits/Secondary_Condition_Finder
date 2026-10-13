import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { buildClientCorpus, clientCorpusGraphAnchorIndex } from "@/lib/client-corpus";
import { buildGraphPathwayMatchSectionViewFromData } from "@/lib/engine/graph-pathway-matches-core";
import { mappingProvenanceResolver, projectGraphPathway } from "@/lib/engine/graph-pathway-projection";
import { loadKbGraph } from "@/lib/kb/graph";
import { loadKnowledgeBase } from "@/lib/kb/load";
import type { ClaimPathway, KbNodeMapping } from "@/lib/kb/schema";

import { hop, node } from "./helpers/pathway-fixtures";

/**
 * Publication/provenance parity across the two graph representations (A08).
 *
 * The audit's A08 finding named two representations that coexist: the authored
 * corpus (the **publication** layer, whose `draft` flag gates recommendation
 * output) and the adjacency graph (a **research** layer that may cite
 * draft-authored evidence). The close criterion is an *explicit* separation —
 * either enforced parity or a documented research-only distinction — rather
 * than an implicit one, so this suite pins the separation end to end:
 *
 *   - the server representation (full authored corpus) and the browser
 *     representation (published-only client corpus) label the SAME route as
 *     draft-backed, so a research route reads as research on both surfaces;
 *   - the browser corpus cannot contain the draft mapping at all, so its label
 *     comes from absence — and a *published* hop stays unlabelled, so the rule
 *     cannot misreport a published relationship as a draft one;
 *   - the browser feeds the engine and the graph builder the same published-only
 *     corpus, so a draft-backed route can never arrive as a published result.
 *
 * The shipped graph is the right fixture for the draft direction: every one of
 * its nodes is authored against a draft mapping, which is what a research layer
 * looks like in practice.
 */

const DRAFT_ORIGIN = "liver-cancer";
const DRAFT_TERMINAL = "sarcopenia";

const catalog = loadConditionCatalog();
const knowledgeBase = loadKnowledgeBase();

/** The graph as the browser sees it after `parseClientCorpus`. */
function browserGraph(nodes: readonly KbNodeMapping[]): Map<string, KbNodeMapping> {
  return new Map(nodes.map((entry) => [entry.nodeId, entry] as const));
}

describe("graph pathway provenance (A08)", () => {
  it("labels a draft-backed route as draft-backed on the server representation", () => {
    const view = buildGraphPathwayMatchSectionViewFromData(
      catalog,
      knowledgeBase,
      loadKbGraph(),
      [DRAFT_ORIGIN],
      [DRAFT_TERMINAL],
    );

    expect(view.matches).toHaveLength(1);
    const match = view.matches[0]!;
    expect(match.includesDraftAuthoredEvidence).toBe(true);
    expect(match.hops.every((entry) => entry.authoredDraft)).toBe(true);
    expect(view.draftAuthoredMatches).toBe(1);
    // The authored corpus is fully migrated here, so nothing is truncated.
    expect(view.cappedOrigins).toBe(0);
  });

  it("labels the same route as draft-backed in the browser, which cannot see the draft at all", () => {
    const corpus = buildClientCorpus(catalog, knowledgeBase, [...loadKbGraph().values()]);
    // The publication layer excludes the draft backing this route.
    expect(corpus.publishedMappings.some((mapping) => mapping.id === DRAFT_ORIGIN)).toBe(false);
    expect(corpus.publishedMappings.every((mapping) => !mapping.draft)).toBe(true);

    const serverView = buildGraphPathwayMatchSectionViewFromData(
      catalog,
      knowledgeBase,
      loadKbGraph(),
      [DRAFT_ORIGIN],
      [DRAFT_TERMINAL],
    );
    const browserView = buildGraphPathwayMatchSectionViewFromData(
      corpus.conditions,
      corpus.publishedMappings,
      browserGraph(corpus.graph),
      [DRAFT_ORIGIN],
      [DRAFT_TERMINAL],
      clientCorpusGraphAnchorIndex(corpus),
    );

    expect(browserView.matches).toHaveLength(1);
    expect(browserView.matches[0]?.includesDraftAuthoredEvidence).toBe(true);
    expect(browserView.matches[0]?.hops.every((entry) => entry.authoredDraft)).toBe(true);
    expect(browserView.draftAuthoredMatches).toBe(1);
    // Same anchors, same verification flags: the two representations differ in
    // publication state, not in what the authored evidence says.
    expect(browserView.totalAnchors).toBe(serverView.totalAnchors);
    expect(browserView.unverifiedAnchors).toBe(serverView.unverifiedAnchors);
  });

  it("never labels a published hop as draft on either representation", () => {
    const published = knowledgeBase.find(
      (mapping) =>
        !mapping.draft &&
        mapping.suggestions.length > 0 &&
        mapping.suggestions[0]!.sourceReferences.length > 0,
    );
    expect(published, "fixture: a published mapping with authored evidence").toBeDefined();
    const suggestion = published!.suggestions[0]!;
    const publishedGraph = [
      node(published!.id, [suggestion.conditionId, 1, suggestion.nexusClaim.nexusClassification]),
    ];

    const serverView = buildGraphPathwayMatchSectionViewFromData(
      catalog,
      knowledgeBase,
      browserGraph(publishedGraph),
      [published!.id],
      [suggestion.conditionId],
    );
    expect(serverView.matches).toHaveLength(1);
    expect(serverView.matches[0]?.includesDraftAuthoredEvidence).toBe(false);
    expect(serverView.draftAuthoredMatches).toBe(0);

    // The browser's rule is "absent ⇒ draft-backed", so a published mapping it
    // CAN see must stay unlabelled — otherwise the disclosure would be noise.
    const corpus = buildClientCorpus(catalog, knowledgeBase, publishedGraph);
    expect(corpus.publishedMappings.some((mapping) => mapping.id === published!.id)).toBe(true);
    const browserView = buildGraphPathwayMatchSectionViewFromData(
      corpus.conditions,
      corpus.publishedMappings,
      browserGraph(corpus.graph),
      [published!.id],
      [suggestion.conditionId],
      clientCorpusGraphAnchorIndex(corpus),
    );
    expect(browserView.matches[0]?.includesDraftAuthoredEvidence).toBe(false);
    expect(browserView.draftAuthoredMatches).toBe(0);
  });

  it("carries provenance per hop and aggregates it onto the pathway", () => {
    // Aggregation rule (stub resolvers, so this pins the rule itself rather
    // than the corpus): a pathway resting on ANY draft-backed hop is a research
    // route, and each hop still states its own state.
    const pathway: ClaimPathway = {
      originConditionId: "origin",
      terminalConditionId: "terminal",
      compositeNexus: "AGGRAVATION",
      hops: [
        hop(0, "origin", "midpoint", "DIRECT_CAUSATION"),
        hop(1, "midpoint", "terminal", "AGGRAVATION"),
      ],
    };
    const anchor = [{ label: "PMID 1", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/1/", verified: false }];

    const allPublished = projectGraphPathway(pathway, (id) => id, () => anchor, () => false);
    expect(allPublished.includesDraftAuthoredEvidence).toBe(false);
    expect(allPublished.hops.map((entry) => entry.authoredDraft)).toEqual([false, false]);

    const secondHopDraft = projectGraphPathway(
      pathway,
      (id) => id,
      () => anchor,
      (sourceConditionId) => sourceConditionId === "midpoint",
    );
    expect(secondHopDraft.hops.map((entry) => entry.authoredDraft)).toEqual([false, true]);
    expect(secondHopDraft.includesDraftAuthoredEvidence).toBe(true);
  });

  it("derives browser provenance from absence, not from a guess about the corpus", () => {
    /** A real mapping shape with the fixture's publication state. */
    const mapping = (draft: boolean) => ({
      ...structuredClone(knowledgeBase.find((entry) => entry.id === DRAFT_ORIGIN)!),
      draft,
    });

    const publishedOnly = mappingProvenanceResolver(new Map([[DRAFT_ORIGIN, mapping(false)]]));
    // Present and published → published.
    expect(publishedOnly(DRAFT_ORIGIN)).toBe(false);
    // Absent from a published-only corpus → draft-backed, because the client
    // cannot see the draft. It must never be reported as published.
    expect(publishedOnly("some-draft-backed-condition")).toBe(true);

    // On the server the authored flag is authoritative.
    const withDraft = mappingProvenanceResolver(new Map([[DRAFT_ORIGIN, mapping(true)]]));
    expect(withDraft(DRAFT_ORIGIN)).toBe(true);
  });

  it("feeds the engine and the graph builder the same published-only corpus in the browser", () => {
    // The separation is only real if it holds at the call site: a draft-backed
    // route cannot reach a published result while the graph builder is handed a
    // corpus that still contains drafts.
    const source = readFileSync(
      path.join(process.cwd(), "src/components/secondary/steps/SuggestionsStep.tsx"),
      "utf8",
    );
    expect(source).toMatch(/recommend\(\s*corpus\.conditions,\s*corpus\.publishedMappings,/);
    expect(source).toMatch(/buildGraphPathwayMatchSectionViewFromData\(\s*corpus\.conditions,\s*corpus\.publishedMappings,/);
    expect(source).not.toMatch(/recommend\(\s*corpus\.conditions,\s*corpus\.(graph|fullMappings)/);
  });
});
