import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import scenarios from "../data/demo-scenarios.json";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { parseWorkflowState } from "@/lib/secondary-workflow/state";
import {
  workflowSessionToQueryParams,
  type TransportableWorkflowState,
} from "@/lib/secondary-workflow/transport";

/**
 * PRIV-01 stage 2 successor of the demo-scenario action test.
 *
 * Launching a demo scenario no longer sends anything to the server: the
 * launcher writes the synthetic workflow state straight into the
 * browser-local context after validating it through the same
 * current-workflow contract the wizard uses. The guardrails that mattered —
 * only known scenario ids, validated state before persistence, no cookie, no
 * request carrying workflow data — are pinned here.
 */

const catalog = loadConditionCatalog();

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("demo scenario launcher (browser-local)", () => {
  it("validates every shipped scenario through the real workflow contract", () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(3);
    for (const scenario of scenarios) {
      expect(() =>
        parseWorkflowState(
          workflowSessionToQueryParams(
            scenario.workflow as unknown as TransportableWorkflowState,
          ),
          catalog,
        ),
      ).not.toThrow();
    }
  });

  it("launches entirely in the browser: no server action, no cookie, no request", () => {
    const form = readRepoFile("src/components/ScenarioLaunchForm.tsx");

    expect(form).toContain('"use client"');
    expect(form).toContain('from "../../data/demo-scenarios.json"');
    expect(form).toContain("parseWorkflowState(workflowSessionToQueryParams(workflow), corpus.conditions)");
    expect(form).toContain("persist(workflow");
    expect(form).toContain("clearSecondaryWorkflowAuxiliaryState(window.sessionStorage)");
    expect(form.indexOf("persist(workflow")).toBeLessThan(
      form.indexOf("clearSecondaryWorkflowAuxiliaryState(window.sessionStorage)"),
    );
    expect(form).toContain('router.push("/secondary/suggestions")');
    expect(form).toContain("setError(");
    // No network channel of any kind, and no legacy cookie/session module.
    expect(form).not.toContain("fetch(");
    expect(form).not.toContain("sendBeacon");
    expect(form).not.toContain("@/lib/actions");
    expect(form).not.toContain("writeSecondaryWorkflowSession");
  });

  it("keeps the retired server action deleted", () => {
    expect(fs.existsSync(path.join(process.cwd(), "src/lib/actions/scenarios.ts"))).toBe(false);
    const page = readRepoFile("src/app/scenarios/page.tsx");
    expect(page).not.toContain("@/lib/actions");
    expect(page).toContain("<ScenarioLaunchForm scenarioId={scenario.id} />");
  });
});
