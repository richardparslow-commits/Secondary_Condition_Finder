import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import PathwaysPage from "@/app/pathways/page";
import {
  CHAIN_BREAK_NOTICE,
  CITATION_TRIAGE_GUARD,
  EMPTY_GRAPH_NOTICE,
  EMPTY_ORIGIN_NOTICE,
  POPULATION_LEVEL_GUARD,
  PathwayExplorer,
} from "@/components/pathways/PathwayExplorer";
import { FORBIDDEN_PHRASES } from "@/lib/guardrails";
import type {
  GraphPathwayAnchorView,
  GraphPathwayExplorerView,
  GraphPathwayView,
} from "@/lib/engine/pathway-view";
import { COMPOSITE_NEXUS_SUMMARY, NEXUS_CLAIM_LABEL } from "@/lib/evidence/pathway-mapper";

/**
 * Pathway explorer surface contract — the adjacency graph's first user-facing
 * consumer (`/pathways`).
 *
 * The honesty contract these tests pin:
 *
 * 1. The shipped graph renders: `liver-cancer` → `sarcopenia`, the graph's
 *    first real authored edge (ASSOCIATION_ONLY), appears with its legal chain
 *    marked broken and never as a nexus.
 * 2. Association-only semantics are structural: the chain-break notice is
 *    present exactly when the composite nexus is
 *    `ASSOCIATION_ONLY_CHAIN_BROKEN`, the per-hop classification travels
 *    through the shared `NEXUS_CLAIM_LABEL`, and raw enum values never reach
 *    the DOM.
 * 2b. Each hop lists its authored citation anchors with the corpus's own
 *    verification flag, so unverified evidence is triageable from the page;
 *    the surface renders the flag it was handed and derives no status.
 * 3. Direct-causation and aggravation chains render their own summaries and
 *    never inherit the association-only disclosure — and every chain still
 *    carries the population-level guard.
 * 4. Empty states (no graph, or an origin with no authored edges) say
 *    explicitly that an empty result is not a finding.
 * 5. Architecture: the presentation layer takes plain data (no kb/server-only
 *    imports), the builder is the server-only graph consumer, and the page
 *    keeps condition selections out of query strings.
 */

const read = (relativePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const emptyView: GraphPathwayExplorerView = {
  origins: [],
  totalPathways: 0,
  chainBrokenPathways: 0,
  totalAnchors: 0,
  unverifiedAnchors: 0,
};

const verifiedAnchor: GraphPathwayAnchorView = {
  label: "PMID 26266324",
  sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/26266324/",
  verified: true,
};

const unverifiedAnchor: GraphPathwayAnchorView = {
  label: "PMID 37274463",
  sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/37274463/",
  verified: false,
};

function singleOriginView(pathways: GraphPathwayView[]): GraphPathwayExplorerView {
  const anchors = pathways.flatMap((pathway) => pathway.hops).flatMap((hop) => hop.anchors);
  return {
    origins: [
      {
        originConditionId: "fixture-origin",
        originConditionName: "Fixture Origin",
        pathways,
      },
    ],
    totalPathways: pathways.length,
    chainBrokenPathways: pathways.filter(
      (pathway) => pathway.compositeNexus === "ASSOCIATION_ONLY_CHAIN_BROKEN",
    ).length,
    totalAnchors: anchors.length,
    unverifiedAnchors: anchors.filter((anchor) => !anchor.verified).length,
  };
}

const associationOnlyView = singleOriginView([
  {
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
  },
]);

const directCausationView = singleOriginView([
  {
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
  },
]);

const aggravationView = singleOriginView([
  {
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
  },
]);

describe("pathway explorer surface", () => {
  it("renders the shipped association-only pathway with a broken chain, never as a nexus", () => {
    const html = renderToStaticMarkup(PathwaysPage());

    expect(html).toContain("Claim pathway explorer");
    expect(html).toContain("Liver Cancer");
    expect(html).toContain("Sarcopenia");
    expect(html).toContain("Association only — chain broken");
    expect(html).toContain("Chain broken — a research lead, not a nexus.");
    expect(html).toContain(CHAIN_BREAK_NOTICE);
    expect(html).toContain(NEXUS_CLAIM_LABEL.ASSOCIATION_ONLY);
    expect(html).toContain(POPULATION_LEVEL_GUARD);

    // Citation anchors joined from the authored corpus for this shipped edge.
    expect(html).toContain("PMID 37274463");
    expect(html).toContain("PMID 36590214");
    expect(html).toContain("PMID 26266324");
    // Static markup escapes the apostrophe; compare against the rendered form.
    expect(html).toContain(CITATION_TRIAGE_GUARD.replaceAll("'", "&#x27;"));
  });

  it("lists each hop's citation anchors with the corpus's verification status for triage", () => {
    const html = renderToStaticMarkup(PathwayExplorer({ view: associationOnlyView }));

    expect(html).toContain("Citation anchors");
    expect(html).toContain("PMID 26266324");
    expect(html).toContain("PMID 37274463");
    expect(html).toContain('href="https://pubmed.ncbi.nlm.nih.gov/37274463/"');
    expect(html).toContain('target="_blank"');
    // Both statuses render from the handed flag — nothing is derived here.
    expect(html).toContain("Verified");
    expect(html).toContain("Unverified");
    expect(html).toContain(CITATION_TRIAGE_GUARD.replaceAll("'", "&#x27;"));
    expect(html).toContain("Awaiting qualified-human verification: 1 of the 2 citation anchors");
  });

  it("keeps the shipped page to one main landmark and one top-level heading", () => {
    const html = renderToStaticMarkup(PathwaysPage());
    expect((html.match(/<main/g) ?? []).length).toBe(1);
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
    expect(html).toContain("What this does not mean");
  });

  it("never leaks raw nexus enum values into the rendered page or component", () => {
    const pageHtml = renderToStaticMarkup(PathwaysPage());
    const componentHtml = renderToStaticMarkup(
      PathwayExplorer({ view: associationOnlyView }),
    );

    for (const html of [pageHtml, componentHtml]) {
      expect(html).not.toContain("ASSOCIATION_ONLY");
      expect(html).not.toContain("DIRECT_CAUSATION");
      expect(html).not.toContain("AGGRAVATION");
    }
  });

  it("does not render forbidden claim-advice phrases", () => {
    const pageHtml = renderToStaticMarkup(PathwaysPage());
    const lower = pageHtml.toLowerCase();
    for (const phrase of FORBIDDEN_PHRASES) {
      expect(lower).not.toContain(phrase.toLowerCase());
    }
  });

  it("renders the association-only disclosure only when the composite nexus is chain-broken", () => {
    const associationHtml = renderToStaticMarkup(
      PathwayExplorer({ view: associationOnlyView }),
    );
    const directHtml = renderToStaticMarkup(
      PathwayExplorer({ view: directCausationView }),
    );
    const aggravationHtml = renderToStaticMarkup(
      PathwayExplorer({ view: aggravationView }),
    );

    // Association-only: chain-break notice present, badge and shared label present.
    expect(associationHtml).toContain(CHAIN_BREAK_NOTICE);
    expect(associationHtml).toContain("Association only");
    expect(associationHtml).toContain(NEXUS_CLAIM_LABEL.ASSOCIATION_ONLY);

    // Direct causation: its own summary and badge, no chain-break disclosure.
    expect(directHtml).toContain(COMPOSITE_NEXUS_SUMMARY.DIRECT_CAUSATION);
    expect(directHtml).toContain("Direct causation chain");
    expect(directHtml).toContain(NEXUS_CLAIM_LABEL.DIRECT_CAUSATION);
    expect(directHtml).not.toContain(CHAIN_BREAK_NOTICE);
    expect(directHtml.toLowerCase()).not.toContain("chain broken");

    // Aggravation: its own summary, two labelled hops, no chain-break disclosure.
    expect(aggravationHtml).toContain(COMPOSITE_NEXUS_SUMMARY.AGGRAVATION);
    expect(aggravationHtml).toContain("Aggravation chain");
    expect(aggravationHtml).toContain("Hop 2: Fixture Midpoint → Fixture Terminal");
    expect(aggravationHtml).not.toContain(CHAIN_BREAK_NOTICE);
  });

  it("carries the population-level guard on every chain, including direct causation", () => {
    for (const view of [associationOnlyView, directCausationView, aggravationView]) {
      const html = renderToStaticMarkup(PathwayExplorer({ view }));
      expect(html).toContain(POPULATION_LEVEL_GUARD);
    }
  });

  it("renders an empty graph as an explicit non-finding state", () => {
    const html = renderToStaticMarkup(PathwayExplorer({ view: emptyView }));

    expect(html).toContain("No adjacency pathways are registered yet");
    expect(html).toContain(EMPTY_GRAPH_NOTICE);
    expect(html.toLowerCase()).toContain("not a finding");
    expect(html).not.toContain(CHAIN_BREAK_NOTICE);
  });

  it("renders a zero-edge origin as an explicit non-finding state", () => {
    const html = renderToStaticMarkup(
      PathwayExplorer({ view: singleOriginView([]) }),
    );

    expect(html).toContain(EMPTY_ORIGIN_NOTICE);
    expect(html.toLowerCase()).toContain("not a finding");
    expect(html).toContain("No pathway on this page is association-only.");
    expect(html).not.toContain("Awaiting qualified-human verification");
  });

  it("keeps raw nexus enums out of React keys, which Next serializes into the RSC payload", () => {
    const componentSource = read("src/components/pathways/PathwayExplorer.tsx");
    const keyTemplates = componentSource.match(/key=\{`[^`]*`\}/g) ?? [];

    // The pin must actually be inspecting rendered keys.
    expect(keyTemplates.length).toBeGreaterThan(0);
    for (const template of keyTemplates) {
      expect(template).not.toContain("compositeNexus");
      expect(template).not.toContain("nexusClassification");
    }
  });

  it("keeps the presentation layer plain-data and the builder server-only", () => {
    const componentSource = read("src/components/pathways/PathwayExplorer.tsx");
    const builderSource = read("src/lib/engine/pathway-explorer.ts");
    const pageSource = read("src/app/pathways/page.tsx");

    // The component is a presentation layer: it must not reach for loaders.
    expect(componentSource).not.toContain("server-only");
    expect(componentSource).not.toContain("@/lib/kb");
    expect(componentSource).not.toContain("@/lib/engine/pathway-explorer");

    // The builder is the sanctioned server-only graph consumer.
    expect(builderSource).toContain('import "server-only"');
    expect(builderSource).toContain("loadKbGraph");
    expect(builderSource).toContain("generateClaimPathways");

    // The page composes the builder and the explorer.
    expect(pageSource).toContain("buildPathwayExplorerView");
    expect(pageSource).toContain("<PathwayExplorer");
    // Condition selections stay out of query strings (privacy contract).
    expect(pageSource).not.toContain("?origin=");
    expect(componentSource).not.toContain("?origin=");
  });
});
