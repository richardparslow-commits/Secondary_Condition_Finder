import { describe, expect, it } from "vitest";

import { appInsights } from "@/lib/appInsights";

describe("app insights server safety", () => {
  it("does not instantiate browser sdk during server-side execution", () => {
    expect(appInsights).toBeNull();
  });
});
