// @vitest-environment jsdom
/**
 * Automated accessibility gate (Section 508 / WCAG 2.1 AA).
 *
 * The docblock above is the environment opt-in: the suite default is `node`
 * (`vitest.config.ts`) because 300+ data and contract suites neither need nor
 * want a DOM, and axe-core cannot run without one. Mounting is done with
 * `@testing-library/react` so the components go through the same render path
 * they do in the browser, including effects — which is what the live-region
 * assertions below depend on.
 *
 * Read `tests/setup/accessibility.ts` for what the gate covers and, more
 * importantly, what it does not (color contrast is a manual item; keyboard
 * order and screen-reader usefulness are structurally checked elsewhere and
 * remain human-verification steps in
 * `docs/section508-manual-review-workbook.md`).
 */
import { cleanup, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";

import PathwaysPage from "@/app/pathways/page";
import { GraphPathwayReview } from "@/components/secondary/GraphPathwayReview";
import { PathwayExplorer } from "@/components/pathways/PathwayExplorer";
import { AriaLiveRegion, MAX_SPELLED_OUT_CONNECTIONS, describeMappedConnections, useAriaLive } from "@/lib/a11y/use-aria-live";
import type {
  GraphPathwayExplorerView,
  GraphPathwayHopView,
  GraphPathwayMatchSectionView,
} from "@/lib/engine/pathway-view";

import {
  AXE_BLOCKING_IMPACTS,
  AXE_JSOM_SKIPPED_RULES,
  expectNoBlockingA11yViolations,
} from "./setup/accessibility";

afterEach(cleanup);

/* ─── Fixtures ────────────────────────────────────────────────────────────
 * Real view types, not casts: a field rename in `pathway-view.ts` must break
 * this test at compile time, because an axe run against a malformed fixture
 * would happily report "no violations" for markup nobody ships.
 */

function hop(
  stepIndex: number,
  sourceConditionId: string,
  sourceConditionName: string,
  targetConditionId: string,
  targetConditionName: string,
  nexusClassification: GraphPathwayHopView["nexusClassification"] = "DIRECT_CAUSATION",
  authoredDraft = false,
): GraphPathwayHopView {
  return {
    stepIndex,
    sourceConditionId,
    sourceConditionName,
    targetConditionId,
    targetConditionName,
    nexusClassification,
    authoredDraft,
    anchors: [
      { label: "PMID 12345678", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/12345678/", verified: true },
      { label: "example.gov", verified: false },
    ],
  };
}

/**
 * A three-origin graph exercising every branch the visualizer can render: a
 * single hop, a two-hop chain, an association-only chain (which additionally
 * renders the chain-break notice), and an origin with no edges at all (the
 * explicit empty state).
 */
const EXPLORER_VIEW: GraphPathwayExplorerView = {
  origins: [
    {
      originConditionId: "ptsd",
      originConditionName: "Post-traumatic stress disorder",
      pathways: [
        {
          terminalConditionId: "sleep-apnea",
          terminalConditionName: "Sleep apnea",
          compositeNexus: "DIRECT_CAUSATION",
          includesDraftAuthoredEvidence: false,
          hops: [
            hop(0, "ptsd", "Post-traumatic stress disorder", "sleep-apnea", "Sleep apnea"),
          ],
        },
        {
          terminalConditionId: "hypertension",
          terminalConditionName: "Hypertension",
          compositeNexus: "DIRECT_CAUSATION",
          includesDraftAuthoredEvidence: false,
          hops: [
            hop(0, "ptsd", "Post-traumatic stress disorder", "sleep-apnea", "Sleep apnea"),
            hop(1, "sleep-apnea", "Sleep apnea", "hypertension", "Hypertension", "AGGRAVATION"),
          ],
        },
      ],
      pathwaysCapped: false,
    },
    {
      originConditionId: "tinnitus",
      originConditionName: "Tinnitus",
      pathways: [
        {
          terminalConditionId: "insomnia",
          terminalConditionName: "Insomnia",
          compositeNexus: "ASSOCIATION_ONLY_CHAIN_BROKEN",
          // Draft-backed on purpose: the axe gate then renders the draft
          // provenance notice as well as the chain-break notice (audit A08).
          includesDraftAuthoredEvidence: true,
          hops: [
            hop(0, "tinnitus", "Tinnitus", "insomnia", "Insomnia", "ASSOCIATION_ONLY", true),
          ],
        },
      ],
      pathwaysCapped: true,
    },
    {
      originConditionId: "no-edges",
      originConditionName: "Condition with no authored edges",
      pathways: [],
      pathwaysCapped: false,
    },
  ],
  totalPathways: 3,
  chainBrokenPathways: 1,
  draftAuthoredPathways: 1,
  cappedOrigins: 1,
  totalAnchors: 6,
  unverifiedAnchors: 3,
};

const MATCH_SECTION_VIEW: GraphPathwayMatchSectionView = {
  matches: [
    {
      originConditionId: "ptsd",
      originConditionName: "Post-traumatic stress disorder",
      terminalConditionId: "sleep-apnea",
      terminalConditionName: "Sleep apnea",
      compositeNexus: "DIRECT_CAUSATION",
      includesDraftAuthoredEvidence: false,
      hops: [hop(0, "ptsd", "Post-traumatic stress disorder", "sleep-apnea", "Sleep apnea")],
    },
  ],
  totalAnchors: 2,
  unverifiedAnchors: 1,
  draftAuthoredMatches: 0,
  cappedOrigins: 0,
};

describe("axe gate — the multi-hop DAG visualizer", () => {
  it("renders the pathway explorer with no critical or serious WCAG 2.1 AA violation", async () => {
    const { container } = render(<PathwayExplorer view={EXPLORER_VIEW} />);

    // Assert the fixture actually produced the branches under test, so the gate
    // cannot pass by rendering nothing.
    expect(container.textContent).toContain("Post-traumatic stress disorder");
    expect(container.textContent).toContain("Chain broken");
    expect(container.textContent).toContain("No outgoing adjacency edges");
    // The draft-provenance and bounded-output disclosures are part of the
    // shipped markup, so the axe gate must cover them (audit A08).
    expect(container.textContent).toContain("Draft-authored evidence");
    expect(container.textContent).toContain("total-output bound");

    await expectNoBlockingA11yViolations(container);
  });

  it("renders the results-step graph routes with no critical or serious violation", async () => {
    const { container } = render(<GraphPathwayReview view={MATCH_SECTION_VIEW} />);

    expect(container.textContent).toContain("Sleep apnea");
    await expectNoBlockingA11yViolations(container);
  });

  it("mounts the shipped /pathways page and reports no critical or serious violation", async () => {
    // The real page component, not a fixture: it is a synchronous zero-prop
    // default export with no dynamic APIs, so `render` here exercises the actual
    // shipped markup and the actual graph loaded from disk — including the page
    // heading structure, the disclaimer banner, the explorer, and the limits
    // section. A page that cannot be mounted would otherwise only ever be
    // covered by source-text assertions.
    const { container } = render(<PathwaysPage />);

    // Same structural invariants the other routes are held to.
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.textContent).toContain("Claim pathway explorer");
    expect(container.textContent).toContain("What this does not mean");

    await expectNoBlockingA11yViolations(container);
  });

  it("runs the rules it claims to enforce rather than passing vacuously", async () => {
    const { container } = render(<PathwayExplorer view={EXPLORER_VIEW} />);
    const summary = await expectNoBlockingA11yViolations(container);

    // A gate that evaluated nothing would also report zero violations.
    expect(summary.passes).toBeGreaterThan(0);
    expect(summary.violations).toBe(0);
  });

  it("fails on a deliberately broken component (the gate is not a no-op)", async () => {
    // Mutation check: the same helper must reject markup with an unnamed
    // control and an image with no alternative text. If this stops failing, the
    // gate has gone blind and every green run above is meaningless.
    const { container } = render(
      <div>
        <button type="button" />
      </div>,
    );

    // Deliberately inject invalid markup for the negative test; shipped JSX
    // must still satisfy the image/alternative-text lint rules.
    const brokenImage = document.createElement("img");
    brokenImage.src = "/logo.png";
    container.append(brokenImage);

    await expect(expectNoBlockingA11yViolations(container)).rejects.toThrow(
      /critical\/serious WCAG 2.1 AA violation/,
    );
  });
});

describe("the axe gate configuration states its own limits", () => {
  it("blocks only critical and serious impacts", () => {
    expect([...AXE_BLOCKING_IMPACTS]).toEqual(["critical", "serious"]);
  });

  it("skips exactly one rule, and only because jsdom cannot evaluate it", () => {
    // Pinned so an exception cannot be added quietly: growing this object is a
    // weakening of the gate and belongs in review.
    expect(Object.keys(AXE_JSOM_SKIPPED_RULES)).toEqual(["color-contrast"]);
  });
});

/* ─── Dynamic state announcements ─────────────────────────────────────── */

/**
 * Module-level so the array identity is stable. A fresh array literal on every
 * render would re-run the effect, announce again, and spin — the same hazard the
 * shipped caller avoids by deriving its connection list from a `useMemo`.
 */
const CONNECTION_LIST = ["PTSD → Sleep apnea"] as const;
const NO_CONNECTIONS = [] as const;

/**
 * Mirrors the shipped flow: derive the connection list, format it for speech,
 * announce from an effect. Announcing during render would advance the monotonic
 * id on every pass and never settle.
 */
function LiveRegionProbe({ connections }: { connections: readonly string[] }) {
  const { announce, message } = useAriaLive();
  useEffect(() => {
    const announcement = describeMappedConnections(connections);
    if (announcement) announce(announcement);
  }, [announce, connections]);
  return <AriaLiveRegion message={message} />;
}

describe("describeMappedConnections", () => {
  it("returns null for an empty mapping so nothing is announced", () => {
    expect(describeMappedConnections([])).toBeNull();
    expect(describeMappedConnections(["   "])).toBeNull();
  });

  it("spells the arrow out as a word for speech", () => {
    expect(describeMappedConnections(["PTSD → Sleep apnea"])).toBe(
      "Adjacency-graph route mapped: PTSD to Sleep apnea.",
    );
  });

  it("dedupes a pair that appears on two routes", () => {
    expect(describeMappedConnections(["A → B", "A → B"])).toBe(
      "Adjacency-graph route mapped: A to B.",
    );
  });

  it("summarises rather than reading an unbounded list aloud", () => {
    const many = Array.from({ length: 7 }, (_, index) => `Origin ${index} → Target ${index}`);
    const announcement = describeMappedConnections(many);

    expect(announcement).toContain("7 adjacency-graph routes mapped");
    expect(announcement).toContain("starting with Origin 0 to Target 0");
    expect(announcement).toContain(`${7 - 1} more are listed below`);
    expect(MAX_SPELLED_OUT_CONNECTIONS).toBe(3);
  });
});

describe("useAriaLive", () => {
  it("renders a polite, atomic status region carrying speech-ready text", async () => {
    const { container } = render(<LiveRegionProbe connections={CONNECTION_LIST} />);

    await waitFor(() => {
      const region = container.querySelector("[role='status']");
      expect(region).not.toBeNull();
      expect(region?.getAttribute("aria-live")).toBe("polite");
      expect(region?.getAttribute("aria-atomic")).toBe("true");
      // The announced text is not a copy of the visible string: the arrow is
      // spelled as a word so a screen reader does not read "right arrow".
      expect(region?.textContent).toContain("PTSD to Sleep apnea");
      expect(region?.textContent).not.toContain("→");
    });
  });

  it("never renders an assertive region, which the workflow policy forbids", () => {
    const { container } = render(<LiveRegionProbe connections={CONNECTION_LIST} />);

    expect(container.innerHTML).not.toContain("assertive");
  });

  it("keeps the region mounted and empty when there is nothing to announce", () => {
    const { container } = render(<LiveRegionProbe connections={NO_CONNECTIONS} />);

    const region = container.querySelector("[role='status']");
    expect(region).not.toBeNull();
    expect(region?.textContent).toBe("");
  });
});
