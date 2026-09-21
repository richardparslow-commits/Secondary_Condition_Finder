/**
 * Workflow-session observability counters.
 *
 * Best-effort OTEL metrics, mirroring the engine/metrics.ts contract: no-op
 * when OTEL is absent (tests, local dev without a collector) and never throws.
 *
 * `workflow.cookie.budget.exceeded` counts sealed-cookie writes that refused
 * to persist because the state exceeded MAX_WORKFLOW_COOKIE_VALUE_BYTES. The
 * `step` attribute identifies which workflow action overflowed, so sustained
 * real-user pressure on the budget is visible without logging any condition,
 * rating, or free-text content.
 */

type Counter = { add: (v: number, attrs?: Record<string, string | number>) => void };

let budgetExceededCounter: Counter | null = null;
let metricsInitAttempted = false;

function getBudgetExceededCounter(): Counter | null {
  if (metricsInitAttempted) return budgetExceededCounter;
  metricsInitAttempted = true;

  try {
    // Lazy require — same pattern as engine/metrics.ts. `eval` avoids Next.js
    // static analysis treating this as a hard dependency.
    const api: typeof import("@opentelemetry/api") = eval("require")("@opentelemetry/api");
    const meter = api.metrics.getMeter("secondary-condition-finder-workflow");
    budgetExceededCounter = meter.createCounter("workflow.cookie.budget.exceeded", {
      description:
        "Workflow session writes refused because the sealed cookie exceeded the safe value budget.",
    });
  } catch {
    budgetExceededCounter = null;
  }

  return budgetExceededCounter;
}

/** Records one budget-exceeded session write for the given workflow step. */
export function recordWorkflowCookieBudgetExceeded(step: string): void {
  try {
    getBudgetExceededCounter()?.add(1, { step });
  } catch {
    // Metrics are best-effort; never break the workflow on telemetry failure.
  }
}
