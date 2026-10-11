import fs from "node:fs";
import path from "node:path";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { readFileSync } from "node:fs";

import {
  CHAIN_BREAK_NOTICE,
  CITATION_TRIAGE_GUARD,
  POPULATION_LEVEL_GUARD,
} from "@/components/pathways/PathwayExplorer";
import {
  GRAPH_ROUTE_SECTION_GUARD,
  GRAPH_ROUTE_SECTION_HEADING,
  GraphPathwayReview,
} from "@/components/secondary/GraphPathwayReview";
import {
  clientCorpusGraphAnchorIndex,
  parseClientCorpus,
} from "@/lib/client-corpus";
import { buildGraphPathwayMatchSectionView } from "@/lib/engine/graph-pathway-matches";
import { buildGraphPathwayMatchSectionViewFromData } from "@/lib/engine/graph-pathway-matches-core";
import type {
  GraphPathwayMatchSectionView,
  GraphPathwayMatchView,
} from "@/lib/engine/pathway-view";
import { COMPOSITE_NEXUS_SUMMARY, NEXUS_CLAIM_LABEL } from "@/lib/evidence/pathway-mapper";
import { FORBIDDEN_PHRASES } from "@/lib/guardrails";

vi.mock("next/headers", () => ({
  cookies: async () => new Map(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => React.createElement("a", { href, className }, children),
}));

/**
 * Results-UI graph-pathway surface contract.
 *
 * The signed adjacency-graph routes must be visible in the Step 5 review
 * without ever reading as an established nexus:
 *
 * 1. The builder surfaces the shipped routes when a review selected both of
 *    their endpoints (service-connected origin → diagnosed non-service-connected
 *    terminal) and surfaces nothing otherwise — an empty match is not a
 *    finding.
 * 2. The component carries the association-only chain-break semantics shared
 *    with the `/pathways` explorer: the same chain-break notice, population
 *    guard, citation-triage guard, and composite-nexus summary, with the
 *    section guard explaining that these routes are additional to the
 *    published-relationship results and may rest on draft mappings.
 * 3. Non-broken chains render their own summary and never inherit the
 *    chain-break disclosure; every route still carries the population guard.
 * 4. Raw nexus enums never reach the DOM (label-only badges), and no
 *    forbidden claim-advice phrases render.
 * 5. The results page composes the builder and the section, and keeps the
 *    presentation layer plain-data while the builder stays the server-only
 *    graph consumer.
 */

const read = (relativePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const emptyView: GraphPathwayMatchSectionView = {
  matches: [],
  totalAnchors: 0,
  unverifiedAnchors: 0,
};

function sectionView(matches: GraphPathwayMatchView[]): GraphPathwayMatchSectionView {
  const anchors = matches.flatMap((match) => match.hops).flatMap((hop) => hop.anchors);
  return {
    matches,
    totalAnchors: anchors.length,
    unverifiedAnchors: anchors.filter((anchor) => !anchor.verified).length,
  };
}

const verifiedAnchor = {
  label: "PMID 26266324",
  sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/26266324/",
  verified: true,
};

const unverifiedAnchor = {
  label: "PMID 37274463",
  sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/37274463/",
  verified: false,
};

const associationMatch: GraphPathwayMatchView = {
  originConditionId: "fixture-origin",
  originConditionName: "Fixture Origin",
  terminalConditionId: "fixture-terminal",
  terminalConditionName: "Fixture Terminal",
  compositeNexus: "ASSOCIATION_ONLY_CHAIN_BROKEN",
  hops: [
    {
      stepIndex: 0,
      sourceConditionId: "fixture-origin",
      sourceConditionName: "Fixture Origin",
      targetConditionId: "fixture-terminal",
      targetConditionName: "Fixture Terminal",
      nexusClassification: "ASSOCIATION_ONLY",
      anchors: [verifiedAnchor, unverifiedAnchor],
    },
  ],
};

const directMatch: GraphPathwayMatchView = {
  originConditionId: "fixture-origin",
  originConditionName: "Fixture Origin",
  terminalConditionId: "fixture-terminal",
  terminalConditionName: "Fixture Terminal",
  compositeNexus: "DIRECT_CAUSATION",
  hops: [
    {
      stepIndex: 0,
      sourceConditionId: "fixture-origin",
      sourceConditionName: "Fixture Origin",
      targetConditionId: "fixture-terminal",
      targetConditionName: "Fixture Terminal",
      nexusClassification: "DIRECT_CAUSATION",
      anchors: [verifiedAnchor],
    },
  ],
};

const aggravationMatch: GraphPathwayMatchView = {
  originConditionId: "fixture-origin",
  originConditionName: "Fixture Origin",
  terminalConditionId: "fixture-terminal",
  terminalConditionName: "Fixture Terminal",
  compositeNexus: "AGGRAVATION",
  hops: [
    {
      stepIndex: 0,
      sourceConditionId: "fixture-origin",
      sourceConditionName: "Fixture Origin",
      targetConditionId: "fixture-midpoint",
      targetConditionName: "Fixture Midpoint",
      nexusClassification: "AGGRAVATION",
      anchors: [],
    },
    {
      stepIndex: 1,
      sourceConditionId: "fixture-midpoint",
      sourceConditionName: "Fixture Midpoint",
      targetConditionId: "fixture-terminal",
      targetConditionName: "Fixture Terminal",
      nexusClassification: "DIRECT_CAUSATION",
      anchors: [verifiedAnchor],
    },
  ],
};

describe("buildGraphPathwayMatchSectionView (live graph)", () => {
  it("matches every shipped adjacency route when a review selected both of its endpoints", () => {
    const shippedRoutes = [
      { origin: "liver-cancer", terminal: "sarcopenia" },
      { origin: "bruxism-awake-sleep", terminal: "tmj-disorder" },
      { origin: "alcohol-use-disorder", terminal: "chronic-liver-disease" },
    ];

    for (const { origin, terminal } of shippedRoutes) {
      const view = buildGraphPathwayMatchSectionView([origin], [terminal]);
      expect(view.matches).toHaveLength(1);
      expect(view.matches[0].originConditionId).toBe(origin);
      expect(view.matches[0].terminalConditionId).toBe(terminal);
      expect(view.matches[0].compositeNexus).toBe("ASSOCIATION_ONLY_CHAIN_BROKEN");
      expect(view.matches[0].hops).toHaveLength(1);
      expect(view.matches[0].hops[0].nexusClassification).toBe("ASSOCIATION_ONLY");
    }
  });

  it("joins the liver-cancer route's verified anchors and the alcohol route's pending anchors", () => {
    const verifiedRoute = buildGraphPathwayMatchSectionView(["liver-cancer"], ["sarcopenia"]);
    expect(verifiedRoute.totalAnchors).toBe(3);
    expect(verifiedRoute.unverifiedAnchors).toBe(0);
    expect(verifiedRoute.matches[0].hops[0].anchors.map((anchor) => anchor.label)).toEqual([
      "PMID 37274463",
      "PMID 36590214",
      "PMID 26266324",
    ]);

    const pendingRoute = buildGraphPathwayMatchSectionView(
      ["alcohol-use-disorder"],
      ["chronic-liver-disease"],
    );
    expect(pendingRoute.totalAnchors).toBe(3);
    expect(pendingRoute.unverifiedAnchors).toBe(3);
    expect(pendingRoute.matches[0].originConditionName).toMatch(/alcohol/i);
  });

  it("surfaces nothing when the graph connects none of the selected conditions", () => {
    // Terminal not selected, origin not selected, and an origin with no
    // adjacency node all yield an explicit empty section — never a finding.
    expect(buildGraphPathwayMatchSectionView(["liver-cancer"], ["tinnitus"]).matches).toEqual([]);
    expect(buildGraphPathwayMatchSectionView(["ptsd"], ["sarcopenia"]).matches).toEqual([]);
    expect(buildGraphPathwayMatchSectionView([], [])).toEqual(emptyView);
  });

  it("deduplicates origins so a repeated selection cannot double a route", () => {
    const view = buildGraphPathwayMatchSectionView(
      ["liver-cancer", "liver-cancer"],
      ["sarcopenia"],
    );
    expect(view.matches).toHaveLength(1);
    expect(view.totalAnchors).toBe(3);
  });
});

describe("GraphPathwayReview surface", () => {
  it("renders an association-only match with the shared chain-break semantics, never a nexus", () => {
    const html = renderToStaticMarkup(
      GraphPathwayReview({ view: sectionView([associationMatch]) }),
    );

    expect(html).toContain(GRAPH_ROUTE_SECTION_HEADING);
    expect(html).toContain("Fixture Origin → Fixture Terminal");
    expect(html).toContain("Association only — chain broken");
    expect(html).toContain("Chain broken — a research lead, not a nexus.");
    expect(html).toContain(CHAIN_BREAK_NOTICE);
    expect(html).toContain(COMPOSITE_NEXUS_SUMMARY.ASSOCIATION_ONLY_CHAIN_BROKEN);
    expect(html).toContain(NEXUS_CLAIM_LABEL.ASSOCIATION_ONLY);
    expect(html).toContain(POPULATION_LEVEL_GUARD);
    expect(html).toContain(GRAPH_ROUTE_SECTION_GUARD);

    // Citation anchors travel with the authored verification flag.
    expect(html).toContain("PMID 26266324");
    expect(html).toContain("PMID 37274463");
    expect(html).toContain('href="https://pubmed.ncbi.nlm.nih.gov/37274463/"');
    expect(html).toContain("Verified");
    expect(html).toContain("Unverified");
    expect(html).toContain("Awaiting qualified-human verification: 1 of the 2 citation anchors");
    expect(html).toContain(CITATION_TRIAGE_GUARD.replaceAll("'", "&#x27;"));

    // Raw enums never reach the DOM.
    expect(html).not.toContain("ASSOCIATION_ONLY");
    expect(html).not.toContain("CHAIN_BROKEN");
  });

  it("renders a non-broken chain without the chain-break disclosure but keeps the population guard", () => {
    const html = renderToStaticMarkup(GraphPathwayReview({ view: sectionView([directMatch]) }));

    expect(html).toContain("Direct causation chain");
    expect(html).toContain(COMPOSITE_NEXUS_SUMMARY.DIRECT_CAUSATION);
    expect(html).toContain(NEXUS_CLAIM_LABEL.DIRECT_CAUSATION);
    expect(html).toContain("No route below is association-only.");
    expect(html).not.toContain(CHAIN_BREAK_NOTICE);
    expect(html.toLowerCase()).not.toContain("chain broken");
    expect(html).toContain(POPULATION_LEVEL_GUARD);
  });

  it("labels every hop of a multi-hop match and keeps the intermediate names visible", () => {
    const html = renderToStaticMarkup(GraphPathwayReview({ view: sectionView([aggravationMatch]) }));

    expect(html).toContain("Hop 1: Fixture Origin → Fixture Midpoint");
    expect(html).toContain("Hop 2: Fixture Midpoint → Fixture Terminal");
    expect(html).toContain("Aggravation chain");
    expect(html).toContain(NEXUS_CLAIM_LABEL.AGGRAVATION);
    expect(html).not.toContain(CHAIN_BREAK_NOTICE);
  });

  it("renders nothing at all when no route connects the selections", () => {
    expect(renderToStaticMarkup(GraphPathwayReview({ view: emptyView }))).toBe("");
  });

  it("never leaks raw nexus enums into any rendered section", () => {
    for (const view of [
      sectionView([associationMatch]),
      sectionView([directMatch]),
      sectionView([aggravationMatch]),
    ]) {
      const html = renderToStaticMarkup(GraphPathwayReview({ view }));
      expect(html).not.toContain("ASSOCIATION_ONLY");
      expect(html).not.toContain("DIRECT_CAUSATION");
      expect(html).not.toContain("AGGRAVATION");
    }
  });

  it("does not render forbidden claim-advice phrases", () => {
    const html = renderToStaticMarkup(
      GraphPathwayReview({ view: sectionView([associationMatch]) }),
    ).toLowerCase();
    for (const phrase of FORBIDDEN_PHRASES) {
      expect(html).not.toContain(phrase.toLowerCase());
    }
  });
});

describe("Step 5 results page integration (client corpus path)", () => {
  // PRIV-01 stage 2: Step 5 runs the same builders in the browser over the
  // public corpus artifact. This exercises the exact client data path — the
  // generated corpus, the data-in builder, and the shared surface — so a
  // corpus that lost the graph routes or their anchor flags still fails here.
  const corpus = parseClientCorpus(
    JSON.parse(
      readFileSync(path.join(process.cwd(), "public", "kb", "client-corpus.json"), "utf8"),
    ),
  );
  const corpusGraph = new Map(corpus.graph.map((node) => [node.nodeId, node] as const));

  it("surfaces the shipped graph route for matching selections with its chain broken", () => {
    const view = buildGraphPathwayMatchSectionViewFromData(
      corpus.conditions,
      corpus.publishedMappings,
      corpusGraph,
      ["liver-cancer"],
      ["sarcopenia"],
      clientCorpusGraphAnchorIndex(corpus),
    );
    const html = renderToStaticMarkup(GraphPathwayReview({ view }));

    expect(html).toContain(GRAPH_ROUTE_SECTION_HEADING);
    expect(html).toContain("Liver Cancer → Sarcopenia");
    expect(html).toContain("Association only — chain broken");
    expect(html).toContain(CHAIN_BREAK_NOTICE);
    expect(html).toContain(GRAPH_ROUTE_SECTION_GUARD);
    expect(html).toContain(POPULATION_LEVEL_GUARD);
    expect(html).toContain("PMID 37274463");
    expect(html).not.toContain("ASSOCIATION_ONLY");
  });

  it("omits the section when the graph connects none of the selections", () => {
    const view = buildGraphPathwayMatchSectionViewFromData(
      corpus.conditions,
      corpus.publishedMappings,
      corpusGraph,
      ["ptsd"],
      ["sarcopenia"],
    );
    const html = renderToStaticMarkup(GraphPathwayReview({ view }));

    expect(html).not.toContain(GRAPH_ROUTE_SECTION_HEADING);
    expect(html).not.toContain(CHAIN_BREAK_NOTICE);
  });
});

describe("results-UI graph-pathway architecture", () => {
  it("keeps the component plain-data and the builder data-in on both hosts", () => {
    const componentSource = read("src/components/secondary/GraphPathwayReview.tsx");
    const coreSource = read("src/lib/engine/graph-pathway-matches-core.ts");
    const serverSource = read("src/lib/engine/graph-pathway-matches.ts");
    const stepSource = read("src/components/secondary/steps/SuggestionsStep.tsx");

    // The component is a presentation layer: it must not reach for loaders.
    expect(componentSource).not.toContain("server-only");
    expect(componentSource).not.toContain("@/lib/kb");
    expect(componentSource).not.toContain("@/lib/engine/graph-pathway-matches");

    // The data-in core is client-safe: no server marker, no file loaders.
    expect(coreSource).not.toContain("server-only");
    expect(coreSource).not.toContain("@/lib/kb/load");
    expect(coreSource).toContain("generateClaimPathways");

    // The server wrapper is a thin loader that delegates to the core.
    expect(serverSource).toContain('import "server-only"');
    expect(serverSource).toContain("loadKbGraph");
    expect(serverSource).toContain("buildGraphPathwayMatchSectionViewFromData");

    // The client step composes the core builder and the section from the
    // public corpus.
    expect(stepSource).toContain("buildGraphPathwayMatchSectionViewFromData");
    expect(stepSource).toContain("<GraphPathwayReview");
  });

  it("shares the explorer's disclosure constants so the two surfaces cannot drift", () => {
    const componentSource = read("src/components/secondary/GraphPathwayReview.tsx");

    expect(componentSource).toContain('from "@/components/pathways/PathwayExplorer"');
    expect(componentSource).toContain("CHAIN_BREAK_NOTICE");
    expect(componentSource).toContain("POPULATION_LEVEL_GUARD");
    expect(componentSource).toContain("CITATION_TRIAGE_GUARD");
    expect(componentSource).toContain("COMPOSITE_NEXUS_SUMMARY");
    expect(componentSource).toContain("NEXUS_CLAIM_LABEL");
  });
});
