import { describe, expect, it } from "vitest";

import type {
  EvidenceAnalysis,
  EvidenceCategory,
  EvidenceExcerpt,
  EvidenceStrength,
} from "../src/lib/evidence/extract";
import {
  annotateExcerptsWithHopIndex,
  COMPOSITE_NEXUS_SUMMARY,
  formatPathwayHopEvidenceMapping,
  type ClaimPathwayLike,
  type PathwayHopLike,
} from "../src/lib/evidence/pathway-mapper";

/**
 * Contract tests for the per-hop pathway-evidence text export
 * (`formatPathwayHopEvidenceMapping`). The export must mirror the on-screen
 * `PathwayEvidenceTable` review exactly — numbered hop sections, the hop's
 * legal theory, explicit empty states, and the chain's composite nexus — so
 * the veteran's downloaded packet carries the same hop-by-hop evidence
 * structure as the browser review, with the same research-cue-only boundary.
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
  nexusClassification: PathwayHopLike["edge"]["nexusClassification"],
): PathwayHopLike {
  return { stepIndex, edge: { sourceConditionId: source, targetConditionId: target, nexusClassification } };
}

function pathway(
  hops: [PathwayHopLike] | [PathwayHopLike, PathwayHopLike],
  compositeNexus: ClaimPathwayLike["compositeNexus"],
): ClaimPathwayLike {
  return {
    originConditionId: hops[0]!.edge.sourceConditionId,
    terminalConditionId: hops[hops.length - 1]!.edge.targetConditionId,
    hops,
    compositeNexus,
  };
}

function excerpt(
  overrides: Partial<EvidenceExcerpt> & { quote: string; matchedTerms: string[] },
): EvidenceExcerpt {
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

const PTSD_AGGRAVATION = excerpt({
  category: "aggravation" as EvidenceCategory,
  strength: "nexus-relevant" as EvidenceStrength,
  matchedTerms: ["ptsd"],
  quote: "PTSD worsened the sleep disturbance.",
  locator: "line 12",
});

const HTN_DIAGNOSIS = excerpt({
  matchedTerms: ["hypertension"],
  quote: "Hypertension diagnosed 2019, on lisinopril.",
  locator: "line 3",
});

const SLEEP_APNEA_DIAGNOSIS = excerpt({
  matchedTerms: ["sleep-apnea"],
  quote: "Sleep apnea confirmed by polysomnography.",
  locator: "line 7",
});

function annotated(
  pathwayView: ClaimPathwayLike,
  analyses: EvidenceAnalysis[],
): ReturnType<typeof annotateExcerptsWithHopIndex>["annotated"] {
  return annotateExcerptsWithHopIndex(pathwayView.hops, analyses, NAMES).annotated;
}

describe("per-hop pathway evidence text export", () => {
  it("groups excerpts under numbered hop headings with the hop's legal theory", () => {
    const twoHop = pathway(
      [
        hop(0, "ptsd", "hypertension", "AGGRAVATION"),
        hop(1, "hypertension", "sleep-apnea", "DIRECT_CAUSATION"),
      ],
      "AGGRAVATION",
    );
    const text = formatPathwayHopEvidenceMapping(
      [{ pathway: twoHop, excerpts: annotated(twoHop, [analysis([PTSD_AGGRAVATION, HTN_DIAGNOSIS, SLEEP_APNEA_DIAGNOSIS])]) }],
      NAMES,
    );

    expect(text).toContain("Pathway 1: Posttraumatic Stress Disorder -> Sleep Apnea");
    expect(text).toContain("Hop 1: Posttraumatic Stress Disorder -> Hypertension");
    expect(text).toContain("Hop 2: Hypertension -> Sleep Apnea");
    expect(text).toContain("Theory: Aggravation — 38 CFR § 3.310(b)");
    expect(text).toContain("Theory: Direct causation — 38 CFR § 3.310(a)");

    // Each quote lands under its own hop section, never duplicated.
    const hop2 = text.indexOf("Hop 2:");
    const ptsdQuote = text.indexOf("PTSD worsened the sleep disturbance.");
    const sleepQuote = text.indexOf("Sleep apnea confirmed by polysomnography.");
    expect(hop2).toBeGreaterThan(-1);
    expect(ptsdQuote).toBeGreaterThan(-1);
    expect(ptsdQuote).toBeLessThan(hop2);
    expect(sleepQuote).toBeGreaterThan(hop2);
    expect(text.split("PTSD worsened the sleep disturbance.").length - 1).toBe(1);
  });

  it("carries the composite nexus summary in the pathway header", () => {
    const cases: {
      hops: [PathwayHopLike] | [PathwayHopLike, PathwayHopLike];
      composite: ClaimPathwayLike["compositeNexus"];
    }[] = [
      { hops: [hop(0, "ptsd", "hypertension", "DIRECT_CAUSATION")], composite: "DIRECT_CAUSATION" },
      {
        hops: [
          hop(0, "ptsd", "hypertension", "DIRECT_CAUSATION"),
          hop(1, "hypertension", "sleep-apnea", "AGGRAVATION"),
        ],
        composite: "AGGRAVATION",
      },
      { hops: [hop(0, "ptsd", "hypertension", "ASSOCIATION_ONLY")], composite: "ASSOCIATION_ONLY_CHAIN_BROKEN" },
    ];

    for (const { hops, composite } of cases) {
      const text = formatPathwayHopEvidenceMapping([{ pathway: pathway(hops, composite), excerpts: [] }], NAMES);
      expect(text).toContain(`Composite nexus: ${COMPOSITE_NEXUS_SUMMARY[composite]}`);
    }
    // All three composites have a distinct, non-empty plain-language summary.
    expect(new Set(Object.values(COMPOSITE_NEXUS_SUMMARY)).size).toBe(3);
  });

  it("renders the explicit empty state for every hop without mapped excerpts", () => {
    const twoHop = pathway(
      [
        hop(0, "ptsd", "hypertension", "AGGRAVATION"),
        hop(1, "hypertension", "sleep-apnea", "DIRECT_CAUSATION"),
      ],
      "AGGRAVATION",
    );

    // No excerpts at all: both hops show the empty state.
    const allEmpty = formatPathwayHopEvidenceMapping([{ pathway: twoHop, excerpts: [] }], NAMES);
    expect(allEmpty.split("No evidence mapped for this step.").length - 1).toBe(2);

    // One excerpt on hop 1 only: hop 2 stays explicitly empty, not silent.
    const hop1Only = formatPathwayHopEvidenceMapping(
      [{ pathway: twoHop, excerpts: annotated(twoHop, [analysis([PTSD_AGGRAVATION])]) }],
      NAMES,
    );
    expect(hop1Only.split("No evidence mapped for this step.").length - 1).toBe(1);
    expect(hop1Only).toContain("PTSD worsened the sleep disturbance.");
  });

  it("preserves stored excerpt order within a hop bucket", () => {
    const twoHop = pathway(
      [
        hop(0, "ptsd", "hypertension", "AGGRAVATION"),
        hop(1, "hypertension", "sleep-apnea", "DIRECT_CAUSATION"),
      ],
      "AGGRAVATION",
    );
    const first = excerpt({
      matchedTerms: ["hypertension"],
      quote: "Blood pressure first elevated 2018.",
      locator: "line 2",
    });
    const second = excerpt({
      matchedTerms: ["hypertension"],
      quote: "Hypertension diagnosed 2019, on lisinopril.",
      locator: "line 3",
    });
    const text = formatPathwayHopEvidenceMapping(
      [{ pathway: twoHop, excerpts: annotated(twoHop, [analysis([first, second])]) }],
      NAMES,
    );

    expect(text.indexOf("Blood pressure first elevated 2018.")).toBeLessThan(
      text.indexOf("Hypertension diagnosed 2019, on lisinopril."),
    );
  });

  it("excludes excerpts that matched no hop (surfaced separately by the producer)", () => {
    const twoHop = pathway(
      [
        hop(0, "ptsd", "hypertension", "AGGRAVATION"),
        hop(1, "hypertension", "sleep-apnea", "DIRECT_CAUSATION"),
      ],
      "AGGRAVATION",
    );
    const { annotated: annotatedExcerpts, unmatched } = annotateExcerptsWithHopIndex(
      twoHop.hops,
      [analysis([excerpt({ matchedTerms: ["knee"], quote: "Knee pain on stairs.", locator: "line 9" })])],
      NAMES,
    );

    expect(unmatched).toHaveLength(1);
    const text = formatPathwayHopEvidenceMapping([{ pathway: twoHop, excerpts: annotatedExcerpts }], NAMES);
    expect(text).not.toContain("Knee pain on stairs.");
  });

  it("falls back to the raw catalog ID when the display name is unknown", () => {
    const oneHop = pathway([hop(0, "ptsd", "hypertension", "AGGRAVATION")], "AGGRAVATION");
    const text = formatPathwayHopEvidenceMapping([{ pathway: oneHop, excerpts: [] }]);

    expect(text).toContain("Pathway 1: ptsd -> hypertension");
    expect(text).toContain("Hop 1: ptsd -> hypertension");
  });

  it("renders the honest empty line when no pathways exist", () => {
    expect(formatPathwayHopEvidenceMapping([], NAMES)).toContain(
      "No research pathways were available to map.",
    );
  });

  it("keeps the research-cue-only governance boundary in the export", () => {
    const twoHop = pathway(
      [
        hop(0, "ptsd", "hypertension", "AGGRAVATION"),
        hop(1, "hypertension", "sleep-apnea", "DIRECT_CAUSATION"),
      ],
      "AGGRAVATION",
    );
    const text = formatPathwayHopEvidenceMapping(
      [{ pathway: twoHop, excerpts: annotated(twoHop, [analysis([PTSD_AGGRAVATION])]) }],
      NAMES,
    );

    expect(text).toContain("research cue");
    expect(text).not.toMatch(/\d{2}%/);
    expect(text).not.toContain("establishes");
    expect(text).not.toContain("nexus is established");
    expect(text).not.toContain("eligible");
  });
});
