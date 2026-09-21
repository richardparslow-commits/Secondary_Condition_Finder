/**
 * CSP / Trusted-Types violation observability counters.
 *
 * Best-effort OTEL metrics, mirroring the workflow-metrics.ts contract: no-op
 * when OTEL is absent (tests, local dev without a collector) and never throws.
 *
 * `csp.violation` counts redacted violation events. Attributes carry only the
 * bounded fields from csp-report.ts — directive, disposition, and the
 * `oversized` flag for rejected payloads. Origins are intentionally not
 * attributed per-value; the event shape is fixed so no URL content, path,
 * query, or sample text can reach telemetry through this path.
 */

import type { CspViolationEvent } from "@/lib/observability/csp-report";

type Counter = { add: (v: number, attrs?: Record<string, string | number>) => void };

let violationCounter: Counter | null = null;
let metricsInitAttempted = false;

function getViolationCounter(): Counter | null {
  if (metricsInitAttempted) return violationCounter;
  metricsInitAttempted = true;

  try {
    // Lazy require — same pattern as engine/metrics.ts and workflow-metrics.ts.
    const api: typeof import("@opentelemetry/api") = eval("require")("@opentelemetry/api");
    const meter = api.metrics.getMeter("secondary-condition-finder-csp");
    violationCounter = meter.createCounter("csp.violation", {
      description:
        "Redacted CSP / Trusted-Types violation reports received from browsers.",
    });
  } catch {
    violationCounter = null;
  }

  return violationCounter;
}

interface CspViolationCounterAttributes extends CspViolationEvent {
  oversized?: boolean;
}

/** Records one redacted CSP violation event. Never throws. */
export function recordCspViolation(event: CspViolationCounterAttributes): void {
  const counter = getViolationCounter();
  if (!counter) return;
  try {
    counter.add(1, {
      directive: event.effectiveDirective,
      disposition: event.disposition,
      ...(event.oversized ? { oversized: "true" } : {}),
    });
  } catch {
    // Observability is best-effort; never fail request handling on metrics.
  }
}
