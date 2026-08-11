import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/va-sandbox-smoke.yml"),
  "utf8",
);

describe("VA sandbox smoke workflow", () => {
  it("is manual-only and uses the server-side sandbox secret", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s*push:/m);
    expect(workflow).not.toMatch(/^\s*pull_request:/m);
    expect(workflow).toContain("secrets.VA_SANDBOX_API_KEY");
    expect(workflow).not.toContain("NEXT_PUBLIC_VA_SANDBOX_API_KEY");
  });

  it("exercises only the two approved low-sensitivity sandbox endpoints", () => {
    expect(workflow).toContain(
      "https://sandbox-api.va.gov/services/va_forms/v0/forms?query=21-526EZ",
    );
    expect(workflow).toContain(
      "https://sandbox-api.va.gov/services/benefits-reference-data/v1/disabilities",
    );
    expect(workflow).not.toContain("benefits-claims");
    expect(workflow).not.toContain("health");
    expect(workflow).not.toContain("Authorization: Bearer");
  });

  it("records sanitized evidence without persisting raw response files", () => {
    expect(workflow).toContain("GITHUB_STEP_SUMMARY");
    expect(workflow).toContain("gh issue comment 189");
    expect(workflow).toContain("gh issue close 189 --reason completed");
    expect(workflow).toContain("Raw response payloads and the API key were not retained");
    expect(workflow).not.toContain("actions/upload-artifact");
  });
});
