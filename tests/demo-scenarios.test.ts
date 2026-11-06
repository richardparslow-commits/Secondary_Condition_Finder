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
  workflowSessionToQueryParams,
  type TransportableWorkflowState,
} from "@/lib/secondary-workflow/transport";

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
      // The browser-local launcher validates the bundled workflow through the
      // same parse contract before persisting it (PRIV-01 stage 2/3).
      const workflow = scenario.workflow as unknown as TransportableWorkflowState;
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

  it("launches from /scenarios entirely in the browser with no legacy query URL", () => {
    const page = readRepoFile("src/app/scenarios/page.tsx");
    const form = readRepoFile("src/components/ScenarioLaunchForm.tsx");

    expect(page).toContain("<ScenarioLaunchForm scenarioId={scenario.id} />");
    expect(page).not.toContain("URLSearchParams");
    expect(page).not.toContain("/results?");
    expect(page).not.toContain("toQuery(");
    expect(page).not.toContain("@/lib/actions");

    // The launcher validates the synthetic state through the same workflow
    // contract, persists the context first, clears the old supporting state
    // without deleting that context, and only then navigates. No cookie, no
    // request.
    expect(form).toContain('"use client"');
    expect(form).toContain("parseWorkflowState(workflowSessionToQueryParams(workflow), corpus.conditions)");
    expect(form).toContain("persist(workflow");
    expect(form).toContain("clearSecondaryWorkflowAuxiliaryState(window.sessionStorage)");
    expect(form.indexOf("persist(workflow")).toBeLessThan(
      form.indexOf("clearSecondaryWorkflowAuxiliaryState(window.sessionStorage)"),
    );
    expect(form).toContain('router.push("/secondary/suggestions")');
    expect(form).not.toContain("fetch(");
    expect(form).not.toContain("sendBeacon");
    expect(form).not.toContain("writeSecondaryWorkflowSession");
    expect(form).toContain("setError(");
  });
});
