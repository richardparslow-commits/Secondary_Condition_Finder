import { describe, expect, it } from "vitest";

import type { NonServiceConnectedConditionResult } from "@/lib/secondary-workflow/suggestions";
import {
  MECHANISM_CATEGORY_LABEL,
  NEXUS_THEORY_LABEL,
  PATHWAY_RECORD_CATEGORY_LABEL,
  buildPathwayRecordChecklist,
  combineChecklistWithSummary,
  formatPathwayRecordChecklist,
  pathwayChecklistItemKey,
} from "@/lib/secondary-workflow/pathway-record-checklist";
import type { Recommendation } from "@/lib/engine/types";

function primary(overrides: Partial<Recommendation["contributingPrimaries"][number]> = {}): Recommendation["contributingPrimaries"][number] {
  return {
    id: "ptsd",
    name: "PTSD",
    rank: 1,
    rationale: "PTSD rationale for test",
    nexusClaim: { nexusClassification: "DIRECT_CAUSATION", etiologicalTrigger: "Chronic stress-physiology trigger described here for schema parity." },
    causalMechanism: {
      mechanismCategory: "NEUROLOGICAL_DEGENERATION",
      primaryVector: "Chronic sympathetic activation disrupts sleep architecture over time.",
      hypothesizedOnly: false,
    },
    pathwayIntelligence: { pathways: ["neuroautonomic"], developmentQuestions: [], issuesToResolve: [] },
    evidentiaryProfile: {
      etiologicalConsensus: "PROBABLE",
      vaNexusProbabilityAlignment: "AT_LEAST_AS_LIKELY_AS_NOT",
      conservativeRationale: "Published relationships support evaluating this pairing for this veteran population.",
      evidenceGaps: "Independent diagnostic confirmation and chronology are needed.",
      alternativeEtiologiesToRuleOut: ["Idiopathic sleep-disordered breathing"],
      requiresSpecificDbqEvidence: false,
    },
    ...overrides,
  } as Recommendation["contributingPrimaries"][number];
}

function rec(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    conditionId: "sleep-apnea",
    condition: "Sleep Apnea",
    bodySystem: "Respiratory System",
    etiologicalConsensus: "PROBABLE",
    score: 1,
    contributingPrimaries: [primary()],
    evidenceGaps: ["Sleep study confirming OSA diagnosis", "Neurology nexus opinion addressing causation"],
    sourceReferences: [
      { citation: "Test Citation", note: "Test note", verificationScope: "clinical-evidence", verified: false },
    ],
    matchedIntakeContext: ["SSRI"],
    ...overrides,
  } as Recommendation;
}

function result(id: string, name: string, bodySystem: string, recommendation: Recommendation | null): NonServiceConnectedConditionResult {
  return { conditionId: id, conditionName: name, bodySystem, recommendation };
}

describe("Pathway-specific medical record checklist", () => {
  it("builds one pathway group per linked primary with nexus/mechanism metadata", () => {
    const groups = buildPathwayRecordChecklist([
      result("sleep-apnea", "Sleep Apnea", "Respiratory System", rec()),
      result("tinnitus", "Tinnitus", "Auditory System", null),
    ]);
    expect(groups).toHaveLength(1);
    const group = groups[0];
    expect(group.conditionId).toBe("sleep-apnea");
    expect(group.pathways).toHaveLength(1);
    const pathway = group.pathways[0];
    expect(pathway.primaryId).toBe("ptsd");
    expect(pathway.nexusClassification).toBe("DIRECT_CAUSATION");
    expect(pathway.mechanismCategory).toBe("NEUROLOGICAL_DEGENERATION");
    expect(pathway.mechanismHypothesizedOnly).toBe(false);
    expect(pathway.pathwayTypes).toEqual(["neuroautonomic"]);
    expect(pathway.etiologicalConsensus).toBe("PROBABLE");
  });

  it("produces concrete record items with why text and valid categories", () => {
    const [group] = buildPathwayRecordChecklist([result("sleep-apnea", "Sleep Apnea", "Respiratory System", rec())]);
    const items = group.pathways[0].items;
    expect(items.length).toBeGreaterThanOrEqual(5);
    for (const item of items) {
      expect(item.record.length).toBeGreaterThan(10);
      expect(item.why.length).toBeGreaterThan(10);
      expect(PATHWAY_RECORD_CATEGORY_LABEL[item.category]).toBeDefined();
    }
    // Mechanism-directed items for NEUROLOGICAL_DEGENERATION appear.
    const joined = items.map((item) => item.record).join(" ");
    expect(joined).toMatch(/sleep study/i);
    expect(joined).toMatch(/neurology/i);
    // Theory items for DIRECT_CAUSATION include primary treatment records.
    expect(joined).toMatch(/treatment and management records for PTSD/i);
    // Nexus opinion is always present.
    expect(joined).toMatch(/nexus opinion/i);
    // Baseline items are aggravation-only and absent here.
    expect(joined).not.toMatch(/baseline/i);
  });

  it("adds baseline + escalation items for an ordinary AGGRAVATION theory, without treatment-interference records", () => {
    const aggravation = primary({
      id: "knee",
      name: "Knee Injury",
      nexusClaim: {
        nexusClassification: "AGGRAVATION",
        baselineProgression: "The condition would have progressed slowly without the service-connected disability.",
        aggravatingFactor: "Altered gait increases mechanical load on the affected joint.",
      },
      causalMechanism: {
        mechanismCategory: "BIOMECHANICAL_ALTERATION",
        primaryVector: "Compensatory gait shifts load onto the knee and accelerates cartilage wear.",
        hypothesizedOnly: false,
      },
    });
    const [group] = buildPathwayRecordChecklist([
      result("knee-osteoarthritis", "Knee Osteoarthritis", "Musculoskeletal System", rec({
        conditionId: "knee-osteoarthritis",
        condition: "Knee Osteoarthritis",
        bodySystem: "Musculoskeletal System",
        contributingPrimaries: [aggravation],
      })),
    ]);
    const pathway = group.pathways[0];
    const joined = pathway.items.map((item) => item.record).join(" ");
    expect(joined).toMatch(/baseline severity documentation/i);
    expect(joined).toMatch(/more treatment, stronger medication, or worse function/i);
    // Spicer treatment-interference records belong only to the authored
    // Spicer variant, never to an ordinary aggravation theory.
    expect(joined).not.toMatch(/interfered with treatment/i);
    expect(pathway.spicerTreatmentInterference).toBe(false);
  });

  it("adds the Spicer treatment-interference item only when the authored mapping marks care-obstacle/treatment-complication on AGGRAVATION", () => {
    const spicerAggravation = primary({
      id: "ptsd-spicer",
      name: "PTSD",
      nexusClaim: {
        nexusClassification: "AGGRAVATION",
        baselineProgression: "The condition would have progressed slowly without the service-connected disability.",
        aggravatingFactor: "Avoidance and appointment non-attendance interfered with treatment.",
      },
      causalMechanism: {
        mechanismCategory: "PSYCHOPHYSIOLOGICAL",
        primaryVector: "Avoidance symptoms interrupted scheduled treatment for the secondary condition.",
        hypothesizedOnly: false,
      },
      pathwayIntelligence: { pathways: ["aggravation", "care-obstacle"], developmentQuestions: [], issuesToResolve: [] },
    });
    const [group] = buildPathwayRecordChecklist([
      result("knee-osteoarthritis", "Knee Osteoarthritis", "Musculoskeletal System", rec({
        contributingPrimaries: [spicerAggravation],
      })),
    ]);
    const pathway = group.pathways[0];
    expect(pathway.spicerTreatmentInterference).toBe(true);
    const joined = pathway.items.map((item) => item.record).join(" ");
    expect(joined).toMatch(/interfered with treatment/i);
    // The baseline comparison items remain — Spicer is an additional proof
    // path, not a replacement for § 3.310(b)'s aggravation requirements.
    expect(joined).toMatch(/baseline severity documentation/i);
  });

  it("does not grant the Spicer variant from pathway types alone without an AGGRAVATION classification", () => {
    const directWithCareObstacle = primary({
      id: "ptsd-direct-obstacle",
      name: "PTSD",
      nexusClaim: {
        nexusClassification: "DIRECT_CAUSATION",
        etiologicalTrigger: "Chronic stress-physiology trigger described here for schema parity.",
      },
      pathwayIntelligence: { pathways: ["care-obstacle"], developmentQuestions: [], issuesToResolve: [] },
    });
    const [group] = buildPathwayRecordChecklist([
      result("sleep-apnea", "Sleep Apnea", "Respiratory System", rec({
        contributingPrimaries: [directWithCareObstacle],
      })),
    ]);
    const pathway = group.pathways[0];
    expect(pathway.spicerTreatmentInterference).toBe(false);
    expect(pathway.items.map((item) => item.record).join(" ")).not.toMatch(
      /interfered with treatment/i,
    );
  });

  it("includes alternative-cause items drawn from the authored etiologies to rule out", () => {
    const [group] = buildPathwayRecordChecklist([result("sleep-apnea", "Sleep Apnea", "Respiratory System", rec())]);
    const alternative = group.pathways[0].items.find((item) => item.category === "alternatives");
    expect(alternative).toBeDefined();
    expect(alternative?.record).toContain("Idiopathic sleep-disordered breathing");
  });

  it("handles primaries without nexusClaim/mechanism/pathwayIntelligence without crashing", () => {
    const bare = primary({ nexusClaim: undefined, causalMechanism: undefined, pathwayIntelligence: undefined, evidentiaryProfile: undefined });
    const [group] = buildPathwayRecordChecklist([
      result("sleep-apnea", "Sleep Apnea", "Respiratory System", rec({ contributingPrimaries: [bare] })),
    ]);
    const pathway = group.pathways[0];
    expect(pathway.nexusClassification).toBeNull();
    expect(pathway.mechanismCategory).toBeNull();
    expect(pathway.pathwayTypes).toEqual([]);
    expect(pathway.items.length).toBeGreaterThanOrEqual(4);
    const joined = pathway.items.map((item) => item.record).join(" ");
    expect(joined).toMatch(/nexus opinion/i);
  });

  it("formats a text export with pathway headers, theory/mechanism lines, and disclaimer", () => {
    const groups = buildPathwayRecordChecklist([result("sleep-apnea", "Sleep Apnea", "Respiratory System", rec())]);
    const exported = formatPathwayRecordChecklist(groups);
    expect(exported).toContain("PATHWAY-SPECIFIC MEDICAL RECORD CHECKLIST");
    expect(exported).toContain("Pathway 1: PTSD → Sleep Apnea");
    expect(exported).toContain(`Claim theory: DIRECT_CAUSATION (${NEXUS_THEORY_LABEL.DIRECT_CAUSATION})`);
    expect(exported).toContain(`Mechanism: ${MECHANISM_CATEGORY_LABEL.NEUROLOGICAL_DEGENERATION}`);
    expect(exported).toContain("DISCLAIMER");
    expect(exported.toLowerCase()).not.toContain("guarantee");
    expect(exported.toLowerCase()).not.toContain("eligible");
    expect(exported.toLowerCase()).not.toContain("approved");
  });

  it("preserves records marked as located in the text export", () => {
    const groups = buildPathwayRecordChecklist([result("sleep-apnea", "Sleep Apnea", "Respiratory System", rec())]);
    const group = groups[0];
    const pathway = group.pathways[0];
    const first = pathway.items[0];
    const second = pathway.items[1];
    const located: Record<string, true> = {
      [pathwayChecklistItemKey(group, pathway, first)]: true,
    };

    const exported = formatPathwayRecordChecklist(groups, located);
    expect(exported).toContain(`[x] ${first.record}`);
    expect(exported).toContain(`[ ] ${second.record}`);
  });

  it("combines the checklist with the consultation summary for one export", () => {
    const groups = buildPathwayRecordChecklist([result("sleep-apnea", "Sleep Apnea", "Respiratory System", rec())]);
    const combined = combineChecklistWithSummary(
      formatPathwayRecordChecklist(groups),
      "SECONDARY CLAIM RESEARCH & EVIDENCE CHECKLIST\nBody",
    );
    expect(combined).toContain("PATHWAY-SPECIFIC MEDICAL RECORD CHECKLIST");
    expect(combined).toContain("SECONDARY CLAIM RESEARCH & EVIDENCE CHECKLIST");
  });

  it("wires PathwayRecordChecklist into Steps 5 and 6 and keeps the lib module present", async () => {
    const fs = await import("node:fs");
    const suggestionsPage = fs.readFileSync("src/components/secondary/steps/SuggestionsStep.tsx", "utf8");
    const evidencePage = fs.readFileSync("src/components/secondary/steps/EvidenceStep.tsx", "utf8");
    expect(suggestionsPage).toContain("<PathwayRecordChecklist");
    expect(suggestionsPage).toContain("matchedIntakeContext: []");
    expect(evidencePage).toContain("<PathwayRecordChecklist");
    expect(evidencePage).toContain("summaryRecommendations={consultationRecommendations}");
    expect(fs.existsSync("src/lib/secondary-workflow/pathway-record-checklist.ts")).toBe(true);
    expect(fs.existsSync("src/components/secondary/PathwayRecordChecklist.tsx")).toBe(true);
  });

  it("persisted per-tab via the registered sessionStorage key, browser-only with no network calls", async () => {
    const fs = await import("node:fs");
    const component = fs.readFileSync("src/components/secondary/PathwayRecordChecklist.tsx", "utf8");
    const localState = fs.readFileSync("src/lib/secondary-workflow/local-state.ts", "utf8");
    expect(component).toContain('"use client"');
    expect(component).toContain("URL.createObjectURL");
    expect(component).toContain("pathwayRecordChecklistStorageKey");
    expect(component).toContain("useSyncExternalStore");
    expect(component).toContain("window.sessionStorage.setItem");
    expect(localState).toContain('"secondary-condition-finder:pathway-record-checklist:v1"');
    // The key must be registered for completion-time clearing.
    expect(localState).toContain("pathwayRecordChecklistStorageKey,");
    expect(component).not.toContain("fetch(");
    expect(component).not.toContain("sendBeacon");
  });

  it("provides a user-controlled Clear checkmarks reset that removes the tab-local store", async () => {
    const fs = await import("node:fs");
    const component = fs.readFileSync("src/components/secondary/PathwayRecordChecklist.tsx", "utf8");
    expect(component).toContain("Clear checkmarks");
    expect(component).toContain("removeItem(pathwayRecordChecklistStorageKey)");
    expect(component).toContain("disabled={checkedCount === 0}");
  });
});
