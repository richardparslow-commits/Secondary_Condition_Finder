import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildSecondaryRecommendationIntake } from "@/lib/secondary-workflow/recommendation-intake";
import { parseWorkflowState } from "@/lib/secondary-workflow/state";
import {
  buildSymptomDiscussionPrompts,
  findSymptomBridgeMatches,
  listSymptomBridgeEntries,
  parseSymptomBridgeSelection,
} from "@/lib/secondary-workflow/symptom-bridge";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("controlled symptom research bridge", () => {
  it("uses a bounded controlled vocabulary with condition discussion topics", () => {
    const entries = listSymptomBridgeEntries();

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.length).toBeLessThanOrEqual(20);
    for (const entry of entries) {
      expect(entry.id).toMatch(/^[a-z0-9-]+$/);
      expect(entry.discussionConditionIds.length).toBeGreaterThan(0);
      expect(entry.prompt).toMatch(/does not|do not|not establish|not diagnose/i);
    }
  });

  it("accepts only exact controlled ids and removes duplicates or unknown values", () => {
    const allowed = listSymptomBridgeEntries()[0].id;
    expect(parseSymptomBridgeSelection([allowed, allowed, "unknown-symptom"])).toEqual([allowed]);
    expect(parseSymptomBridgeSelection(["numbness", "not-a-controlled-id"])).toEqual([]);
  });

  it("matches user-entered symptom labels only for exact controlled aliases", () => {
    const matches = findSymptomBridgeMatches(["numbness", "tingling"]);
    expect(matches.map((entry) => entry.id)).toContain("distal-numbness-tingling");
    expect(findSymptomBridgeMatches(["numb"])).toEqual([]);
  });

  it("builds provider-discussion prompts without asserting a diagnosis", () => {
    const entry = listSymptomBridgeEntries()[0];
    const names = new Map([
      ["peripheral-neuropathy", "Peripheral Neuropathy"],
      ["migraine-headaches", "Migraine Headaches"],
    ]);
    const prompts = buildSymptomDiscussionPrompts([entry.id], names);

    expect(prompts).toHaveLength(1);
    expect(prompts[0].symptomLabel).toBe(entry.label);
    expect(prompts[0].conditionIds).toEqual(entry.discussionConditionIds);
    expect(prompts[0].conditionNames).toEqual(["Peripheral Neuropathy"]);
    expect(prompts[0].prompt).toMatch(/provider|diagnos/i);
    expect(JSON.stringify(prompts)).not.toMatch(/nexus|caused|secondary service connection/i);
  });

  it("keeps symptom prompts separate from recommendation intake and Step 5/6 output", () => {
    const catalog = [{
      id: "ptsd",
      name: "PTSD",
      aliases: [],
      bodySystem: "Mental Disorders",
      ratingSchedule: [],
      reviewNotes: [],
    }];
    const state = parseWorkflowState({
      diagnosed: ["ptsd"],
      serviceConnected: ["ptsd"],
      "rating-ptsd": "70",
      documentsShared: "no",
      symptomIds: ["recurrent-headache"],
    }, catalog);
    const intake = buildSecondaryRecommendationIntake({
      ...state,
      symptomIds: ["recurrent-headache"],
    });

    expect(intake.diagnosedConditionIds).toEqual(["ptsd"]);
    expect(intake.primaryConditions).toEqual(["ptsd"]);
    expect(intake.symptoms).toEqual([]);
    expect(read("src/app/secondary/suggestions/page.tsx")).toContain("SymptomDiscussionReview");
    expect(read("src/app/secondary/evidence/page.tsx")).toContain("SymptomDiscussionReview");
    expect(read("src/lib/secondary-workflow/recommendation-intake.ts")).toContain("symptoms: [],");
  });
});
