import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import {
  recommendForTraceSafely,
  recommendWithTracing,
  sanitizeRecommendationTraceInputs,
  sanitizeRecommendationTraceOutputs,
} from "@/lib/engine/recommend-tracing";
import { intakeSchema } from "@/lib/engine/types";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { createClientErrorEvent } from "@/lib/observability/client-error-event";

describe("client error events", () => {
  it("emits bounded metadata without exception content", () => {
    const sentinel = "SYNTHETIC-PHI-ERROR-42";
    const error = Object.assign(new Error(sentinel), {
      digest: sentinel,
      cause: new Error(sentinel),
    });
    error.stack = sentinel;

    const event = createClientErrorEvent("secondary-error-boundary", error);
    const serialized = JSON.stringify(event);

    expect(event).toMatchObject({
      level: "error",
      component: "secondary-error-boundary",
      message: "Application error; diagnostic details withheld.",
    });
    expect(serialized).not.toContain(sentinel);
    expect(Object.keys(event).sort()).toEqual([
      "component",
      "level",
      "message",
      "timestamp",
    ]);
  });

  it("does not read exception properties while creating the event", () => {
    const exception = Object.defineProperties({}, {
      message: { get: () => { throw new Error("message read"); } },
      stack: { get: () => { throw new Error("stack read"); } },
      cause: { get: () => { throw new Error("cause read"); } },
      digest: { get: () => { throw new Error("digest read"); } },
    });

    expect(() => createClientErrorEvent("root-error-boundary", exception)).not.toThrow();
  });

  it("replaces thrown recommendation errors at both LangSmith-facing helpers", async () => {
    const sentinel = "SYNTHETIC-PHI-TRACE-ERROR-84";
    const catalog = loadConditionCatalog();
    const kb = loadKnowledgeBase();
    const intake = intakeSchema.parse({ primaryConditions: ["not-a-catalog-condition"] });
    const brokenKb = new Proxy(kb, {
      get() { throw new Error(sentinel); },
    });

    await expect(recommendForTraceSafely(catalog, brokenKb, intake)).rejects.toThrow(
      "Recommendation execution failed; diagnostic details withheld.",
    );
    await expect(recommendForTraceSafely(catalog, brokenKb, intake)).rejects.not.toThrow(sentinel);
    await expect(recommendWithTracing(catalog, brokenKb, intake)).rejects.toThrow(
      "Recommendation execution failed; diagnostic details withheld.",
    );
    await expect(recommendWithTracing(catalog, brokenKb, intake)).rejects.not.toThrow(sentinel);
  });

  it("keeps successful LangSmith trace payloads to counts and never a sentinel value", () => {
    const sentinel = "SYNTHETIC-PHI-TRACE-SUCCESS-63";
    const inputs = sanitizeRecommendationTraceInputs({
      args: [null, null, {
        diagnosedConditionIds: [sentinel],
        primaryConditions: [sentinel],
        conditionTimeline: { [sentinel]: { onsetYear: 2001 } },
      }],
    });
    const outputs = sanitizeRecommendationTraceOutputs({
      recommendations: [{ conditionId: sentinel }],
      recognizedPrimaries: [sentinel],
      unmappedPrimaries: [sentinel],
    });

    expect(inputs).toEqual({
      diagnosedConditionIds: 1,
      primaryConditions: 1,
      hasTimeline: true,
      engineVersion: "phase-2-crg",
    });
    expect(outputs).toEqual({
      recommendationCount: 1,
      recognizedPrimaries: 1,
      unmappedPrimaries: 1,
    });
    expect(JSON.stringify({ inputs, outputs })).not.toContain(sentinel);
  });

  it("reduces malformed count fields to zero rather than throwing or serializing values", () => {
    const sentinel = "SYNTHETIC-PHI-TRACE-MALFORMED-COUNT-71";
    const inputs = sanitizeRecommendationTraceInputs({
      args: [null, null, {
        diagnosedConditionIds: sentinel,
        primaryConditions: sentinel,
        conditionTimeline: {},
      }],
    });
    const outputs = sanitizeRecommendationTraceOutputs({
      recommendations: sentinel,
      recognizedPrimaries: sentinel,
      unmappedPrimaries: sentinel,
    });
    expect(inputs).toEqual({
      diagnosedConditionIds: 0,
      primaryConditions: 0,
      hasTimeline: false,
      engineVersion: "phase-2-crg",
    });
    expect(outputs).toEqual({
      recommendationCount: 0,
      recognizedPrimaries: 0,
      unmappedPrimaries: 0,
    });
    expect(JSON.stringify({ inputs, outputs })).not.toContain(sentinel);
  });

  it("returns fixed safe fallbacks if LangSmith input/output sanitizers encounter malformed data", () => {
    const sentinel = "SYNTHETIC-PHI-TRACE-PROCESSOR-31";
    const poisonous = new Proxy({}, {
      get() { throw new Error(sentinel); },
    });
    expect(sanitizeRecommendationTraceInputs(poisonous)).toEqual({ input: "unavailable" });
    expect(sanitizeRecommendationTraceOutputs(poisonous)).toEqual({ output: "unavailable" });
  });
});
