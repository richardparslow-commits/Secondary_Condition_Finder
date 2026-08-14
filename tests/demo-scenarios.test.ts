import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import scenarios from "../data/demo-scenarios.json";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { recommend } from "@/lib/engine/recommend";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { draftMappings } from "@/lib/kb/lookup";
import { buildSecondaryRecommendationIntake } from "@/lib/secondary-workflow/recommendation-intake";
import { parseWorkflowState } from "@/lib/secondary-workflow/state";
import {
  parseStoredSecondaryWorkflowState,
  workflowSessionToQueryParams,
} from "@/lib/secondary-workflow/session";

const catalog = loadConditionCatalog();
const kb = loadKnowledgeBase();
const draftPrimaryIds = new Set(draftMappings(kb).map((mapping) => mapping.id));

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("demo scenarios", () => {
  it("ships at least three current-workflow synthetic scenarios", () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(3);

    const serialized = JSON.stringify(scenarios);
    expect(serialized).not.toContain('"symptoms"');
    expect(serialized).not.toContain('"exposures"');
    expect(serialized).not.toContain('"notes"');
    expect(serialized).not.toContain("not-a-condition");
  });

  it.each(scenarios.map((scenario) => [scenario.id, scenario] as const))(
    "runs %s through the current workflow contract without manual fixes",
    (_id, scenario) => {
      const workflow = parseStoredSecondaryWorkflowState(scenario.workflow);
      const state = parseWorkflowState(
        workflowSessionToQueryParams(workflow),
        catalog,
      );
      const result = recommend(
        catalog,
        kb,
        buildSecondaryRecommendationIntake(state),
      );

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(
        result.recommendations.every((recommendation) =>
          state.diagnosedConditionIds.includes(recommendation.conditionId),
        ),
      ).toBe(true);
      for (const recommendation of result.recommendations) {
        expect(recommendation.contributingPrimaries[0].rationale).toBeTruthy();
        expect(recommendation.sourceReferences.length).toBeGreaterThan(0);
        for (const primary of recommendation.contributingPrimaries) {
          expect(draftPrimaryIds.has(primary.id)).toBe(false);
        }
      }
    },
  );

  it("launches from /scenarios with only a scenario id and no legacy query URL", () => {
    const page = readRepoFile("src/app/scenarios/page.tsx");
    const form = readRepoFile("src/components/ScenarioLaunchForm.tsx");
    const action = readRepoFile("src/app/scenarios/actions.ts");

    expect(page).toContain("<ScenarioLaunchForm scenarioId={scenario.id} />");
    expect(page).not.toContain("URLSearchParams");
    expect(page).not.toContain("/results?");
    expect(page).not.toContain("toQuery(");

    expect(form).toContain('name="scenarioId"');
    expect(form).toContain("clearSecondaryWorkflowLocalState(window.sessionStorage)");
    expect(form).not.toContain("fetch(");
    expect(form).not.toContain("sendBeacon");

    expect(action).toContain('scenarioIdSchema.safeParse(formData.get("scenarioId"))');
    expect(action).toContain('if (!parsedScenarioId.success) redirect("/scenarios")');
    expect(action).toContain('if (!scenario) redirect("/scenarios")');
    expect(action).toContain("parseStoredSecondaryWorkflowState(scenario.workflow)");
    expect(action).toContain("parseWorkflowState(workflowSessionToQueryParams(workflow), catalog)");
    expect(action).toContain("await writeSecondaryWorkflowSession(workflow)");
    expect(action).toContain('redirect("/secondary/suggestions")');
    expect(action).not.toContain("throw new Error");
    expect(action).not.toContain("console.");
  });
});
