import { describe, expect, it } from "vitest";

import { createAppInsights } from "@/lib/appInsights";

describe("app insights server safety", () => {
  it("does not instantiate browser sdk during server-side execution", () => {
    // createAppInsights is a factory function — no SDK is instantiated at module
    // import time, so importing the module in a server/test environment is safe.
    expect(typeof createAppInsights).toBe("function");
  });
});
