/**
 * Engine-phase performance metrics.
 *
 * Records per-phase latency (consensus ranking, signal extraction, pathway
 * building, result assembly) via OTEL Histograms and a total-cycle counter.
 * All recording is best-effort — no-op when OTEL is absent (tests, local dev)
 * and never throws.
 *
 * Debug logging is emitted when `NODE_ENV !== "production"` so local dev can
 * diagnose slow recommendation requests without a collector.
 */

const isDebug =
  typeof process !== "undefined" &&
  process.env.NODE_ENV !== "production" &&
  process.env.NODE_ENV !== "test" &&
  process.env.VITEST !== "true";

type Metric = { record: (v: number, attrs?: Record<string, string | number>) => void };
type Counter = { add: (v: number, attrs?: Record<string, string | number>) => void };

let histograms: {
  consensusDuration?: Metric;
  signalsDuration?: Metric;
  pathwaysDuration?: Metric;
  resultDuration?: Metric;
  totalDuration?: Metric;
} | null = null;

let counters: {
  totalCycles?: Counter;
  recommendationsTotal?: Counter;
} | null = null;

let metricsInitAttempted = false;

function getMetrics(): { histograms: typeof histograms; counters: typeof counters } {
  if (metricsInitAttempted) return { histograms, counters };
  metricsInitAttempted = true;

  try {
    // Lazy require — same pattern as logger.ts. `eval` avoids Next.js static
    // analysis treating this as a hard dependency.
    const api: typeof import("@opentelemetry/api") = eval("require")("@opentelemetry/api");
    const meter = api.metrics.getMeter("secondary-condition-finder-engine");

    histograms = {
      consensusDuration: meter.createHistogram("engine.consensus.duration.ms", {
        description: "Consensus ranking phase duration",
        unit: "ms",
      }),
      signalsDuration: meter.createHistogram("engine.signals.duration.ms", {
        description: "Signal extraction phase duration (alternative etiology + chronology + intake context)",
        unit: "ms",
      }),
      pathwaysDuration: meter.createHistogram("engine.pathways.duration.ms", {
        description: "Intermediate pathway discovery phase duration",
        unit: "ms",
      }),
      resultDuration: meter.createHistogram("engine.result.duration.ms", {
        description: "Result assembly, sorting, and Focus Engine filtering duration",
        unit: "ms",
      }),
      totalDuration: meter.createHistogram("engine.total.duration.ms", {
        description: "End-to-end recommendation engine duration (all phases)",
        unit: "ms",
      }),
    };

    counters = {
      totalCycles: meter.createCounter("engine.cycles.total", {
        description: "Total recommendation engine invocations",
      }),
      recommendationsTotal: meter.createCounter("engine.recommendations.total", {
        description: "Total recommendations produced across all invocations",
      }),
    };
  } catch {
    // OTEL not available — metrics silently become no-ops.
  }

  return { histograms, counters };
}

/** Record a phase histogram (best-effort, never throws). */
function recordPhase(
  histogram: Metric | undefined,
  durationMs: number,
  attributes?: Record<string, string | number>,
): void {
  try {
    histogram?.record(durationMs, attributes);
  } catch {
    // best-effort
  }
}

/** Record a counter increment (best-effort, never throws). */
function recordCounter(
  counter: Counter | undefined,
  value: number,
  attributes?: Record<string, string | number>,
): void {
  try {
    counter?.add(value, attributes);
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// Public recording functions — one per engine phase.
// ---------------------------------------------------------------------------

export interface PhaseTimings {
  consensusMs: number;
  signalsMs: number;
  pathwaysMs: number;
  resultMs: number;
  totalMs: number;
}

/** Record all phase timings after a complete engine cycle. */
export function recordEnginePhaseTimings(timings: PhaseTimings, attributes: Record<string, string | number> = {}): void {
  const { histograms: h } = getMetrics();
  recordPhase(h?.consensusDuration, timings.consensusMs, attributes);
  recordPhase(h?.signalsDuration, timings.signalsMs, attributes);
  recordPhase(h?.pathwaysDuration, timings.pathwaysMs, attributes);
  recordPhase(h?.resultDuration, timings.resultMs, attributes);
  recordPhase(h?.totalDuration, timings.totalMs, attributes);
}

/** Record total engine cycles and total recommendations produced. */
export function recordEngineCycleAttributes(
  primaryCount: number,
  recommendationCount: number,
  attributes: Record<string, string | number> = {},
): void {
  const { counters: c } = getMetrics();
  recordCounter(c?.totalCycles, 1, attributes);
  recordCounter(c?.recommendationsTotal, recommendationCount, attributes);
}

/** Debug-emit phase timings when not in production. */
export function debugLogPhaseTimings(timings: PhaseTimings, meta: Record<string, string | number>): void {
  if (!isDebug) return;
  try {
    console.debug(
      JSON.stringify({
        level: "debug",
        component: "recommendation-engine-phases",
        message: "phase timings",
        ...timings,
        ...meta,
      }),
    );
  } catch {
    // debug logging is best-effort
  }
}
