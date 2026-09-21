import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PathwayEvidenceTable } from "../src/components/evidence/PathwayEvidenceTable";
import type {
  ClaimPathwayView,
  PathwayHopView,
} from "../src/lib/engine/pathway-view";
import type { HopAnnotatedExcerpt } from "../src/lib/evidence/pathway-mapper";

/**
 * Component render tests for the per-hop evidence table.
 *
 * The repo has no DOM test environment (vitest runs in `node`, no
 * testing-library), so these render via `react-dom/server` — the component is
 * presentational (only `useId`/`useMemo`), so static markup is a faithful
 * render. Rendering through `createElement` keeps this file inside the
 * existing vitest `.test.ts` include glob.
 *
 * Pinned contracts:
 *   1. Hop grouping — one titled section per hop in `stepIndex` order, each
 *      with its own semantic table; excerpts join to hops by strict
 *      `supportedHopIndex` equality and each excerpt appears exactly once.
 *   2. Nexus badges — the legal classification per hop renders the pinned
 *      label and Tailwind badge classes; the pathway summary line reflects
 *      the composite nexus.
 *   3. Empty states — a hop with no mapped excerpts renders the explicit
 *      "No evidence mapped for this step." callout instead of vanishing.
 */

const CONDITION_NAMES: Record<string, string> = {
  ptsd: "Posttraumatic Stress Disorder",
  hypertension: "Hypertension",
  "sleep-apnea": "Sleep Apnea",
};

const EMPTY_STATE = "No evidence mapped for this step.";

function hop(
  stepIndex: number,
  sourceConditionId: string,
  targetConditionId: string,
  nexusClassification: PathwayHopView["edge"]["nexusClassification"],
): PathwayHopView {
  return { stepIndex, edge: { sourceConditionId, targetConditionId, nexusClassification } };
}

function pathway(hops: [PathwayHopView] | [PathwayHopView, PathwayHopView], compositeNexus: ClaimPathwayView["compositeNexus"]): ClaimPathwayView {
  return {
    originConditionId: hops[0].edge.sourceConditionId,
    terminalConditionId: hops[hops.length - 1].edge.targetConditionId,
    hops,
    compositeNexus,
  };
}

function excerpt(
  supportedHopIndex: number,
  overrides: Partial<HopAnnotatedExcerpt> = {},
): HopAnnotatedExcerpt {
  return {
    sourceName: "Treatment Records",
    locator: "line 4",
    quote: "Clinician statement.",
    category: "diagnosis",
    strength: "supporting",
    clinicianAuthored: true,
    matchedTerms: [],
    supportedHopIndex,
    ...overrides,
  };
}

function renderTable(pathwayArg: ClaimPathwayView, excerpts: HopAnnotatedExcerpt[]): string {
  return renderToStaticMarkup(
    createElement(PathwayEvidenceTable, {
      pathway: pathwayArg,
      excerpts,
      conditionNameById: CONDITION_NAMES,
    }),
  );
}

const TWO_HOP_DIRECT = pathway(
  [
    hop(0, "ptsd", "hypertension", "DIRECT_CAUSATION"),
    hop(1, "hypertension", "sleep-apnea", "DIRECT_CAUSATION"),
  ],
  "DIRECT_CAUSATION",
);

const ONE_HOP_AGGRAVATION = pathway(
  [hop(0, "ptsd", "sleep-apnea", "AGGRAVATION")],
  "AGGRAVATION",
);

describe("PathwayEvidenceTable render (static markup)", () => {
  /* ── Hop grouping ──────────────────────────────────────────────────────── */

  it("renders one titled section per hop in stepIndex order", () => {
    const html = renderTable(TWO_HOP_DIRECT, []);
    expect(html).toContain("Hop 1: Posttraumatic Stress Disorder → Hypertension");
    expect(html).toContain("Hop 2: Hypertension → Sleep Apnea");
    expect(html.indexOf("Hop 1:")).toBeLessThan(html.indexOf("Hop 2:"));
  });

  it("renders a single-hop pathway with one section", () => {
    const html = renderTable(ONE_HOP_AGGRAVATION, []);
    expect(html).toContain("Hop 1: Posttraumatic Stress Disorder → Sleep Apnea");
    expect(html).not.toContain("Hop 2:");
  });

  it("joins excerpts to hops by strict supportedHopIndex equality", () => {
    const hopZeroExcerpt = excerpt(0, { quote: "PTSD note.", locator: "line 1" });
    const hopOneExcerpt = excerpt(1, { quote: "Apnea note.", locator: "line 2" });
    const html = renderTable(TWO_HOP_DIRECT, [hopZeroExcerpt, hopOneExcerpt]);

    // Each excerpt appears exactly once, in its own hop's section.
    expect(html.split("PTSD note.").length - 1).toBe(1);
    expect(html.split("Apnea note.").length - 1).toBe(1);
    expect(html.indexOf("PTSD note.")).toBeLessThan(html.indexOf("Hop 2:"));
    expect(html.indexOf("Apnea note.")).toBeGreaterThan(html.indexOf("Hop 2:"));
  });

  it("drops excerpts annotated with a stepIndex outside the pathway", () => {
    const html = renderTable(ONE_HOP_AGGRAVATION, [excerpt(1, { quote: "Orphaned note." })]);
    expect(html).not.toContain("Orphaned note.");
    expect(html).toContain(EMPTY_STATE);
  });

  it("preserves the caller's array order within a hop bucket (no re-sorting)", () => {
    // The producer (PathwayEvidenceReview) passes excerpts in stored
    // (sessionStorage) order; the table renders that order verbatim rather
    // than re-sorting, so the stored chronology is what the veteran sees.
    const first = excerpt(0, { quote: "First note.", locator: "line 1" });
    const second = excerpt(0, { quote: "Second note.", locator: "line 2" });
    const html = renderTable(TWO_HOP_DIRECT, [second, first]);
    expect(html.indexOf("Second note.")).toBeLessThan(html.indexOf("First note."));
  });

  it("renders semantic table structure with scoped headers", () => {
    const html = renderTable(ONE_HOP_AGGRAVATION, []);
    // One sr-only caption per hop table.
    expect((html.match(/<caption class="sr-only">/g) ?? []).length).toBe(1);
    expect(html).toContain('scope="col"');
    expect(html).toContain("<thead");
    expect(html).toContain("<tbody");
  });

  /* ── Nexus badges ──────────────────────────────────────────────────────── */

  it("renders the direct-causation badge with its emerald styling", () => {
    const html = renderTable(
      pathway([hop(0, "ptsd", "sleep-apnea", "DIRECT_CAUSATION")], "DIRECT_CAUSATION"),
      [],
    );
    expect(html).toContain("Direct causation");
    expect(html).toContain("border-emerald-300 bg-emerald-100 text-emerald-900");
  });

  it("renders the aggravation badge with its amber styling", () => {
    const html = renderTable(ONE_HOP_AGGRAVATION, []);
    expect(html).toContain("Aggravation");
    expect(html).toContain("border-amber-300 bg-amber-100 text-amber-900");
  });

  it("renders the association-only badge with its slate styling", () => {
    const html = renderTable(
      pathway(
        [
          hop(0, "ptsd", "hypertension", "ASSOCIATION_ONLY"),
          hop(1, "hypertension", "sleep-apnea", "DIRECT_CAUSATION"),
        ],
        "ASSOCIATION_ONLY_CHAIN_BROKEN",
      ),
      [],
    );
    expect(html).toContain("Association only");
    expect(html).toContain("border-slate-300 bg-slate-100 text-slate-700");
  });

  it("renders the § 3.310 label text beneath each hop heading", () => {
    const html = renderTable(ONE_HOP_AGGRAVATION, []);
    expect(html).toContain("Aggravation — 38 CFR § 3.310(b)");
  });

  it("summarizes the composite nexus on the pathway line", () => {
    const direct = renderTable(TWO_HOP_DIRECT, []);
    expect(direct).toContain("Every hop in this chain asserts direct causation.");

    const broken = renderTable(
      pathway(
        [
          hop(0, "ptsd", "hypertension", "ASSOCIATION_ONLY"),
          hop(1, "hypertension", "sleep-apnea", "DIRECT_CAUSATION"),
        ],
        "ASSOCIATION_ONLY_CHAIN_BROKEN",
      ),
      [],
    );
    expect(broken).toContain(
      "This chain includes an association-only link, which breaks the legal nexus between hops.",
    );
  });

  /* ── Empty states ──────────────────────────────────────────────────────── */

  it("renders the explicit empty state for a hop with no mapped excerpts", () => {
    const html = renderTable(TWO_HOP_DIRECT, []);
    expect((html.split(EMPTY_STATE).length - 1)).toBe(2);
    expect(html).toContain("bg-amber-50");
  });

  it("renders the empty state only for hops that actually lack excerpts", () => {
    const html = renderTable(TWO_HOP_DIRECT, [excerpt(0)]);
    expect(html).toContain(EMPTY_STATE);
    expect(html.split(EMPTY_STATE).length - 1).toBe(1);
    expect(html).toContain("Clinician statement.");
  });

  /* ── Honesty & accessibility details ───────────────────────────────────── */

  it("labels clinician authorship honestly per excerpt", () => {
    const html = renderTable(ONE_HOP_AGGRAVATION, [
      excerpt(0, { clinicianAuthored: true }),
      excerpt(0, { clinicianAuthored: false, quote: "Self-reported note.", locator: "line 9" }),
    ]);
    expect(html).toContain("Clinician-authored");
    expect(html).toContain("Not clinician-authored");
  });

  it("falls back to the catalog ID when a name is missing from the lookup", () => {
    const html = renderToStaticMarkup(
      createElement(PathwayEvidenceTable, {
        pathway: ONE_HOP_AGGRAVATION,
        excerpts: [],
        conditionNameById: {},
      }),
    );
    expect(html).toContain("Hop 1: ptsd → sleep-apnea");
  });

  it("renders multi-line quotes with preformatted whitespace", () => {
    const html = renderTable(ONE_HOP_AGGRAVATION, [
      excerpt(0, { quote: "Line one.\nLine two." }),
    ]);
    expect(html).toContain("whitespace-pre-line");
    expect(html).toContain("Line one.\nLine two.");
  });
});
