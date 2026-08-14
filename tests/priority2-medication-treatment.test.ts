import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { recommend } from "@/lib/engine/recommend";
import { intakeSchema } from "@/lib/engine/types";
import { loadKnowledgeBase } from "@/lib/kb/load";
import {
  parseDocumentsSelection,
  workflowStateToSearchParams,
} from "@/lib/secondary-workflow/state";
import {
  openWorkflowState,
  sealWorkflowState,
} from "@/lib/secondary-workflow/session";

const catalog = loadConditionCatalog();
const kb = loadKnowledgeBase();
const TEST_SECRET = "priority-2-test-secret-is-at-least-32-characters";

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Priority 2 medication and treatment intake", () => {
  it("parses bounded optional medication/treatment context from Step 4", () => {
    const state = parseDocumentsSelection(
      {
        diagnosed: ["ptsd", "erectile-dysfunction"],
        serviceConnected: ["ptsd"],
        "rating-ptsd": "70",
        documentsShared: "yes",
        medications: "SSRI\nSSRI\nNSAID",
        treatments: "Medication management\nPhysical therapy",
      },
      catalog,
    );

    expect(state.medications).toEqual(["SSRI", "NSAID"]);
    expect(state.treatments).toEqual(["Medication management", "Physical therapy"]);
  });

  it("keeps medication/treatment context out of URL serialization", () => {
    const params = workflowStateToSearchParams({
      diagnosedConditionIds: ["ptsd", "erectile-dysfunction"],
      serviceConnectedConditionIds: ["ptsd"],
      ratingsByConditionId: { ptsd: 70 },
      documentsShared: true,
      medications: ["SSRI"],
      treatments: ["Medication management"],
    });

    expect(params.has("medications")).toBe(false);
    expect(params.has("treatments")).toBe(false);
    expect(params.toString()).not.toContain("SSRI");
    expect(params.toString()).not.toContain("Medication");
  });

  it("round-trips bounded context through encrypted workflow state without plaintext leakage", () => {
    const sealed = sealWorkflowState(
      {
        diagnosedConditionIds: ["ptsd", "erectile-dysfunction"],
        serviceConnectedConditionIds: ["ptsd"],
        ratingsByConditionId: { ptsd: 70 },
        documentsShared: true,
        medications: ["SSRI"],
        treatments: ["Medication management"],
      },
      TEST_SECRET,
    );

    expect(sealed).not.toContain("SSRI");
    expect(sealed).not.toContain("Medication management");
    expect(openWorkflowState(sealed, TEST_SECRET)?.medications).toEqual(["SSRI"]);
    expect(openWorkflowState(sealed, TEST_SECRET)?.treatments).toEqual([
      "Medication management",
    ]);
  });

  it("highlights literal authored pathway overlap without changing ranking", () => {
    const base = recommend(
      catalog,
      kb,
      intakeSchema.parse({ primaryConditions: ["PTSD"] }),
    );
    const contextual = recommend(
      catalog,
      kb,
      intakeSchema.parse({
        primaryConditions: ["PTSD"],
        medications: ["SSRI", "sertraline"],
        treatments: ["unrelated treatment term"],
      }),
    );

    expect(contextual.recommendations.map((item) => item.conditionId)).toEqual(
      base.recommendations.map((item) => item.conditionId),
    );
    expect(contextual.recommendations.map((item) => item.score)).toEqual(
      base.recommendations.map((item) => item.score),
    );

    const ed = contextual.recommendations.find(
      (item) => item.conditionId === "erectile-dysfunction",
    );
    expect(ed?.matchedIntakeContext).toContain("SSRI");
    expect(ed?.matchedIntakeContext).not.toContain("sertraline");
    expect(ed?.matchedIntakeContext).not.toContain("unrelated treatment term");
  });

  it("wires Step 4 intake through the shared Steps 5 and 6 recommendation intake with explicit non-causal copy", () => {
    const upload = readRepoFile("src/app/secondary/upload/page.tsx");
    const suggestions = readRepoFile("src/app/secondary/suggestions/page.tsx");
    const evidence = readRepoFile("src/app/secondary/evidence/page.tsx");
    const recommendationIntake = readRepoFile(
      "src/lib/secondary-workflow/recommendation-intake.ts",
    );
    const item = readRepoFile("src/components/SecondarySuggestionItem.tsx");

    expect(upload).toContain('name="medications"');
    expect(upload).toContain('name="treatments"');
    expect(upload).toContain("not placed in URLs");
    expect(suggestions).toContain("buildSecondaryRecommendationIntake(state)");
    expect(evidence).toContain("buildSecondaryRecommendationIntake(state)");
    expect(recommendationIntake).toContain("diagnosedConditionIds: state.diagnosedConditionIds");
    expect(recommendationIntake).toContain("medications: state.medications ?? []");
    expect(recommendationIntake).toContain("treatments: state.treatments ?? []");
    expect(item).toContain("literal text-overlap cue only");
    expect(item).toContain("does not change recommendation rank");
  });
});
