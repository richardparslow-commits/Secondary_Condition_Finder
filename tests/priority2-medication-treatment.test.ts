import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { recommend } from "@/lib/engine/recommend";
import { intakeSchema } from "@/lib/engine/types";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { parseDocumentsSelection } from "@/lib/secondary-workflow/state";
import {
  readBrowserWorkflowContext,
  writeBrowserWorkflowContext,
} from "@/lib/secondary-workflow/browser-context";

const catalog = loadConditionCatalog();
const kb = loadKnowledgeBase();

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

  it("has no production workflow-state URL serializer", async () => {
    const stateModule = await import("@/lib/secondary-workflow/state");
    const source = readRepoFile("src/lib/secondary-workflow/state.ts");

    expect("workflowStateToSearchParams" in stateModule).toBe(false);
    expect(source).not.toContain("new URLSearchParams");
  });

  it("round-trips bounded context through the browser-local record without a request", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
    };
    writeBrowserWorkflowContext(storage, {
      diagnosedConditionIds: ["ptsd", "erectile-dysfunction"],
      serviceConnectedConditionIds: ["ptsd"],
      ratingsByConditionId: { ptsd: 70 },
      documentsShared: true,
      medications: ["SSRI"],
      treatments: ["Medication management"],
    });

    const record = readBrowserWorkflowContext(storage);
    expect(record?.medications).toEqual(["SSRI"]);
    expect(record?.treatments).toEqual(["Medication management"]);

    // The record lives only in browser storage: the module never transmits it,
    // and the legacy sealed cookie path is gone (PRIV-01 stage 3).
    const source = readRepoFile("src/lib/secondary-workflow/browser-context.ts");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("sendBeacon");
    expect(source).not.toContain("document.cookie");
    expect(
      fs.existsSync(path.join(process.cwd(), "src/lib/secondary-workflow/session.ts")),
    ).toBe(false);
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
    const upload = readRepoFile("src/components/secondary/steps/UploadStep.tsx");
    const suggestions = readRepoFile("src/components/secondary/steps/SuggestionsStep.tsx");
    const evidence = readRepoFile("src/components/secondary/steps/EvidenceStep.tsx");
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
