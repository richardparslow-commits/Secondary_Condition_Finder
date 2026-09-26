import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  analyzeGraph,
  enumerateSimpleCycles,
  CRG_REVIEW_BASELINE,
  CRG_REDUNDANCY_BASELINE,
} from "../scripts/audit-crg-graph";

type MappingFixture = {
  id: string;
  draft: boolean;
  todo: string[];
  governanceNotes?: string[];
  suggestions: Array<{
    conditionId: string;
    rank: number;
    nexusClaim: { nexusClassification: string };
  }>;
};

function mapping(
  id: string,
  suggestions: MappingFixture["suggestions"],
  options: { draft?: boolean; governanceNotes?: string[] } = {},
): MappingFixture {
  return {
    id,
    draft: options.draft ?? false,
    todo: options.draft ? ["pending review"] : [],
    governanceNotes: options.governanceNotes,
    suggestions,
  };
}

const DIRECT = { nexusClassification: "DIRECT_CAUSATION" };
const AGGRAVATION = { nexusClassification: "AGGRAVATION" };
const ASSOCIATION = { nexusClassification: "ASSOCIATION_ONLY" };

function edge(conditionId: string, classification = DIRECT) {
  return { conditionId, rank: 1, nexusClaim: classification };
}

describe("enumerateSimpleCycles", () => {
  it("enumerates a two-node cycle exactly once", () => {
    const nodes = ["a", "b"];
    const order = new Map(nodes.map((id, index) => [id, index]));
    const adjacency = new Map([
      ["a", ["b"]],
      ["b", ["a"]],
    ]);
    const cycles = enumerateSimpleCycles(nodes, order, adjacency);
    expect(cycles).toEqual([["a", "b", "a"]]);
  });

  it("enumerates a three-node cycle once, not per rotation", () => {
    const nodes = ["a", "b", "c"];
    const order = new Map(nodes.map((id, index) => [id, index]));
    const adjacency = new Map([
      ["a", ["b"]],
      ["b", ["c"]],
      ["c", ["a"]],
    ]);
    const cycles = enumerateSimpleCycles(nodes, order, adjacency);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toEqual(["a", "b", "c", "a"]);
  });

  it("finds no cycle in a purely forward graph", () => {
    const nodes = ["a", "b", "c"];
    const order = new Map(nodes.map((id, index) => [id, index]));
    const adjacency = new Map([
      ["a", ["b", "c"]],
      ["b", ["c"]],
    ]);
    expect(enumerateSimpleCycles(nodes, order, adjacency)).toEqual([]);
  });
});

describe("analyzeGraph", () => {
  it("passes a clean published causation graph", () => {
    const mappings = [
      mapping("a", [edge("b", DIRECT)]),
      mapping("b", [edge("c", AGGRAVATION)]),
      mapping("c", []),
    ];
    const report = analyzeGraph(mappings);
    expect(report.status).toBe("PASS");
    expect(report.violations).toEqual([]);
    expect(report.review).toEqual([]);
    expect(report.counts.edges).toBe(2);
  });

  it("hard-fails self-loops and duplicate edges", () => {
    const withSelfLoop = [
      mapping("a", [edge("a", DIRECT), edge("b", DIRECT)]),
      mapping("b", []),
    ];
    const selfLoopReport = analyzeGraph(withSelfLoop);
    expect(selfLoopReport.status).toBe("FAIL");
    expect(selfLoopReport.violations.some((finding) => finding.code === "CRG-SELF-LOOP")).toBe(true);

    // The same edge authored twice (as two suggestions on one mapping, the
    // shape a merge conflict would produce) is a duplicate-edge violation.
    const withDuplicate = [
      mapping("a", [edge("b", DIRECT), edge("b", DIRECT)]),
      mapping("b", []),
    ];
    const duplicateReport = analyzeGraph(withDuplicate);
    expect(duplicateReport.status).toBe("FAIL");
    expect(duplicateReport.violations.some((finding) => finding.code === "CRG-DUPLICATE-EDGE")).toBe(true);
  });

  it("hard-fails a cycle composed entirely of DIRECT_CAUSATION edges", () => {
    const mappings = [
      mapping("a", [edge("b", DIRECT)]),
      mapping("b", [edge("c", DIRECT)]),
      mapping("c", [edge("a", DIRECT)]),
    ];
    const report = analyzeGraph(mappings);
    expect(report.status).toBe("FAIL");
    const violation = report.violations.find((finding) => finding.code === "CRG-PURE-CAUSATION-CYCLE");
    expect(violation).toBeDefined();
    expect(violation?.subject).toBe("a -> b -> c -> a");
  });

  it("flags a mixed-class three-node cycle as review, with association composition explicit", () => {
    const mappings = [
      mapping("a", [edge("b", ASSOCIATION)]),
      mapping("b", [edge("c", DIRECT)]),
      mapping("c", [edge("a", DIRECT)]),
    ];
    const report = analyzeGraph(mappings);
    expect(report.status).toBe("REVIEW");
    const finding = report.review.find((item) => item.code === "CRG-ASSOCIATION-CYCLE");
    expect(finding).toBeDefined();
    expect(finding?.subject).toBe("a -> b -> c -> a");
    expect(report.cycles[0]?.containsAssociationOnly).toBe(true);
  });

  it("governs a two-node association/direct pair solely through the bidirectional governance check", () => {
    const mappings = [
      mapping("a", [edge("b", ASSOCIATION)]),
      mapping("b", [edge("a", DIRECT)]),
    ];
    const report = analyzeGraph(mappings);
    // The cycle is enumerated for awareness, but the clearable human decision
    // is the pair's governance notes — no parallel cycle finding.
    expect(report.cycles).toHaveLength(1);
    expect(report.review.some((item) => item.code === "CRG-CYCLE" || item.code === "CRG-ASSOCIATION-CYCLE")).toBe(false);
    expect(report.review.some((finding) => finding.code === "CRG-BIDIRECTIONAL-GOVERNANCE")).toBe(true);
  });

  it("reports missing governance notes on published bidirectional pairs as review and as violation under strict", () => {
    const withoutNotes = [
      mapping("a", [edge("b", AGGRAVATION)]),
      mapping("b", [edge("a", DIRECT)]),
    ];
    const reviewReport = analyzeGraph(withoutNotes);
    expect(reviewReport.status).toBe("REVIEW");
    expect(reviewReport.review.some((finding) => finding.code === "CRG-BIDIRECTIONAL-GOVERNANCE")).toBe(true);

    const strictReport = analyzeGraph(withoutNotes, { strict: true });
    expect(strictReport.status).toBe("FAIL");
    expect(strictReport.violations.some((finding) => finding.code === "CRG-BIDIRECTIONAL-GOVERNANCE")).toBe(true);
  });

  it("accepts a bidirectional pair whose mappings carry governance notes on both files", () => {
    const mappings = [
      mapping("a", [edge("b", AGGRAVATION)], { governanceNotes: ["Reciprocal OSA/HTN edges reviewed; each direction independently guarded."] }),
      mapping("b", [edge("a", DIRECT)], { governanceNotes: ["Reciprocal pair reviewed with condition-specific citations."] }),
    ];
    const report = analyzeGraph(mappings);
    expect(report.status).toBe("PASS");
    expect(report.bidirectionalPairs[0]?.governanceNotesOnBoth).toBe(true);
  });

  it("ignores draft mappings for the bidirectional governance requirement but still enumerates their cycles", () => {
    const mappings = [
      mapping("a", [edge("b", ASSOCIATION)]),
      mapping("b", [edge("a", ASSOCIATION)], { draft: true }),
    ];
    const report = analyzeGraph(mappings);
    // Draft pairs are not review findings (one side is not yet published), but
    // the cycle itself is still reported for awareness.
    expect(report.review.some((finding) => finding.code === "CRG-BIDIRECTIONAL-GOVERNANCE")).toBe(false);
    expect(report.cycles).toHaveLength(1);
    expect(report.cycles[0]?.fullyPublished).toBe(false);
  });

  it("reports transitive redundancy as informational without failing", () => {
    const mappings = [
      mapping("a", [edge("b", DIRECT), edge("c", AGGRAVATION)]),
      mapping("b", [edge("c", DIRECT)]),
      mapping("c", []),
    ];
    const report = analyzeGraph(mappings);
    expect(report.status).toBe("PASS");
    expect(report.counts.redundancyConflicts).toBe(1);
    expect(report.redundancy[0]?.direct).toBe("a->c");
    expect(report.redundancy[0]?.chain).toBe("a->b->c");
  });
});

describe("analyzeGraph --strict contract", () => {
  // A three-node cycle containing an ASSOCIATION_ONLY edge: a review finding by
  // default, and the case --strict used to leave behind.
  const associationCycle = [
    mapping("a", [edge("b", ASSOCIATION)]),
    mapping("b", [edge("c", DIRECT)]),
    mapping("c", [edge("a", DIRECT)]),
  ];

  it("upgrades association cycles to violations, not only bidirectional governance findings", () => {
    const reviewReport = analyzeGraph(associationCycle);
    expect(reviewReport.status).toBe("REVIEW");
    expect(reviewReport.review.some((finding) => finding.code === "CRG-ASSOCIATION-CYCLE")).toBe(true);
    expect(reviewReport.violations).toEqual([]);

    const strictReport = analyzeGraph(associationCycle, { strict: true });
    expect(strictReport.status).toBe("FAIL");
    expect(strictReport.violations.some((finding) => finding.code === "CRG-ASSOCIATION-CYCLE")).toBe(true);
    // --strict is documented as upgrading review findings to violations, so it
    // must leave nothing enforceable behind in review: a maintainer gate that
    // silently keeps a category advisory is worse than no strict mode at all.
    expect(strictReport.review).toEqual([]);
  });
});

describe("structural-debt ratchet", () => {
  const associationCycle = [
    mapping("a", [edge("b", ASSOCIATION)]),
    mapping("b", [edge("c", DIRECT)]),
    mapping("c", [edge("a", DIRECT)]),
  ];
  const redundantGraph = [
    mapping("a", [edge("b", DIRECT), edge("c", AGGRAVATION)]),
    mapping("b", [edge("c", DIRECT)]),
    mapping("c", []),
  ];

  const ratchetFindings = (report: { violations: Array<{ code: string; subject: string }> }) =>
    report.violations.filter((finding) => finding.code === "CRG-STRUCTURAL-DEBT-RATCHET");

  it("hard-fails when review-class findings grow past the baseline", () => {
    const report = analyzeGraph(associationCycle, { reviewBaseline: 0 });
    expect(report.status).toBe("FAIL");
    expect(ratchetFindings(report)).toHaveLength(1);
    expect(ratchetFindings(report)[0]?.subject).toBe("review-class findings 1 > baseline 0");
    expect(report.reviewDebt.exceeded).toBe(true);
    expect(report.reviewDebt.reviewBaseline).toBe(0);
  });

  it("hard-fails when transitive redundancy grows past the baseline", () => {
    const report = analyzeGraph(redundantGraph, { redundancyBaseline: 0 });
    expect(report.status).toBe("FAIL");
    expect(ratchetFindings(report)).toHaveLength(1);
    expect(ratchetFindings(report)[0]?.subject).toBe("redundancy conflicts 1 > baseline 0");
    expect(report.reviewDebt.redundancyConflicts).toBe(1);
  });

  it("stays silent at the baseline so queued human decisions do not block merge", () => {
    const report = analyzeGraph(associationCycle, { reviewBaseline: 1 });
    expect(ratchetFindings(report)).toEqual([]);
    expect(report.reviewDebt.exceeded).toBe(false);
    // Still surfaced for the qualified-human queue — ratcheted, not hidden.
    expect(report.status).toBe("REVIEW");
    expect(report.review).toHaveLength(1);
  });

  it("counts the review backlog identically under --strict", () => {
    const plain = analyzeGraph(associationCycle, { reviewBaseline: 5 });
    const strict = analyzeGraph(associationCycle, { strict: true, reviewBaseline: 5 });
    expect(strict.reviewDebt.reviewClassCount).toBe(plain.reviewDebt.reviewClassCount);

    // And the ratchet still fires under --strict rather than being masked by
    // the findings having moved into violations.
    const tight = analyzeGraph(associationCycle, { strict: true, reviewBaseline: 0 });
    expect(ratchetFindings(tight)).toHaveLength(1);
  });

  it("reports both pins so a breach says which backlog grew", () => {
    const report = analyzeGraph(associationCycle, { reviewBaseline: 0, redundancyBaseline: 0 });
    expect(report.reviewDebt).toMatchObject({
      reviewClassCount: 1,
      reviewBaseline: 0,
      redundancyConflicts: 0,
      redundancyBaseline: 0,
      exceeded: true,
    });
  });
});

describe("shipped knowledge base", () => {
  it("sits within its pinned structural-debt baselines with no hard violations", () => {
    const kbDir = path.join(process.cwd(), "data", "knowledge-base");
    const mappings = fs
      .readdirSync(kbDir)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((file) => JSON.parse(fs.readFileSync(path.join(kbDir, file), "utf8")));

    expect(mappings.length).toBeGreaterThan(0);
    const report = analyzeGraph(mappings);

    // The exported pins must describe the shipped corpus: if it has grown past a
    // baseline, either resolve the findings or re-pin deliberately in a reviewed
    // change — never by letting the gate drift.
    expect(report.reviewDebt.exceeded).toBe(false);
    expect(report.reviewDebt.reviewClassCount).toBeLessThanOrEqual(CRG_REVIEW_BASELINE);
    expect(report.reviewDebt.redundancyConflicts).toBeLessThanOrEqual(CRG_REDUNDANCY_BASELINE);
    // A self-loop, duplicate edge, or pure-DIRECT_CAUSATION cycle is not a
    // defensible etiology to present to a veteran.
    expect(report.violations).toEqual([]);
    // The backlog is real and must stay visible rather than be silently zeroed.
    expect(report.status).toBe("REVIEW");
  });
});
