import fs from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PathwaysPage from "@/app/pathways/page";
import {
  CHAIN_BREAK_NOTICE,
  POPULATION_LEVEL_GUARD,
} from "@/components/pathways/PathwayExplorer";
import { buildPathwayExplorerView } from "@/lib/engine/pathway-explorer";
import {
  COMPOSITE_NEXUS_SUMMARY,
  NEXUS_CLAIM_LABEL,
} from "@/lib/evidence/pathway-mapper";
import { KB_GRAPH_DIR_RELATIVE } from "@/lib/kb/graph-layout";
import { MAX_PATHWAY_HOPS } from "@/lib/kb/pathway-depth";

/**
 * End-to-end rendering contract for `/pathways` over the SHIPPED catalog and
 * adjacency graph.
 *
 * `tests/pathway-explorer-surface.test.ts` pins the component contract with
 * fixtures; this suite drives the real page and its real data path end to end:
 *
 *   PathwaysPage()
 *     → buildPathwayExplorerView()
 *       → loadKbGraph()          (data/knowledge-base/graph/*.json)
 *       → loadConditionCatalog() (data/conditions/*.json)
 *       → loadKnowledgeBase()    (data/knowledge-base/<condition>.json)
 *       → generateClaimPathways() + projectGraphPathway()
 *     → PathwayExplorer (server-rendered markup)
 *
 * The expected values come from an INDEPENDENT oracle that parses those same
 * raw JSON files directly and re-derives route names, hop chains, composite
 * nexus precedence, and citation joins from the documented contract. It never
 * calls the engine's loaders or projections, so the suite proves three-way
 * agreement — raw files ≡ builder view ≡ rendered HTML — and fails if the
 * page's data path silently drops, renames, reorders, or re-verifies a route
 * even while the fixture-based surface tests still pass.
 *
 * The shipped graph carries five one-hop ASSOCIATION_ONLY routes (Stage 3b
 * liver-cancer→sarcopenia; Stage 3a alcohol-use-disorder→
 * chronic-liver-disease; Stage 3c bruxism-awake-sleep→tmj-disorder; batch 95
 * stress-fractures→malunion-nonunion-of-fractures and
 * stress-urinary-incontinence→depressive-disorder), so the page must mark
 * every one legally broken, join each hop's authored anchors with the corpus's
 * own verified flag, and resolve every display name from the catalog. The live
 * pins below (five routes, fourteen anchors, eleven pending) move only when a
 * route, an anchor, or a verification actually lands — never to make CI green.
 */

const GRAPH_DIR = path.join(process.cwd(), KB_GRAPH_DIR_RELATIVE);
const CATALOG_DIR = path.join(process.cwd(), "data", "conditions");
const KB_DIR = path.join(process.cwd(), "data", "knowledge-base");

type NexusClassification = "DIRECT_CAUSATION" | "AGGRAVATION" | "ASSOCIATION_ONLY";
type CompositeNexus =
  | "DIRECT_CAUSATION"
  | "AGGRAVATION"
  | "ASSOCIATION_ONLY_CHAIN_BROKEN";

interface RawEdge {
  rank: number;
  targetConditionId: string;
  nexusClassification: string;
  nexusStatus?: string;
  mechanismCategory?: string;
  etiologicalConsensus?: string;
  vaNexusProbabilityAlignment?: string;
}

interface RawNode {
  nodeId: string;
  edges: RawEdge[];
}

interface OracleAnchor {
  label: string;
  sourceUrl?: string;
  verified: boolean;
}

interface OracleHop {
  stepIndex: number;
  sourceConditionId: string;
  sourceConditionName: string;
  targetConditionId: string;
  targetConditionName: string;
  nexusClassification: NexusClassification;
  anchors: OracleAnchor[];
}

interface OraclePathway {
  terminalConditionId: string;
  terminalConditionName: string;
  compositeNexus: CompositeNexus;
  hops: OracleHop[];
}

interface OracleOrigin {
  originConditionId: string;
  originConditionName: string;
  pathways: OraclePathway[];
}

interface OracleView {
  origins: OracleOrigin[];
  totalPathways: number;
  chainBrokenPathways: number;
  totalAnchors: number;
  unverifiedAnchors: number;
}

function readJsonFile(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

/** Parse every adjacency node file exactly as authored, with no loader help. */
function readRawNodes(): RawNode[] {
  return fs
    .readdirSync(GRAPH_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((file) => {
      const parsed = readJsonFile(path.join(GRAPH_DIR, file)) as {
        nodeId: string;
        outgoingEdges: {
          sourceConditionId: string;
          targetConditionId: string;
          rank: number;
          nexusClaim: { nexusClassification: string; status?: string };
          causalMechanism?: { mechanismCategory?: string };
          evidentiaryProfile?: {
            etiologicalConsensus?: string;
            vaNexusProbabilityAlignment?: string;
          };
        }[];
      };

      // The loader's filename↔nodeId contract, pinned independently here.
      expect(path.basename(file, ".json")).toBe(parsed.nodeId);

      const edges = [...parsed.outgoingEdges]
        .sort((a, b) => a.rank - b.rank)
        .map((edge) => {
          // An edge must depart the node file that carries it; a misoriented
          // row would otherwise attach a route to the wrong origin.
          expect(edge.sourceConditionId).toBe(parsed.nodeId);
          return {
            rank: edge.rank,
            targetConditionId: edge.targetConditionId,
            nexusClassification: edge.nexusClaim.nexusClassification,
            nexusStatus: edge.nexusClaim.status,
            mechanismCategory: edge.causalMechanism?.mechanismCategory,
            etiologicalConsensus: edge.evidentiaryProfile?.etiologicalConsensus,
            vaNexusProbabilityAlignment:
              edge.evidentiaryProfile?.vaNexusProbabilityAlignment,
          };
        });

      return { nodeId: parsed.nodeId, edges };
    });
}

/** Catalog ID → display name, read from the raw condition files. */
function readCatalogNames(): Map<string, string> {
  const names = new Map<string, string>();
  for (const file of fs
    .readdirSync(CATALOG_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()) {
    const parsed = readJsonFile(path.join(CATALOG_DIR, file)) as {
      conditions: { id: string; name: string }[];
    };
    for (const condition of parsed.conditions) {
      names.set(condition.id, condition.name);
    }
  }
  return names;
}

const PUBMED_URL_PATTERN = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i;

/**
 * The oracle's independent statement of the anchor-label contract: the PMID
 * for a PubMed record, the source host otherwise, "Citation" as the last
 * resort.
 */
function oracleAnchorLabel(sourceUrl?: string): string {
  const pmid = sourceUrl?.match(PUBMED_URL_PATTERN)?.[1];
  if (pmid) return `PMID ${pmid}`;
  if (sourceUrl) {
    try {
      return new URL(sourceUrl).hostname;
    } catch {
      // Fall through to the generic label for an unparsable URL.
    }
  }
  return "Citation";
}

/**
 * The authored anchors for one hop, joined by (source mapping, target
 * condition) exactly as the authored corpus registers them. The graph edge
 * and the suggestion are authored in lockstep, so a missing suggestion yields
 * no anchors rather than an invented one.
 */
function readAuthoredAnchors(
  sourceConditionId: string,
  targetConditionId: string,
): OracleAnchor[] {
  const parsed = readJsonFile(
    path.join(KB_DIR, `${sourceConditionId}.json`),
  ) as {
    suggestions: {
      conditionId: string;
      sourceReferences?: { sourceUrl?: string; verified?: boolean }[];
    }[];
  };
  const suggestion = parsed.suggestions.find(
    (candidate) => candidate.conditionId === targetConditionId,
  );
  return (suggestion?.sourceReferences ?? []).map((reference) => ({
    label: oracleAnchorLabel(reference.sourceUrl),
    sourceUrl: reference.sourceUrl,
    verified: reference.verified === true,
  }));
}

/** VA proximate-cause precedence: association-only breaks the chain. */
function deriveOracleComposite(
  classifications: readonly NexusClassification[],
): CompositeNexus {
  if (classifications.includes("ASSOCIATION_ONLY")) {
    return "ASSOCIATION_ONLY_CHAIN_BROKEN";
  }
  if (classifications.includes("AGGRAVATION")) return "AGGRAVATION";
  return "DIRECT_CAUSATION";
}

/**
 * Independent traversal mirroring the documented generator spec: depth-first
 * in ascending rank order, a branch set for cycles, the shared hop cap, every
 * emitted hop carrying its anchors, and no descent past a chain-broken
 * association-only hop.
 */
function oraclePathways(
  nodeId: string,
  nodesById: ReadonlyMap<string, RawNode>,
  nameOf: (conditionId: string) => string,
): OraclePathway[] {
  const pathways: OraclePathway[] = [];
  const chain: OracleHop[] = [];
  const branch = new Set<string>([nodeId]);

  const visit = (currentId: string): void => {
    if (chain.length >= MAX_PATHWAY_HOPS) return;
    const node = nodesById.get(currentId);
    if (!node) return;

    for (const edge of node.edges) {
      if (branch.has(edge.targetConditionId)) continue;

      chain.push({
        stepIndex: chain.length,
        sourceConditionId: currentId,
        sourceConditionName: nameOf(currentId),
        targetConditionId: edge.targetConditionId,
        targetConditionName: nameOf(edge.targetConditionId),
        nexusClassification: edge.nexusClassification as NexusClassification,
        anchors: readAuthoredAnchors(currentId, edge.targetConditionId),
      });
      const compositeNexus = deriveOracleComposite(
        chain.map((hop) => hop.nexusClassification),
      );

      pathways.push({
        terminalConditionId: edge.targetConditionId,
        terminalConditionName: nameOf(edge.targetConditionId),
        compositeNexus,
        hops: chain.map((hop) => ({ ...hop })),
      });

      if (compositeNexus === "ASSOCIATION_ONLY_CHAIN_BROKEN") {
        chain.pop();
        continue;
      }
      branch.add(edge.targetConditionId);
      visit(edge.targetConditionId);
      branch.delete(edge.targetConditionId);
      chain.pop();
    }
  };

  visit(nodeId);
  return pathways;
}

/** The full expected explorer view, derived from raw disk only. */
function buildOracleView(): OracleView {
  const names = readCatalogNames();
  const nodes = readRawNodes();
  const nodesById = new Map(nodes.map((node) => [node.nodeId, node]));
  const nameOf = (conditionId: string): string =>
    names.get(conditionId) ?? conditionId;

  const origins: OracleOrigin[] = nodes.map((node) => ({
    originConditionId: node.nodeId,
    originConditionName: nameOf(node.nodeId),
    pathways: oraclePathways(node.nodeId, nodesById, nameOf),
  }));

  const allPathways = origins.flatMap((origin) => origin.pathways);
  const allAnchors = allPathways
    .flatMap((pathway) => pathway.hops)
    .flatMap((hop) => hop.anchors);

  return {
    origins,
    totalPathways: allPathways.length,
    chainBrokenPathways: allPathways.filter(
      (pathway) => pathway.compositeNexus === "ASSOCIATION_ONLY_CHAIN_BROKEN",
    ).length,
    totalAnchors: allAnchors.length,
    unverifiedAnchors: allAnchors.filter((anchor) => !anchor.verified).length,
  };
}

function renderPage(): string {
  return renderToStaticMarkup(PathwaysPage());
}

/** Decode the entities React's static markup emits in text nodes. */
function decodeText(text: string): string {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'");
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

describe("/pathways end-to-end over the real catalog and adjacency graph", () => {
  it("enumerates the shipped routes from raw disk as the source of truth", () => {
    const oracle = buildOracleView();

    expect(oracle.origins.map((origin) => origin.originConditionId)).toEqual([
      "alcohol-use-disorder",
      "bruxism-awake-sleep",
      "liver-cancer",
      "stress-fractures",
      "stress-urinary-incontinence",
    ]);
    expect(
      oracle.origins.map((origin) => [
        origin.originConditionId,
        origin.pathways.map((pathway) => pathway.terminalConditionId),
      ]),
    ).toEqual([
      ["alcohol-use-disorder", ["chronic-liver-disease"]],
      ["bruxism-awake-sleep", ["tmj-disorder"]],
      ["liver-cancer", ["sarcopenia"]],
      ["stress-fractures", ["malunion-nonunion-of-fractures"]],
      ["stress-urinary-incontinence", ["depressive-disorder"]],
    ]);

    // Live pins: five one-hop association-only routes, fourteen authored
    // anchors, eleven still pending qualified-human verification.
    expect(oracle.totalPathways).toBe(5);
    expect(oracle.chainBrokenPathways).toBe(5);
    expect(oracle.totalAnchors).toBe(14);
    expect(oracle.unverifiedAnchors).toBe(11);

    for (const origin of oracle.origins) {
      for (const pathway of origin.pathways) {
        expect(pathway.hops).toHaveLength(1);
        expect(pathway.compositeNexus).toBe("ASSOCIATION_ONLY_CHAIN_BROKEN");
      }
    }
  });

  it("agrees with the server-only builder that powers the page over the same raw files", () => {
    expect(buildPathwayExplorerView()).toEqual(buildOracleView());
  });

  it("renders every raw origin, pathway, and hop with catalog display names", () => {
    const oracle = buildOracleView();
    const html = renderPage();

    const originHeadings = [
      ...html.matchAll(/<h2 id="pathway-origin-([^"]+)"[^>]*>([^<]*)<\/h2>/g),
    ].map((match) => ({ id: match[1], name: decodeText(match[2]) }));
    expect(originHeadings).toEqual(
      oracle.origins.map((origin) => ({
        id: origin.originConditionId,
        name: origin.originConditionName,
      })),
    );

    const cardTitles = [
      ...html.matchAll(
        /<h3 class="text-base font-semibold text-slate-900">([^<]*)<\/h3>/g,
      ),
    ].map((match) => decodeText(match[1]));
    expect(cardTitles).toEqual(
      oracle.origins.flatMap((origin) =>
        origin.pathways.map(
          (pathway) =>
            `${pathway.hops[0]?.sourceConditionName ?? pathway.terminalConditionName} → ${pathway.terminalConditionName}`,
        ),
      ),
    );

    const hopLines = [
      ...html.matchAll(
        /<p class="text-sm font-semibold text-slate-900">Hop ([0-9]+): ([^<]*)<\/p>/g,
      ),
    ].map((match) => `Hop ${match[1]}: ${decodeText(match[2])}`);
    expect(hopLines).toEqual(
      oracle.origins.flatMap((origin) =>
        origin.pathways.flatMap((pathway) =>
          pathway.hops.map(
            (hop) =>
              `Hop ${hop.stepIndex + 1}: ${hop.sourceConditionName} → ${hop.targetConditionName}`,
          ),
        ),
      ),
    );
  });

  it("marks every shipped route's chain broken and frames the page with the raw totals", () => {
    const oracle = buildOracleView();
    const html = renderPage();

    expect(html).toContain(
      `Viewing ${plural(oracle.totalPathways, "authored pathway", "authored pathways")} from ${plural(oracle.origins.length, "origin condition", "origin conditions")}.`,
    );
    expect(html).toContain(
      oracle.chainBrokenPathways === 0
        ? "No pathway on this page is association-only."
        : `${plural(oracle.chainBrokenPathways, "pathway is", "pathways are")} association-only, and ${oracle.chainBrokenPathways === 1 ? "its" : "their"} legal chain is broken below.`,
    );

    if (oracle.unverifiedAnchors === 0) {
      expect(html).toContain(
        `All ${plural(oracle.totalAnchors, "citation anchor", "citation anchors")} on this page are verified by qualified-human review.`,
      );
    } else {
      expect(html).toContain(
        `Awaiting qualified-human verification: ${oracle.unverifiedAnchors} of the ${plural(oracle.totalAnchors, "citation anchor", "citation anchors")} shown on this page.`,
      );
    }

    // One chain-break disclosure per chain-broken card, one population guard
    // for the page.
    expect(html.split(CHAIN_BREAK_NOTICE).length - 1).toBe(
      oracle.chainBrokenPathways,
    );
    expect(html.split(POPULATION_LEVEL_GUARD).length - 1).toBe(1);

    // Every card renders its composite-nexus summary; every hop renders its
    // shared nexus claim label.
    const summaryCounts = new Map<string, number>();
    const labelCounts = new Map<string, number>();
    for (const origin of oracle.origins) {
      for (const pathway of origin.pathways) {
        const summary = COMPOSITE_NEXUS_SUMMARY[pathway.compositeNexus];
        summaryCounts.set(summary, (summaryCounts.get(summary) ?? 0) + 1);
        for (const hop of pathway.hops) {
          const label = NEXUS_CLAIM_LABEL[hop.nexusClassification];
          labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
        }
      }
    }
    for (const [summary, count] of summaryCounts) {
      expect(html.split(summary).length - 1).toBe(count);
    }
    for (const [label, count] of labelCounts) {
      expect(html.split(label).length - 1).toBe(count);
    }
  });

  it("joins every hop's authored citation anchors with the corpus's own verified flags", () => {
    const oracle = buildOracleView();
    const html = renderPage();

    const renderedAnchors = [
      ...html.matchAll(
        /<li class="flex flex-wrap items-center gap-2 text-xs">([\s\S]*?)<\/li>/g,
      ),
    ].map((match) => ({
      label: decodeText(
        match[1].match(/<a[^>]*>([^<]*)<\/a>/)?.[1] ??
          match[1].match(
            /<span class="font-mono text-xs text-slate-900">([^<]*)<\/span>/,
          )?.[1] ??
          "",
      ),
      sourceUrl: match[1].match(/href="([^"]+)"/)?.[1],
      status: match[1].match(/>(Verified|Unverified)</)?.[1],
    }));

    const expectedAnchors = oracle.origins.flatMap((origin) =>
      origin.pathways.flatMap((pathway) =>
        pathway.hops.flatMap((hop) =>
          hop.anchors.map((anchor) => ({
            label: anchor.label,
            sourceUrl: anchor.sourceUrl,
            status: anchor.verified ? "Verified" : "Unverified",
          })),
        ),
      ),
    );

    expect(renderedAnchors).toEqual(expectedAnchors);
    expect(renderedAnchors.length).toBe(oracle.totalAnchors);
  });

  it("keeps every raw graph enum value out of the rendered page", () => {
    const html = renderPage();

    const enumValues = new Set<string>();
    for (const node of readRawNodes()) {
      for (const edge of node.edges) {
        for (const value of [
          edge.nexusClassification,
          edge.nexusStatus,
          edge.mechanismCategory,
          edge.etiologicalConsensus,
          edge.vaNexusProbabilityAlignment,
        ]) {
          if (value) enumValues.add(value);
        }
      }
    }
    expect(enumValues.size).toBeGreaterThan(0);
    for (const value of enumValues) {
      expect(html).not.toContain(value);
    }
  });

  it("renders deterministically across repeated calls with the loaders' caches warm", () => {
    const first = renderPage();
    expect(renderPage()).toBe(first);
    expect(renderPage()).toBe(first);
  });
});
