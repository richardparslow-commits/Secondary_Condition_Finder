"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { z } from "zod";

import scenarios from "../../../data/demo-scenarios.json";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { parseWorkflowState } from "@/lib/secondary-workflow/state";
import {
  parseStoredSecondaryWorkflowState,
  workflowSessionToQueryParams,
  writeSecondaryWorkflowSession,
} from "@/lib/secondary-workflow/session";

const scenarioIdSchema = z.string().min(1).max(80).regex(/^[a-z0-9-]+$/);

/**
 * Runtime validation for the build-time-imported demo-scenario JSON.
 *
 * `data/demo-scenarios.json` is imported directly, so TypeScript trusts its
 * shape at compile time only — a malformed or drifted file would otherwise
 * hand `scenario.workflow` to the state parsers as an implicitly-typed
 * `any`. This schema re-checks the contract at module load: every scenario
 * must carry display strings and a `workflow` object that at minimum holds
 * the diagnosed-condition list the parsers (and the scenarios page) rely
 * on. Unknown workflow keys pass through untouched; the authoritative
 * stored-state contract is still enforced by
 * `parseStoredSecondaryWorkflowState` inside the guarded try block below.
 */
const scenarioWorkflowSchema = z.looseObject({
  diagnosedConditionIds: z.array(z.string()).min(1),
});

const demoScenarioSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  workflow: scenarioWorkflowSchema,
});

const scenarioListSchema = z.array(demoScenarioSchema);

// Fail soft at load time: if the JSON ever drifts out of contract, the
// launch action degrades to "unknown scenario" redirects instead of
// crashing the module (which would 500 every route that imports it).
// The authoritative per-scenario deep validation still runs per request in
// the try block, and tests/demo-scenarios.test.ts walks every scenario
// through the real workflow contract at CI time.
const parsedScenarios = scenarioListSchema.safeParse(scenarios);
const demoScenarios: z.infer<typeof scenarioListSchema> = parsedScenarios.success
  ? parsedScenarios.data
  : [];

/**
 * Load a pre-built demo scenario and populate the secondary workflow session.
 *
 * Form fields: `scenarioId` (string, 1-80 chars, lowercase alphanumeric + hyphens).
 * Success: redirect to /secondary/suggestions.
 * Error: redirect to /scenarios (invalid or unknown ID) or
 * /scenarios?error=invalid_state (scenario state failed validation/parse).
 * See docs/api-specification.md for full contract.
 */
export async function launchDemoScenario(formData: FormData): Promise<void> {
  // FormData.get() yields `string | File | null`. Narrow to a real string
  // before schema validation so a uploaded-file field (or a missing field)
  // can never reach Zod as a non-string object.
  const scenarioIdRaw = formData.get("scenarioId");
  const scenarioId = typeof scenarioIdRaw === "string" ? scenarioIdRaw : null;

  const parsedScenarioId = scenarioIdSchema.safeParse(scenarioId);
  if (!parsedScenarioId.success) redirect("/scenarios");

  const scenario = demoScenarios.find(
    (candidate) => candidate.id === parsedScenarioId.data,
  );
  if (!scenario) redirect("/scenarios");

  // Error-handling boundary: the parsers below throw plain `Error`s on
  // malformed workflow state, and `writeSecondaryWorkflowSession` can throw
  // `WorkflowCookieBudgetError` when state exceeds the cookie budget. Left
  // unguarded, any of these surfaces as an unhandled 500. Here a failure
  // cleanly redirects the veteran back to the scenario list.
  try {
    const workflow = parseStoredSecondaryWorkflowState(scenario.workflow);
    const catalog = loadConditionCatalog();

    // Parse through the same current-workflow contract used by the application
    // before persisting any synthetic demo state.
    parseWorkflowState(workflowSessionToQueryParams(workflow), catalog);
    await writeSecondaryWorkflowSession(workflow);
  } catch (error) {
    // `redirect()` works by throwing a NEXT_REDIRECT error, so a naive
    // catch would convert our own (or the framework's) control flow into
    // the invalid-state path. Re-throw redirect errors untouched; every
    // other failure is a genuine malformed-state condition.
    if (isRedirectError(error)) throw error;
    redirect("/scenarios?error=invalid_state");
  }

  // Success redirect lives AFTER and OUTSIDE the try/catch: if it ran
  // inside the guarded region its NEXT_REDIRECT throw would be caught by
  // our own error boundary.
  redirect("/secondary/suggestions");
}
