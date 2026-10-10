import "server-only";

/**
 * LangSmith tracing helper for this repository.
 *
 * Purpose:
 * - Wrap pure server-side functions with `traceable` so LangSmith Engine
 *   can cluster traces into issues, diagnose against the connected source
 *   code, and open automated PRs (see `docs/langsmith-engine-setup.md`).
 *
 * This app has no long-lived LLM-agent process, so there is no OpenAI
 * `wrapOpenAI` wiring. The high-value surface is the recommendation engine
 * (`src/lib/engine/recommend.ts`), which is the single deterministic step
 * before `buildNonServiceConnectedConditionResults` on every Step 5 visit.
 *
 * Safety:
 * - `server-only` at the top prevents accidental client bundling.
 * - `LANGSMITH_TRACING` controls the `@traceable` decorator internally; the
 *   helper still adds metadata/tags but only emits traces when tracing is
 *   enabled and an API key is present.
 * - Inputs/outputs are redacted by design — callers should pass only counts
 *   and identifiers (never raw evidence, workflow payloads, or secrets).
 * - LangSmith's traceable wrapper records `String(error)` on thrown errors.
 *   Recommendation tracing therefore passes through a wrapper that replaces
 *   thrown values with a fixed, content-free error before the SDK sees them.
 *   Do not wrap new request-derived functions without the same failure-path
 *   handling and sentinel tests.
 *
 * Usage:
 *   import { traceable } from "@/lib/observability/langsmith";
 *   export const recommendTraced = traceable(recommend, {
 *     name: "recommend",
 *     run_type: "chain",
 *     tags: ["secondary-condition-finder", "recommendation-engine"],
 *   });
 *
 * Environment (see `.env.example`):
 *   LANGSMITH_TRACING=true          (required — master tracing toggle)
 *   LANGSMITH_API_KEY=lsv2_pt_...    (required — project-scoped API key)
 *   LANGSMITH_PROJECT=secondary-condition-finder  (recommended)
 *   LANGSMITH_ENDPOINT=https://api.smith.langchain.com  (EU/APAC only)
 */

// F-08: correct re-export per `langsmith/dist/traceable.d.ts` — `project_name?: string`
// is the accepted key (also `dist/traceable.js:622 maybeCreateOtelContext`). No
// `experimental/otel` import needed: the recommendation engine is deterministic
// (no LLM call to wrap).
export { traceable } from "langsmith/traceable";

/**
 * Convenience check so callers can skip expensive metadata construction when
 * tracing is disabled. Mirrors LangSmith's own env flag.
 */
export function isLangSmithTracingEnabled(): boolean {
  return process.env.LANGSMITH_TRACING === "true";
}

/**
 * Project name used for all traces from this repo. Keep this stable so
 * Engine's issue clustering works; Engine groups by project.
 * F-09: default `LANGSMITH_ENDPOINT` is `https://api.smith.langchain.com`
 * (see `.env.example`); EU/APAC tenants may override via that env var.
 */
export const LANGSMITH_PROJECT_NAME = "secondary-condition-finder";
