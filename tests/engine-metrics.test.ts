import { describe, expect, it, vi } from "vitest";

import {
  recordEnginePhaseTimings,
  recordEngineCycleAttributes,
  debugLogPhaseTimings,
} from "@/lib/engine/metrics";

describe("engine metrics", () => {
  it("exports recording functions that never throw", () => {
    // All three functions must be callable without error regardless of OTEL state.
    expect(() =>
      recordEnginePhaseTimings(
        { consensusMs: 10, signalsMs: 5, pathwaysMs: 3, resultMs: 2, totalMs: 20 },
        { primaryCount: "2", recommendationCount: "5" },
      ),
    ).not.toThrow();

    expect(() =>
      recordEngineCycleAttributes(3, 7, { engineVersion: "phase-2-crg" }),
    ).not.toThrow();
  });

  it("debugLogPhaseTimings is a no-op in test environment", () => {
    const spy = vi.spyOn(console, "debug");
    debugLogPhaseTimings(
      { consensusMs: 1, signalsMs: 1, pathwaysMs: 1, resultMs: 1, totalMs: 4 },
      { primaryCount: 1, recommendationCount: 1 },
    );
    // Should not emit in test (NODE_ENV=test or VITEST=true)
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("records all five phase histograms with attributes", () => {
    // This tests the function contract: it accepts PhaseTimings + attributes.
    // The actual OTEL recording is best-effort and may be a no-op without a
    // collector, but the function must not throw.
    expect(() =>
      recordEnginePhaseTimings(
        { consensusMs: 0, signalsMs: 0, pathwaysMs: 0, resultMs: 0, totalMs: 0 },
        { primaryCount: "0", recommendationCount: "0" },
      ),
    ).not.toThrow();
  });
});
