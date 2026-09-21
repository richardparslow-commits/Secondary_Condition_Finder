import { describe, expect, it } from "vitest";

import type { EvidenceAnalysis, EvidenceExcerpt } from "../src/lib/evidence/extract";
import {
  annotateExcerptsWithHopIndex,
  type HopLike,
} from "../src/lib/evidence/pathway-mapper";
import {
  deriveViewCompositeNexus,
  intermediatePathwaysToView,
  intermediatePathwayToView,
} from "../src/lib/engine/pathway-view";
import {
  deriveCompositeNexus,
  deriveCompositeNexusFromClassifications,
} from "../src/lib/kb/utils";
import type { PathwayHop } from "../src/lib/kb/schema";
import type { IntermediatePathway } from "../src/lib/engine/types";

/* ─── Fixtures ────────────────────────────────────────────────────────────── */

function excerpt(overrides: Partial<EvidenceExcerpt>): EvidenceExcerpt {
  return {
    sourceName: "Treatment Records",
    locator: "line 4",
    quote: "Clinician statement",
    category: "diagnosis",
    strength: "supporting",
    clinicianAuthored: true,
    matchedTerms: [],
    ...overrides,
  };
}

function analysis(excerpts: EvidenceExcerpt[]): EvidenceAnalysis {
  return {
    version: 1,
    sourceName: excerpts[0]?.sourceName ?? "Records",
    excerpts,
    nexusRelevantCount: excerpts.filter((e) => e.strength === "nexus-relevant").length,
    supportingCount: excerpts.filter((e) => e.strength === "supporting").length,
  };
}

const TWO_HOP: HopLike[] = [
  { stepIndex: 0, edge: { sourceConditionId: "ptsd", targetConditionId: "hypertension" } },
  { stepIndex: 1, edge: { sourceConditionId: "hypertension", targetConditionId: "sleep-apnea" } },
];

const NAME_BY_ID: Record<string, string> = {
  ptsd: "Posttraumatic Stress Disorder",
  hypertension: "Hypertension",
  "sleep-apnea": "Sleep Apnea",
};

function intermediatePathway(
  overrides: Partial<IntermediatePathway> = {},
): IntermediatePathway {
  const edge = (conditionId: string, conditionName: string, targetId: string, targetName: string) => ({
    conditionId,
    conditionName,
    targetConditionId: targetId,
    targetConditionName: targetName,
    rank: 1,
    nexusClassification: "DIRECT_CAUSATION" as const,
    etiologicalConsensus: "PROBABLE" as const,
    rationale: "Authored rationale for this edge of the intermediate research chain.",
    pathwayTypes: ["direct-secondary" as const],
    sourceReferences: [],
  });
  return {
    primaryId: "ptsd",
    primaryName: "Posttraumatic Stress Disorder",
    intermediateId: "hypertension",
    intermediateName: "Hypertension",
    targetId: "sleep-apnea",
    targetName: "Sleep Apnea",
    label: "INTERMEDIATE_CHAIN",
    edges: [
      edge("ptsd", "Posttraumatic Stress Disorder", "hypertension", "Hypertension"),
      edge("hypertension", "Hypertension", "sleep-apnea", "Sleep Apnea"),
    ],
    causalChain: "Posttraumatic Stress Disorder → Hypertension → Sleep Apnea",
    sourceReferences: [],
    ...overrides,
  };
}

/* ─── supportedHopIndex annotation ────────────────────────────────────────── */

describe("annotateExcerptsWithHopIndex", () => {
  it("annotates excerpts naming the terminal condition with the final hop", () => {
    const { annotated, unmatched } = annotateExcerptsWithHopIndex(
      TWO_HOP,
      [analysis([excerpt({ matchedTerms: ["sleepapnea"], quote: "Diagnosed with OSA." })])],
    );
    expect(annotated).toHaveLength(1);
    expect(annotated[0].supportedHopIndex).toBe(1);
    expect(annotated[0].quote).toContain("OSA");
    expect(unmatched).toHaveLength(0);
  });

  it("annotates excerpts naming an intermediate condition with that hop", () => {
    const { annotated } = annotateExcerptsWithHopIndex(
      TWO_HOP,
      [analysis([excerpt({ matchedTerms: ["hypertension"], quote: "HTN noted." })])],
    );
    expect(annotated).toHaveLength(1);
    expect(annotated[0].supportedHopIndex).toBe(0);
  });

  it("prefers the source-side context match over nothing for upstream hops", () => {
    // An excerpt carrying only the source condition's terms (e.g. a PTSD
    // diagnosis excerpt) anchors hop 0's departing condition.
    const { annotated } = annotateExcerptsWithHopIndex(
      TWO_HOP,
      [analysis([excerpt({ matchedTerms: ["ptsd"], quote: "PTSD diagnosis established." })])],
    );
    expect(annotated).toHaveLength(1);
    expect(annotated[0].supportedHopIndex).toBe(0);
  });

  it("uses catalog display names when excerpts stored under the full name", () => {
    const { annotated } = annotateExcerptsWithHopIndex(
      TWO_HOP,
      [analysis([excerpt({ matchedTerms: ["Sleep Apnea"], quote: "Sleep study positive." })])],
      NAME_BY_ID,
    );
    expect(annotated).toHaveLength(1);
    expect(annotated[0].supportedHopIndex).toBe(1);
  });

  it("assigns a multi-hop match to the first matching hop (lowest stepIndex)", () => {
    // "hypertension" is hop 0's target AND hop 1's source. Hops are processed
    // in stepIndex order and the first tier (target = named evidence for the
    // claimed condition downstream) wins, so the excerpt lands on hop 0 —
    // "Hypertension" is the condition this excerpt names directly.
    const { annotated } = annotateExcerptsWithHopIndex(
      TWO_HOP,
      [analysis([excerpt({ matchedTerms: ["sleepapnea", "hypertension"] })])],
    );
    expect(annotated).toHaveLength(1);
    expect(annotated[0].supportedHopIndex).toBe(0);
  });

  it("returns excerpts matching no hop in unmatched, never drops them", () => {
    const { annotated, unmatched } = annotateExcerptsWithHopIndex(
      TWO_HOP,
      [
        analysis([
          excerpt({ matchedTerms: ["migraine"], quote: "Unrelated migraine note." }),
          excerpt({ matchedTerms: ["sleepapnea"], quote: "Sleep apnea note." }),
        ]),
      ],
    );
    expect(annotated).toHaveLength(1);
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].quote).toContain("migraine");
  });

  it("preserves stored order across annotated and unmatched excerpts", () => {
    const { annotated, unmatched } = annotateExcerptsWithHopIndex(
      TWO_HOP,
      [
        analysis([
          excerpt({ matchedTerms: ["migraine"], locator: "line 1", quote: "First." }),
          excerpt({ matchedTerms: ["sleepapnea"], locator: "line 2", quote: "Second." }),
          excerpt({ matchedTerms: ["hypertension"], locator: "line 3", quote: "Third." }),
        ]),
      ],
    );
    expect(unmatched.map((e) => e.locator)).toEqual(["line 1"]);
    expect(annotated.map((e) => e.locator)).toEqual(["line 2", "line 3"]);
  });

  it("returns empty results for empty analyses", () => {
    const { annotated, unmatched } = annotateExcerptsWithHopIndex(TWO_HOP, []);
    expect(annotated).toEqual([]);
    expect(unmatched).toEqual([]);
  });
});

/* ─── View adapters ───────────────────────────────────────────────────────── */

describe("intermediatePathwayToView", () => {
  it("adapts an intermediate chain into a two-hop pathway view", () => {
    const view = intermediatePathwayToView(intermediatePathway());
    expect(view.originConditionId).toBe("ptsd");
    expect(view.terminalConditionId).toBe("sleep-apnea");
    expect(view.hops).toHaveLength(2);
    expect(view.hops[0].stepIndex).toBe(0);
    expect(view.hops[0].edge).toEqual({
      sourceConditionId: "ptsd",
      targetConditionId: "hypertension",
      nexusClassification: "DIRECT_CAUSATION",
    });
    expect(view.hops[1]?.edge.targetConditionId).toBe("sleep-apnea");
    expect(view.compositeNexus).toBe("DIRECT_CAUSATION");
  });

  it("derives AGGRAVATION when any hop is an aggravation", () => {
    const pathway = intermediatePathway();
    (pathway.edges[1] as { nexusClassification: "AGGRAVATION" }).nexusClassification = "AGGRAVATION";
    const view = intermediatePathwayToView(pathway);
    expect(view.compositeNexus).toBe("AGGRAVATION");
  });

  it("derives ASSOCIATION_ONLY_CHAIN_BROKEN when any hop is association-only", () => {
    const pathway = intermediatePathway();
    (pathway.edges[0] as { nexusClassification: "ASSOCIATION_ONLY" }).nexusClassification =
      "ASSOCIATION_ONLY";
    const view = intermediatePathwayToView(pathway);
    expect(view.compositeNexus).toBe("ASSOCIATION_ONLY_CHAIN_BROKEN");
  });

  it("adapts every chain via intermediatePathwaysToView", () => {
    const views = intermediatePathwaysToView([
      intermediatePathway(),
      intermediatePathway({ targetId: "gerd", targetName: "GERD" }),
    ]);
    expect(views).toHaveLength(2);
    expect(views[1].terminalConditionId).toBe("gerd");
  });
});

describe("deriveViewCompositeNexus", () => {
  it("matches the classification-level reducer in kb/utils", () => {
    const cases: ("DIRECT_CAUSATION" | "AGGRAVATION" | "ASSOCIATION_ONLY")[][] = [
      ["DIRECT_CAUSATION"],
      ["AGGRAVATION"],
      ["ASSOCIATION_ONLY"],
      ["DIRECT_CAUSATION", "AGGRAVATION"],
      ["AGGRAVATION", "DIRECT_CAUSATION"],
      ["ASSOCIATION_ONLY", "DIRECT_CAUSATION"],
      ["DIRECT_CAUSATION", "ASSOCIATION_ONLY"],
    ];
    for (const classifications of cases) {
      const hops = classifications.map((classification, stepIndex) => ({
        stepIndex,
        edge: { nexusClassification: classification },
      }));
      expect(deriveViewCompositeNexus(hops)).toBe(
        deriveCompositeNexusFromClassifications(classifications),
      );
    }
  });
});

/* ─── Reducer parity ──────────────────────────────────────────────────────── */

describe("deriveCompositeNexusFromClassifications", () => {
  // Type-complete canonical hop fixtures (full KbEdge shape on each edge).
  const mechanism = {
    mechanismCategory: "PSYCHOPHYSIOLOGICAL" as const,
    primaryVector:
      "Authored primary vector describing the physiological cascade between the two conditions.",
    hypothesizedOnly: false,
  };
  const profile = {
    etiologicalConsensus: "PROBABLE" as const,
    vaNexusProbabilityAlignment: "AT_LEAST_AS_LIKELY_AS_NOT" as const,
    conservativeRationale:
      "Authored conservative rationale stating the basis for the nexus claim in medically conservative terms.",
    evidenceGaps: "Authored evidence gaps sentence.",
    alternativeEtiologiesToRuleOut: ["Alternative etiology one"],
    requiresSpecificDbqEvidence: false,
  };
  it("applies the same precedence as the canonical hop reducer", () => {
    expect(deriveCompositeNexusFromClassifications(["DIRECT_CAUSATION"])).toBe("DIRECT_CAUSATION");
    expect(deriveCompositeNexusFromClassifications(["DIRECT_CAUSATION", "DIRECT_CAUSATION"])).toBe(
      "DIRECT_CAUSATION",
    );
    expect(deriveCompositeNexusFromClassifications(["DIRECT_CAUSATION", "AGGRAVATION"])).toBe(
      "AGGRAVATION",
    );
    expect(deriveCompositeNexusFromClassifications(["AGGRAVATION", "AGGRAVATION"])).toBe(
      "AGGRAVATION",
    );
    expect(deriveCompositeNexusFromClassifications(["ASSOCIATION_ONLY", "DIRECT_CAUSATION"])).toBe(
      "ASSOCIATION_ONLY_CHAIN_BROKEN",
    );
    expect(deriveCompositeNexusFromClassifications([])).toBe("DIRECT_CAUSATION");
  });

  it("matches the canonical hop reducer on the same chain", () => {
    // Canonical KbEdge hops: the canonical nexus arms deliberately carry no
    // per-arm narrative payload (that text lives in rationale and
    // evidentiaryProfile), so the claim is the classification itself.
    const directHop: PathwayHop = {
      stepIndex: 0,
      edge: {
        sourceConditionId: "ptsd",
        targetConditionId: "hypertension",
        rank: 1,
        nexusClaim: { nexusClassification: "DIRECT_CAUSATION" },
        causalMechanism: mechanism,
        evidentiaryProfile: profile,
        rationale: "Authored edge rationale.",
        evidenceGaps: ["Authored development target for this edge."],
      },
    };
    const aggravationHop: PathwayHop = {
      stepIndex: 1,
      edge: {
        sourceConditionId: "hypertension",
        targetConditionId: "migraines",
        rank: 1,
        nexusClaim: { nexusClassification: "AGGRAVATION" },
        causalMechanism: mechanism,
        evidentiaryProfile: profile,
        rationale: "Authored edge rationale.",
        evidenceGaps: ["Authored development target for this edge."],
      },
    };
    expect(deriveCompositeNexus([directHop, aggravationHop])).toBe(
      deriveCompositeNexusFromClassifications(["DIRECT_CAUSATION", "AGGRAVATION"]),
    );
  });
});
