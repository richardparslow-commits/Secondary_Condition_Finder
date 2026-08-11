import { describe, expect, it, vi } from "vitest";

import { createMemoryLogger } from "@/lib/log/memory";
import type { RecommendationEvent } from "@/lib/log/types";

function event(overrides: Partial<RecommendationEvent> = {}): RecommendationEvent {
  return {
    id: "evt_1",
    createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    recognizedPrimaryCount: 1,
    unrecognizedPrimaryCount: 0,
    recommendedConditionCount: 1,
    engineVersion: "phase-1",
    ...overrides,
  };
}

describe("memory event logger", () => {
  it("records events and returns the most recent first", () => {
    const logger = createMemoryLogger({ silent: true });
    logger.record(event({ id: "evt_1" }));
    logger.record(event({ id: "evt_2" }));

    expect(logger.recent(10).map((e) => e.id)).toEqual(["evt_2", "evt_1"]);
  });

  it("respects the requested limit", () => {
    const logger = createMemoryLogger({ silent: true });
    logger.record(event({ id: "a" }));
    logger.record(event({ id: "b" }));
    logger.record(event({ id: "c" }));

    expect(logger.recent(2)).toHaveLength(2);
  });

  it("emits only aggregate recommendation metrics to stdout by default", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = createMemoryLogger();
    const sample = event({ id: "evt_default" });

    logger.record(sample);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      JSON.stringify({ type: "recommendation", ...sample }),
    );
    const emitted = String(spy.mock.calls[0][0]);
    expect(emitted).not.toContain("PTSD");
    expect(emitted).not.toContain("sleep-apnea");
    expect(emitted).not.toContain("recognizedPrimaries");
    expect(emitted).not.toContain("recommendedConditions");
    spy.mockRestore();
  });

  it("does not emit stdout lines when silent mode is enabled", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = createMemoryLogger({ silent: true });

    logger.record(event({ id: "evt_silent" }));

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
