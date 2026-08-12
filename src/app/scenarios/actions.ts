"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import scenarios from "../../../data/demo-scenarios.json";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { parseWorkflowState } from "@/lib/secondary-workflow/state";
import {
  workflowSessionToQueryParams,
  writeSecondaryWorkflowSession,
  type StoredSecondaryWorkflowState,
} from "@/lib/secondary-workflow/session";

const scenarioIdSchema = z.string().min(1).max(80).regex(/^[a-z0-9-]+$/);

export async function launchDemoScenario(formData: FormData): Promise<void> {
  const scenarioId = scenarioIdSchema.parse(formData.get("scenarioId"));
  const scenario = scenarios.find((candidate) => candidate.id === scenarioId);
  if (!scenario) throw new Error("Unknown demo scenario");

  const workflow = scenario.workflow as StoredSecondaryWorkflowState;
  const catalog = loadConditionCatalog();

  // Parse through the same current-workflow contract used by the application
  // before persisting any synthetic demo state.
  parseWorkflowState(workflowSessionToQueryParams(workflow), catalog);
  await writeSecondaryWorkflowSession(workflow);

  redirect("/secondary/suggestions");
}
