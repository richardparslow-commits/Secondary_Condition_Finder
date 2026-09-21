import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  PathwayEvidenceReview,
  PathwayEvidenceReviewView,
} from "../src/components/evidence/PathwayEvidenceReview";
import type {
  ClaimPathwayView,
  NexusClassificationView,
  PathwayHopView,
} from "../src/lib/engine/pathway-view";
import type {
  EvidenceAnalysis,
  EvidenceCategory,
  EvidenceExcerpt,
  EvidenceStrength,
} from "../src/lib/evidence/extract";

/**
 * Static-render tests for the Step 6 producer component. The repo has no DOM
 * test environment, so these render via `react-dom/server` — the pure
 * `PathwayEvidenceReviewView` core is a straight function of its props (the
 * storage shell is exercised separately with its server snapshot), so static
 * markup is a faithful render of the review's logic.
 *
 * Pinned here: per-pathway excerpt separation, the shared-intermediate case,
 * the unmatched-excerpt note (count wording, truncation, dedup across
 * pathways), the empty states, and the download affordance.
 */

const NAMES: Record<string, string> = {
  ptsd: "Posttraumatic Stress Disorder",
  hypertension: "Hypertension",
  "sleep-apnea": "Sleep Apnea",
};

function hop(
  stepIndex: number,
  source: string,
  target: string,
  nexusClassification: NexusClassificationView,
): PathwayHopView {
  return { stepIndex, edge: { sourceConditionId: source, targetConditionId: target, nexusClassification } };
}

function pathway(
  hops: [PathwayHopView] | [PathwayHopView, PathwayHopView],
  compositeNexus: ClaimPathwayView["compositeNexus"],
): ClaimPathwayView {
  const last = hops[hops.length - 1]!;
  return {
    originConditionId: hops[0]!.edge.sourceConditionId,
    terminalConditionId: last.edge.targetConditionId,
    hops,
    compositeNexus,
  };
}

function excerpt(overrides: Partial<EvidenceExcerpt> & { quote: string; matchedTerms: string[] }): EvidenceExcerpt {
  return {
    sourceName: "nexus-letter.pdf",
    locator: "line 1",
    category: "diagnosis" as EvidenceCategory,
    strength: "supporting" as EvidenceStrength,
    clinicianAuthored: true,
    ...overrides,
  } as EvidenceExcerpt;
}

function analysis(excerpts: EvidenceExcerpt[]): EvidenceAnalysis {
  return {
    version: 1,
    sourceName: "nexus-letter.pdf",
    excerpts,
    nexusRelevantCount: excerpts.filter((item) => item.strength === "nexus-relevant").length,
    supportingCount: excerpts.filter((item) => item.strength === "supporting").length,
  };
}

function render(props: {
  pathways: readonly ClaimPathwayView[];
  analyses: readonly EvidenceAnalysis[];
  conditionNameById?: Readonly<Record<string, string>>;
}): string {
  return renderToStaticMarkup(
    createElement(PathwayEvidenceReviewView, {
      pathways: props.pathways,
      conditionNameById: props.conditionNameById ?? NAMES,
      analyses: props.analyses,
    }),
  );
}

const TWO_CHAINS = [
  pathway([hop(0, "ptsd", "hypertension", "AGGRAVATION")], "AGGRAVATION"),
  pathway([hop(0, "hypertension", "sleep-apnea", "DIRECT_CAUSATION")], "DIRECT_CAUSATION"),
];

describe("PathwayEvidenceReviewView (static render)", () => {
  it("renders one pathway table per chain, in order", () => {
    // A stored excerpt matching nothing keeps the tables on screen (the
    // empty-analyses case returns the no-analyses empty state instead).
    const unrelated = excerpt({ matchedTerms: ["knee"], quote: "Knee pain on stairs." });
    const markup = render({ pathways: TWO_CHAINS, analyses: [analysis([unrelated])] });

    expect(markup.split("Evidence by pathway hop").length - 1).toBe(2);
    expect(markup.indexOf("Posttraumatic Stress Disorder → Hypertension")).toBeGreaterThan(-1);
    expect(markup.indexOf("Hypertension → Sleep Apnea")).toBeGreaterThan(-1);
    expect(markup.indexOf("Hypertension → Sleep Apnea")).toBeGreaterThan(
      markup.indexOf("Posttraumatic Stress Disorder → Hypertension"),
    );
  });

  it("keeps each pathway's excerpts inside its own tables", () => {
    const ptsdOnly = excerpt({ matchedTerms: ["ptsd"], quote: "PTSD service-connected at 50%." });
    const markup = render({ pathways: TWO_CHAINS, analyses: [analysis([ptsdOnly])] });

    // The excerpt renders once — under the PTSD→Hypertension chain — and the
    // second chain's hops are explicitly empty, not silently missing.
    expect(markup.split("PTSD service-connected at 50%.").length - 1).toBe(1);
    expect(markup.split("No evidence mapped for this step.").length - 1).toBe(1);
  });

  it("shows shared-intermediate evidence under each chain it belongs to", () => {
    const htnEvidence = excerpt({
      matchedTerms: ["hypertension"],
      quote: "Hypertension diagnosed 2019, on lisinopril.",
    });
    const markup = render({ pathways: TWO_CHAINS, analyses: [analysis([htnEvidence])] });

    // Hypertension is the target of chain 1 and the source of chain 2, so the
    // excerpt legitimately supports both hops and renders under each.
    expect(markup.split("Hypertension diagnosed 2019, on lisinopril.").length - 1).toBe(2);
  });

  it("lists excerpts that matched no hop in the explicit unmatched note", () => {
    const knee = excerpt({
      matchedTerms: ["knee"],
      quote: "Knee pain on stairs, worse in the morning.",
      sourceName: "joint-exam.pdf",
      locator: "line 9",
    });
    const markup = render({ pathways: TWO_CHAINS, analyses: [analysis([knee])] });

    expect(markup).toContain("1 stored excerpt in this tab matched no pathway hop");
    expect(markup).toContain("omitted from the tables above:");
    expect(markup).toContain("Knee pain on stairs, worse in the morning.");
    // The unmatched quote appears exactly once — in the note, never in a table.
    expect(markup.split("Knee pain on stairs, worse in the morning.").length - 1).toBe(1);
  });

  it("deduplicates excerpts that matched no hop of several pathways", () => {
    const knee = excerpt({ matchedTerms: ["knee"], quote: "Knee pain on stairs, worse in the morning." });
    const markup = render({ pathways: TWO_CHAINS, analyses: [analysis([knee])] });

    // Two pathways both leave this excerpt unmatched; the note must list it
    // once, not once per pathway.
    expect(markup.split("Knee pain on stairs, worse in the morning.").length - 1).toBe(1);
    expect(markup).toContain("1 stored excerpt");
  });

  it("uses plural wording and truncates long unmatched quotes to 80 characters", () => {
    const longQuote =
      "Persistent exertional dyspnea with documented oxygen desaturation on six-minute walk testing and preserved left ventricular ejection fraction on echocardiography.";
    const knee = excerpt({ matchedTerms: ["knee"], quote: "Knee pain on stairs." });
    const apnea = excerpt({ matchedTerms: ["overnight"], quote: longQuote, sourceName: "sleep-study.pdf" });
    const markup = render({ pathways: TWO_CHAINS, analyses: [analysis([knee, apnea])] });

    expect(markup).toContain("2 stored excerpts in this tab matched no pathway hop");
    expect(markup).toContain(longQuote.slice(0, 80));
    expect(markup).not.toContain(longQuote);
    expect(markup).toContain("sleep-study.pdf");
  });

  it("renders the no-analyses empty state from the storage shell", () => {
    // The shell reads sessionStorage via useSyncExternalStore; static render
    // exercises the server snapshot ("[]"), so this pins the fail-closed path.
    const markup = renderToStaticMarkup(
      createElement(PathwayEvidenceReview, {
        pathways: TWO_CHAINS,
        conditionNameById: NAMES,
      }),
    );

    expect(markup).toContain("No local evidence analysis is available in this browser tab.");
  });

  it("renders the no-pathways empty state when analyses exist but chains do not", () => {
    const markup = render({ pathways: [], analyses: [analysis([excerpt({ matchedTerms: ["ptsd"], quote: "PTSD noted." })])] });

    expect(markup).toContain("No multi-hop research pathways are available for this review");
  });

  it("offers the per-hop download when pathways and analyses are present", () => {
    const markup = render({
      pathways: TWO_CHAINS,
      analyses: [analysis([excerpt({ matchedTerms: ["ptsd"], quote: "PTSD noted." })])],
    });

    expect(markup).toContain("Download per-hop mapping");
    expect(markup).toContain("Exports the tables above");
  });
});
