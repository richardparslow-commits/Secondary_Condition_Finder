import { describe, expect, it } from "vitest";

import { createMemoryLogger } from "@/lib/log/memory";
import type { RecommendationEvent } from "@/lib/log/types";

function event(overrides: Partial<RecommendationEvent> = {}): RecommendationEvent {
  return {
    id: "evt_1",
    createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    recognizedPrimaries: ["PTSD"],
    unrecognizedPrimaryCount: 0,
    recommendedConditions: ["Sleep apnea"],
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
});
