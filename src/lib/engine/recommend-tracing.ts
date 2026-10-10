import "server-only";

import type { ConditionCatalog } from "@/lib/catalog/schema";
import type { KnowledgeBase } from "@/lib/kb/schema";
import {
  isLangSmithTracingEnabled,
  LANGSMITH_PROJECT_NAME,
  traceable,
} from "@/lib/observability/langsmith";

import { recommend, ENGINE_VERSION } from "./recommend";
import type { Intake, RecommendationResult } from "./types";

/**
 * Server-only LangSmith wrapper for the recommendation engine (PRIV-01).
 *
 * The six-step secondary workflow runs the engine in the browser now and
 * no longer sends veteran context to the server, so nothing invokes this
 * wrapper in production. It stays available for server-side callers with
 * synthetic or public inputs only — the `server-only` marker keeps it out
 * of any client bundle, and the redaction contract below still applies.
 */

/**
 * LangSmith-traced entry point. When LANGSMITH_TRACING=true every Step 5
 * call appears in the configured project (default `secondary-condition-finder`)
 * so Engine can cluster traces into issues and — when a repository is
 * connected — open automated PRs against this codebase. Input/output
 * redaction stays in the same contract as `logger.ts`: only counts/ids are
 * attached to traces (never raw evidence or workflow payloads).
 *
 * This wraps a `Promise`-returning function, so it always returns
 * `Promise<RecommendationResult>`. Server pages should `await` it.
 */
export async function recommendForTraceSafely(
  catalog: ConditionCatalog,
  kb: KnowledgeBase,
  intake: Intake,
): Promise<RecommendationResult> {
  try {
    return recommend(catalog, kb, intake);
  } catch {
    // LangSmith's traceable wrapper records String(error) on rejection. Do not
    // let upstream exception text, cause, or stack leave through that sink.
    throw new Error("Recommendation execution failed; diagnostic details withheld.");
  }
}

function safeTraceCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export function sanitizeRecommendationTraceInputs(inputs: unknown): Record<string, string | number | boolean> {
  try {
    const args = (inputs as { args?: unknown[] } | null)?.args;
    const intakeArg = args?.[2] as Intake | undefined;
    if (!intakeArg) return { input: "no-intake" };
    return {
      diagnosedConditionIds: safeTraceCount(intakeArg.diagnosedConditionIds),
      primaryConditions: safeTraceCount(intakeArg.primaryConditions),
      hasTimeline: Boolean(intakeArg.conditionTimeline && Object.keys(intakeArg.conditionTimeline).length),
      engineVersion: ENGINE_VERSION,
    };
  } catch {
    return { input: "unavailable" };
  }
}

export function sanitizeRecommendationTraceOutputs(outputs: unknown): Record<string, string | number> {
  try {
    const result = outputs as RecommendationResult | null;
    if (!result || typeof result !== "object") return { output: "unavailable" };
    return {
      recommendationCount: safeTraceCount(result.recommendations),
      recognizedPrimaries: safeTraceCount(result.recognizedPrimaries),
      unmappedPrimaries: safeTraceCount(result.unmappedPrimaries),
    };
  } catch {
    return { output: "unavailable" };
  }
}

export const recommendTraced = traceable(
  recommendForTraceSafely,
  {
    name: "recommend",
    run_type: "chain",
    project_name: LANGSMITH_PROJECT_NAME,
    tags: ["secondary-condition-finder", "recommendation-engine", ENGINE_VERSION],
    // Only attach safe metadata — never raw intake text or evidence.
    // Each callback catches malformed/unexpected inputs and returns only a
    // fixed bounded DTO; raw values must never escape through SDK diagnostics.
    processInputs: (inputs) => sanitizeRecommendationTraceInputs(inputs),
    processOutputs: (outputs) => sanitizeRecommendationTraceOutputs(outputs),
  },
);

/**
 * Convenience helper for `async` server components/pages. Returns a
 * `RecommendationResult` whether or not LangSmith is configured, so the
 * same call site works in local dev (no key), CI (no tracing), and
 * production (tracing on + Engine connected). When tracing is disabled this
 * is just a direct sync call with no Promise overhead beyond the `async`
 * wrapper.
 */
export async function recommendWithTracing(
  catalog: ConditionCatalog,
  kb: KnowledgeBase,
  intake: Intake,
): Promise<RecommendationResult> {
  if (!isLangSmithTracingEnabled()) {
    return recommendForTraceSafely(catalog, kb, intake);
  }
  // `traceable` emits a rejected error's String(error) to LangSmith. Its
  // wrapped function is recommendForTraceSafely, so rejection details are
  // already replaced before they reach the SDK.
  return recommendTraced(catalog, kb, intake);
}
