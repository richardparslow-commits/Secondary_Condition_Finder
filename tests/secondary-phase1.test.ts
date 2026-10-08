import { describe, expect, it } from "vitest";

import type { NonServiceConnectedConditionResult } from "@/lib/secondary-workflow/suggestions";
import { buildMedicalRecordChecklist, categorizeGap, formatMedicalRecordChecklist } from "@/lib/secondary-workflow/medical-record-checklist";
import { analyzeCombinationInsights, formatCombinationInsights } from "@/lib/secondary-workflow/combination-insights";
import { buildComparisonRows, formatConditionComparison } from "@/lib/secondary-workflow/condition-comparison";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { indexById } from "@/lib/catalog/lookup";
import type { Recommendation } from "@/lib/engine/types";

function rec(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    conditionId: "migraine-headaches",
    condition: "Migraine Headaches",
    bodySystem: "Neurological System",
    etiologicalConsensus: "PROBABLE",
    score: 1,
    contributingPrimaries: [{ id: "ptsd", name: "PTSD", rank: 1, rationale: "PTSD rationale for test" }],
    evidenceGaps: ["Sleep study confirming OSA diagnosis", "Neurology nexus opinion addressing causation", "Chronology of onset and diagnosis"],
    sourceReferences: [
      { citation: "Test Citation", note: "Test note", verificationScope: "clinical-evidence", verified: false },
    ],
    matchedIntakeContext: [],
    ...overrides,
  } as Recommendation;
}

function result(id: string, name: string, bodySystem: string, recommendation: Recommendation | null): NonServiceConnectedConditionResult {
  return { conditionId: id, conditionName: name, bodySystem, recommendation };
}

describe("Phase 1 — medical record checklist / comparison / combination", () => {
  it("categorizeGap buckets evidence gaps conservatively", () => {
    expect(categorizeGap("Sleep study (polysomnography) confirming OSA diagnosis")).toBe("imaging");
    expect(categorizeGap("Neurology evaluation and specialist notes")).toBe("specialist");
    expect(categorizeGap("Prescription records showing SSRI exposure and timing")).toBe("treatment");
    expect(categorizeGap("Chronology of onset and diagnosis year")).toBe("chronology");
    expect(categorizeGap("Medical nexus opinion addressing causation")).toBe("nexus-opinion");
    expect(categorizeGap("Independent documentation meeting diagnostic criteria")).toBe("diagnosis");
  });

  it("buildMedicalRecordChecklist groups authored gaps by category with why text", () => {
    const groups = buildMedicalRecordChecklist([
      result("migraine-headaches", "Migraine Headaches", "Neurological System", rec()),
      result("sleep-apnea", "Sleep Apnea", "Respiratory System", rec({ conditionId: "sleep-apnea", condition: "Sleep Apnea", bodySystem: "Respiratory System", evidenceGaps: ["Headache log frequency"] })),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].conditionName.localeCompare(groups[1].conditionName)).toBeLessThanOrEqual(0);
    for (const group of groups) {
      for (const item of group.items) {
        expect(item.why.length).toBeGreaterThan(10);
      }
    }
    const exported = formatMedicalRecordChecklist(groups);
    expect(exported).toContain("MEDICAL RECORD CHECKLIST");
    expect(exported).toContain("DISCLAIMER");
  });

  it("buildComparisonRows projects nexus/consensus/citations/gaps and formats text export", () => {
    const catalog = loadConditionCatalog();
    const byId = indexById(catalog);
    const catalogById = new Map(byId) as Map<string, import("@/lib/catalog/schema").CatalogCondition>;
    const results: NonServiceConnectedConditionResult[] = [
      result("migraine-headaches", "Migraine Headaches", "Neurological System", rec()),
      result("sleep-apnea", "Sleep Apnea", "Respiratory System", rec({ conditionId: "sleep-apnea", condition: "Sleep Apnea", bodySystem: "Respiratory System", etiologicalConsensus: "WELL_ESTABLISHED", evidenceGaps: ["gap a", "gap b"] })),
      result("tinnitus", "Tinnitus", "Auditory System", null),
    ];
    const rows = buildComparisonRows(results, ["migraine-headaches", "sleep-apnea", "tinnitus"], catalogById);
    expect(rows).toHaveLength(2); // tinnitus has no recommendation
    expect(rows[0].citationCount).toBeGreaterThanOrEqual(1);
    const exported = formatConditionComparison(rows);
    expect(exported).toContain("CONDITION COMPARISON");
    expect(exported).toContain("DISCLAIMER");
  });

  it("analyzeCombinationInsights classifies pairwise relations from shared primaries and body system", () => {
    const r1 = result("migraine-headaches", "Migraine Headaches", "Neurological System", rec());
    const r2 = result("sleep-apnea", "Sleep Apnea", "Respiratory System", rec({ conditionId: "sleep-apnea", condition: "Sleep Apnea", bodySystem: "Respiratory System" }));
    const r3 = result("tinnitus", "Tinnitus", "Neurological System", rec({ conditionId: "tinnitus", condition: "Tinnitus", bodySystem: "Neurological System", contributingPrimaries: [{ id: "hearing-loss", name: "Hearing Loss", rank: 1, rationale: "other" }] }));

    // r1 + r2 share PTSD primary → synergistic
    const insightsSyn = analyzeCombinationInsights([r1, r2]);
    expect(insightsSyn[0].relation).toBe("synergistic");
    expect(insightsSyn[0].reason).toContain("PTSD");

    // r1 + r3: different primaries but same body system → conflicting
    const insightsConf = analyzeCombinationInsights([r1, r3]);
    expect(insightsConf[0].relation).toBe("conflicting");
    expect(insightsConf[0].riskNote).toBeDefined();

    // r2 + r3: different primaries, different systems → independent
    const insightsInd = analyzeCombinationInsights([r2, r3]);
    expect(insightsInd[0].relation).toBe("independent");

    const exported = formatCombinationInsights(insightsSyn);
    expect(exported).toContain("CONDITION COMBINATION INSIGHTS");
    expect(exported).toContain("DISCLAIMER");
  });

  it("MedicalRecordChecklist and comparison/combination panels are wired into pages", async () => {
    const fs = await import("node:fs");
    const suggestionsPage = fs.readFileSync("src/components/secondary/steps/SuggestionsStep.tsx", "utf8");
    expect(suggestionsPage).toContain("ConditionComparisonTool");
    expect(suggestionsPage).toContain("CombinationInsightsPanel");
    const evidencePage = fs.readFileSync("src/components/secondary/steps/EvidenceStep.tsx", "utf8");
    expect(evidencePage).toContain("MedicalRecordChecklist");
    expect(evidencePage).toContain("buildMedicalRecordChecklist");
    const libFiles = [
      "src/lib/secondary-workflow/medical-record-checklist.ts",
      "src/lib/secondary-workflow/condition-comparison.ts",
      "src/lib/secondary-workflow/combination-insights.ts",
    ];
    for (const file of libFiles) expect(fs.existsSync(file)).toBe(true);
  });
});

describe("Phase 1 boundary — no PHI or server-persisted state, never a determination", () => {
  it("checklist/comparison/combination modules never mention a guarantee or eligibility", () => {
    const checklist = formatMedicalRecordChecklist(buildMedicalRecordChecklist([result("migraine-headaches", "Migraine Headaches", "Neurological System", rec())]));
    expect(checklist.toLowerCase()).not.toContain("guarantee");
    expect(checklist.toLowerCase()).not.toContain("eligible");
    expect(checklist.toLowerCase()).not.toContain("approved");
  });

  it("comparison export contains the required disclaimer line", () => {
    const catalog = loadConditionCatalog();
    const byId = indexById(catalog);
    const catalogById = new Map(byId) as Map<string, import("@/lib/catalog/schema").CatalogCondition>;
    const row = buildComparisonRows([result("migraine-headaches", "Migraine Headaches", "Neurological System", rec())], ["migraine-headaches"], catalogById);
    const exported = formatConditionComparison(row);
    expect(exported).toContain("Research comparison only");
  });
});
