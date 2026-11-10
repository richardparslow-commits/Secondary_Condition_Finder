import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { conditionCatalogSchema } from "@/lib/catalog/schema";
import type { Recommendation } from "@/lib/engine/types";
import { buildNonServiceConnectedConditionResults } from "@/lib/secondary-workflow/suggestions";

const catalog = conditionCatalogSchema.parse([
  {
    id: "ptsd",
    name: "Post-Traumatic Stress Disorder (PTSD)",
    aliases: ["post-traumatic stress disorder"],
    bodySystem: "Mental Disorders",
    ratingSchedule: [],
    reviewNotes: ["test fixture"],
  },
  {
    id: "migraines",
    name: "Migraine Headaches",
    aliases: [],
    bodySystem: "Neurologic",
    ratingSchedule: [],
    reviewNotes: ["test fixture"],
  },
  {
    id: "sleep-apnea",
    name: "Sleep Apnea",
    aliases: [],
    bodySystem: "Respiratory",
    ratingSchedule: [],
    reviewNotes: ["test fixture"],
  },
  {
    id: "tinnitus",
    name: "Tinnitus",
    aliases: [],
    bodySystem: "Auditory",
    ratingSchedule: [],
    reviewNotes: ["test fixture"],
  },
]);

const mappedSleepApnea: Recommendation = {
  conditionId: "sleep-apnea",
  condition: "Sleep Apnea",
  bodySystem: "Respiratory",
  etiologicalConsensus: "WELL_ESTABLISHED",
  score: 1.5,
  contributingPrimaries: [
    {
      id: "ptsd",
      name: "Post-Traumatic Stress Disorder (PTSD)",
      rank: 1,
      rationale: "Authored PTSD to sleep-apnea relationship for test purposes.",
    },
    {
      id: "migraines",
      name: "Migraine Headaches",
      rank: 2,
      rationale: "Authored migraine to sleep-apnea relationship for test purposes.",
    },
  ],
  evidenceGaps: ["chronology"],
  sourceReferences: [
    {
      citation: "test source",
      note: "test",
      verificationScope: "clinical-evidence",
      verified: false,
    },
  ],
  matchedIntakeContext: [],
};

describe("buildNonServiceConnectedConditionResults", () => {
  it("makes every diagnosed non-service-connected condition a top-level result", () => {
    const results = buildNonServiceConnectedConditionResults(
      catalog,
      ["ptsd", "migraines", "sleep-apnea", "tinnitus"],
      ["ptsd", "migraines"],
      [mappedSleepApnea],
    );

    expect(results.map((result) => result.conditionId)).toEqual([
      "sleep-apnea",
      "tinnitus",
    ]);
    expect(results[0].recommendation?.contributingPrimaries.map((primary) => primary.id)).toEqual([
      "ptsd",
      "migraines",
    ]);
    expect(results[1].recommendation).toBeNull();
  });

  it("never turns an already service-connected diagnosis into a Step 5 target", () => {
    const results = buildNonServiceConnectedConditionResults(
      catalog,
      ["ptsd", "sleep-apnea"],
      ["ptsd", "sleep-apnea"],
      [mappedSleepApnea],
    );

    expect(results).toEqual([]);
  });

  it("does not surface recommendations for diagnoses the user did not report", () => {
    const results = buildNonServiceConnectedConditionResults(
      catalog,
      ["ptsd", "tinnitus"],
      ["ptsd"],
      [mappedSleepApnea],
    );

    expect(results).toHaveLength(1);
    expect(results[0].conditionId).toBe("tinnitus");
    expect(results[0].recommendation).toBeNull();
  });
});

describe("Step 5 diagnosis-centered contract", () => {
  const suggestionsPage = fs.readFileSync(
    path.join(process.cwd(), "src/components/secondary/steps/SuggestionsStep.tsx"),
    "utf8",
  );
  const evidencePage = fs.readFileSync(
    path.join(process.cwd(), "src/components/secondary/steps/EvidenceStep.tsx"),
    "utf8",
  );

  it("organizes Step 5 by non-service-connected diagnosis rather than by service-connected primary", () => {
    expect(suggestionsPage).toContain("Review Your Non-Service-Connected Diagnoses");
    expect(suggestionsPage).toContain("Organized by the diagnosed condition that is not yet service connected.");
    expect(suggestionsPage).toContain("other conditions you report were already diagnosed by a medical professional");
    expect(suggestionsPage).not.toContain("any record-derived research topics you explicitly reviewed in Step 4");
    expect(suggestionsPage).not.toContain("From records — research topics, not clinical diagnoses");
    expect(suggestionsPage).toContain("The page does not search for additional diagnoses that might develop in the future.");
    expect(suggestionsPage).not.toContain("Published Secondary Pathways");
    expect(suggestionsPage).not.toContain("groupSuggestionsByPrimary");
    expect(suggestionsPage).not.toContain("SecondarySuggestionItem");
  });

  it("keeps Step 6 inside the same non-service-connected diagnosis boundary", () => {
    expect(evidencePage).toContain("Evidence by Non-Service-Connected Diagnosis");
    expect(evidencePage).toContain("Only the diagnoses and possible service-connected relationships reviewed in Step 5 appear here.");
    expect(evidencePage).toContain("buildNonServiceConnectedConditionResults");
    expect(evidencePage).not.toContain("groupSuggestionsByPrimary");
  });
});
