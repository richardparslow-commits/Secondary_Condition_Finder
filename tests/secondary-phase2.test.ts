import { describe, expect, it } from "vitest";

import type { NonServiceConnectedConditionResult } from "@/lib/secondary-workflow/suggestions";
import { buildRatingGuide, collectSymptomNotes, formatRatingGuide, GENERIC_RATING_SCALE, GENERIC_FUNCTIONAL_PROMPTS, symptomNoteId } from "@/lib/secondary-workflow/rating-guide";
import { actionPlanSteps, buildActionPlan, formatActionPlan } from "@/lib/secondary-workflow/action-plan";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { indexById } from "@/lib/catalog/lookup";
import type { Recommendation } from "@/lib/engine/types";

function rec(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    conditionId: "migraine-headaches",
    condition: "Migraine Headaches",
    bodySystem: "Neurological System",
    etiologicalConsensus: "PROBABLE",
    score: 0.5,
    contributingPrimaries: [{ id: "ptsd", name: "PTSD", rank: 1, rationale: "PTSD rationale for test" }],
    evidenceGaps: ["gap one", "gap two"],
    sourceReferences: [{ citation: "Test Citation", note: "Test note", verificationScope: "clinical-evidence", verified: false }],
    matchedIntakeContext: [],
    ...overrides,
  } as Recommendation;
}

function result(id: string, name: string, bodySystem: string, recommendation: Recommendation | null): NonServiceConnectedConditionResult {
  return { conditionId: id, conditionName: name, bodySystem, recommendation };
}

describe("Phase 2 — rating guide and action plan", () => {
  it("buildRatingGuide projects ratingSchedule from catalog and preserves consensus/score", () => {
    const catalog = loadConditionCatalog();
    const byId = indexById(catalog);
    const catalogById = new Map(byId) as Map<string, import("@/lib/catalog/schema").CatalogCondition>;
    // Use a condition known to have a catalog ratingSchedule entry
    const ptsd = catalogById.get("ptsd");
    expect(ptsd).toBeDefined();
    expect(ptsd!.ratingSchedule.length).toBeGreaterThan(0);
    const results: NonServiceConnectedConditionResult[] = [
      result("ptsd", "Post-Traumatic Stress Disorder (PTSD)", "Mental Disorders", rec({ conditionId: "ptsd", condition: "PTSD" })),
      result("tinnitus", "Tinnitus", "Auditory System", null),
    ];
    const entries = buildRatingGuide(results, catalogById);
    expect(entries).toHaveLength(1);
    expect(entries[0].conditionId).toBe("ptsd");
    expect(entries[0].ratingSchedule.length).toBeGreaterThan(0);
    expect(entries[0].etiologicalConsensus).toBe("PROBABLE");
  });

  it("formatRatingGuide is informational and never predicts a rating", () => {
    const catalog = loadConditionCatalog();
    const byId = indexById(catalog);
    const catalogById = new Map(byId) as Map<string, import("@/lib/catalog/schema").CatalogCondition>;
    const entries = buildRatingGuide([result("ptsd", "Post-Traumatic Stress Disorder (PTSD)", "Mental Disorders", rec({ conditionId: "ptsd", condition: "PTSD" }))], catalogById);
    const exported = formatRatingGuide(entries);
    expect(exported).toContain("VA RATING SCHEDULE GUIDE");
    expect(exported).toContain("not a VA rating determination");
    expect(exported).toContain("DISCLAIMER");
    expect(exported.toLowerCase()).not.toContain("you qualify for");
    expect(exported.toLowerCase()).not.toContain("you are rated at");
    for (const tick of GENERIC_RATING_SCALE) expect(exported).toContain(`${tick}%`);
    for (const prompt of GENERIC_FUNCTIONAL_PROMPTS) expect(exported).toContain(prompt);
  });

  it("symptomNoteId scopes selections per condition and collectSymptomNotes projects only marked prompts", () => {
    const catalog = loadConditionCatalog();
    const byId = indexById(catalog);
    const catalogById = new Map(byId) as Map<string, import("@/lib/catalog/schema").CatalogCondition>;
    const entries = buildRatingGuide([
      result("ptsd", "Post-Traumatic Stress Disorder (PTSD)", "Mental Disorders", rec({ conditionId: "ptsd", condition: "PTSD" })),
      result("migraine-headaches", "Migraine Headaches", "Neurological System", rec()),
    ], catalogById);

    const selections: Record<string, boolean> = {};
    selections[symptomNoteId("ptsd", GENERIC_FUNCTIONAL_PROMPTS[0])] = true;
    selections[symptomNoteId("migraine-headaches", GENERIC_FUNCTIONAL_PROMPTS[1])] = true;
    // A truthy value under a bare prompt key (legacy/shared shape) must not leak in.
    selections[GENERIC_FUNCTIONAL_PROMPTS[2]] = true;

    const notes = collectSymptomNotes(entries, selections);
    expect(notes).toHaveLength(2);
    expect(notes.map((note) => note.conditionId).sort()).toEqual(["migraine-headaches", "ptsd"]);
    expect(notes.find((note) => note.conditionId === "ptsd")?.prompt).toBe(GENERIC_FUNCTIONAL_PROMPTS[0]);
    expect(notes.find((note) => note.conditionId === "migraine-headaches")?.prompt).toBe(GENERIC_FUNCTIONAL_PROMPTS[1]);
  });

  it("formatRatingGuide renders per-condition marked notes in the export", () => {
    const catalog = loadConditionCatalog();
    const byId = indexById(catalog);
    const catalogById = new Map(byId) as Map<string, import("@/lib/catalog/schema").CatalogCondition>;
    const entries = buildRatingGuide([result("ptsd", "Post-Traumatic Stress Disorder (PTSD)", "Mental Disorders", rec({ conditionId: "ptsd", condition: "PTSD" }))], catalogById);
    const selections: Record<string, boolean> = { [symptomNoteId("ptsd", GENERIC_FUNCTIONAL_PROMPTS[0])]: true };
    const exported = formatRatingGuide(entries, selections);
    expect(exported).toContain("Notes you marked while exploring");
    expect(exported).toContain(GENERIC_FUNCTIONAL_PROMPTS[0]);
    // No percentage inference anywhere in the export, even with selections.
    expect(exported).not.toMatch(/typically match criteria for \d+%/i);
    expect(exported).not.toMatch(/likely rating:? \d+%/i);
  });

  it("RatingGuide and ActionPlan are wired into Steps 5 and 6", async () => {
    const fs = await import("node:fs");
    const suggestionsPage = fs.readFileSync("src/app/secondary/suggestions/page.tsx", "utf8");
    expect(suggestionsPage).toContain("RatingGuide");
    expect(suggestionsPage).toContain("ActionPlan");
    const evidencePage = fs.readFileSync("src/app/secondary/evidence/page.tsx", "utf8");
    expect(evidencePage).toContain("RatingGuide");
    expect(evidencePage).toContain("ActionPlan");
    for (const file of ["src/lib/secondary-workflow/rating-guide.ts", "src/lib/secondary-workflow/action-plan.ts", "src/components/secondary/RatingGuide.tsx", "src/components/secondary/ActionPlan.tsx"]) {
      expect(fs.existsSync(file)).toBe(true);
    }
  });

  it("RatingGuide explorer stays condition-selector based with per-condition notes and no percentage inference", async () => {
    const fs = await import("node:fs");
    const component = fs.readFileSync("src/components/secondary/RatingGuide.tsx", "utf8");
    expect(component).toContain("rating-guide-condition-select");
    expect(component).toContain("symptomNoteId");
    expect(component).toContain("does not assign or suggest a rating category or percentage");
    expect(component).not.toMatch(/typically match criteria for/i);
    expect(component).not.toContain("likely rating");
    expect(component).not.toContain("fetch(");
    expect(component).not.toContain("sendBeacon");
  });

  it("buildActionPlan ranks by consensus > score > gaps > name and assigns 1-based rank", () => {
    const rWell = result("migraine-headaches", "Migraine Headaches", "Neurological System", rec({ conditionId: "migraine-headaches", condition: "Migraine Headaches", etiologicalConsensus: "WELL_ESTABLISHED", score: 0.2, evidenceGaps: ["a", "b", "c"] }));
    const rProb = result("sleep-apnea", "Sleep Apnea", "Respiratory System", rec({ conditionId: "sleep-apnea", condition: "Sleep Apnea", etiologicalConsensus: "PROBABLE", score: 0.9, evidenceGaps: ["a"] }));
    const rNot = result("tinnitus", "Tinnitus", "Auditory System", rec({ conditionId: "tinnitus", condition: "Tinnitus", etiologicalConsensus: "NOT_ESTABLISHED", score: 1.0 }));
    const entries = buildActionPlan([rNot, rProb, rWell]);
    expect(entries.map((e) => e.conditionName)).toEqual(["Migraine Headaches", "Sleep Apnea", "Tinnitus"]);
    expect(entries.map((e) => e.rank)).toEqual([1, 2, 3]);
  });

  it("buildActionPlan tiebreaks on score then gaps", () => {
    const rA = result("migraine-headaches", "Migraine Headaches", "Neurological", rec({ conditionId: "migraine-headaches", condition: "Migraine Headaches", etiologicalConsensus: "PROBABLE", score: 0.5, evidenceGaps: ["a", "b"] }));
    const rB = result("sleep-apnea", "Sleep Apnea", "Respiratory", rec({ conditionId: "sleep-apnea", condition: "Sleep Apnea", etiologicalConsensus: "PROBABLE", score: 0.9, evidenceGaps: ["a"] }));
    const entries = buildActionPlan([rA, rB]);
    expect(entries[0].conditionId).toBe("sleep-apnea"); // higher score wins
  });

  it("actionPlanSteps returns 4 steps and formatActionPlan contains timeline and disclaimer", () => {
    const entries = buildActionPlan([result("migraine-headaches", "Migraine Headaches", "Neurological System", rec())]);
    const steps = actionPlanSteps(entries[0]);
    expect(steps).toHaveLength(4);
    expect(steps[0].action.toLowerCase()).toContain("gather checklist");
    expect(steps[1].detail.toLowerCase()).toContain("provider");
    const exported = formatActionPlan(entries);
    expect(exported).toContain("YOUR NEXT STEPS");
    expect(exported).toContain("not VA guidance");
    expect(exported).toContain("Weeks 1–2");
    expect(exported).toContain("Months 3–5");
    expect(exported).toContain("va.gov/find-forms");
    expect(exported).toContain("DISCLAIMER");
  });

  it("action plan export never claims eligibility or a guaranteed outcome", () => {
    const entries = buildActionPlan([result("migraine-headaches", "Migraine Headaches", "Neurological System", rec())]);
    const exported = formatActionPlan(entries).toLowerCase();
    expect(exported).not.toContain("eligible");
    expect(exported).not.toContain("guaranteed");
    expect(exported).not.toContain("you will be granted");
  });

  it("empty results produce empty guides/plans gracefully", () => {
    const catalog = loadConditionCatalog();
    const byId = indexById(catalog);
    const catalogById = new Map(byId) as Map<string, import("@/lib/catalog/schema").CatalogCondition>;
    expect(buildRatingGuide([], catalogById)).toHaveLength(0);
    expect(buildActionPlan([])).toHaveLength(0);
    expect(formatActionPlan([])).toContain("no plan generated");
  });
});
