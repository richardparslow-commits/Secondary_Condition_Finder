import { beforeEach, describe, expect, it } from "vitest";

import {
  initializeAppInsights,
  resetAppInsightsForTests,
  sanitizeTelemetryUrl,
} from "@/lib/appInsights";

describe("app insights server safety", () => {
  beforeEach(() => {
    resetAppInsightsForTests();
  });

  it("does not instantiate browser sdk during server-side execution", async () => {
    await expect(initializeAppInsights()).resolves.toBeUndefined();
  });

  it("does nothing when connection string is missing", async () => {
    const original = process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING;
    delete process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING;

    try {
      await expect(initializeAppInsights()).resolves.toBeUndefined();
    } finally {
      if (original === undefined) {
        delete process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING;
      } else {
        process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING = original;
      }
    }
  });

  it("strips query strings and fragments from telemetry urls", () => {
    expect(
      sanitizeTelemetryUrl(
        "https://example.test/secondary/ratings?diagnosed=ptsd&rating-ptsd=100#step",
      ),
    ).toBe("https://example.test/secondary/ratings");
  });
});
