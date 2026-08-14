import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/va-sandbox-smoke.yml"),
  "utf8",
);
const runbook = readFileSync(
  resolve(process.cwd(), "docs/va-sandbox-smoke-test.md"),
  "utf8",
);

describe("VA sandbox smoke workflow", () => {
  it("is manual-only and declares separate API key variables", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s*push:/m);
    expect(workflow).not.toMatch(/^\s*pull_request:/m);
    expect(workflow).toContain("VA_FORMS_SANDBOX_API_KEY");
    expect(workflow).toContain("VA_BENEFITS_REFERENCE_SANDBOX_API_KEY");
    expect(workflow).not.toContain("NEXT_PUBLIC_VA_FORMS_SANDBOX_API_KEY");
    expect(workflow).not.toContain(
      "NEXT_PUBLIC_VA_BENEFITS_REFERENCE_SANDBOX_API_KEY",
    );
  });

  it("enforces sandbox mode", () => {
    expect(workflow).toContain("VA_SANDBOX_ENABLED: 'true'");
    expect(workflow).toContain(
      "VA sandbox smoke test must run with VA_SANDBOX_ENABLED=true.",
    );
  });

  it("exercises only the two approved low-sensitivity sandbox endpoints", () => {
    expect(workflow).toContain(
      "https://sandbox-api.va.gov/services/va_forms/v0/forms?query=21-526EZ",
    );
    expect(workflow).toContain(
      "https://sandbox-api.va.gov/services/benefits-reference-data/v1/disabilities",
    );
    expect(workflow).not.toContain("benefits-claims");
    expect(workflow).not.toContain("Authorization: Bearer");
  });

  it("records sanitized evidence without persisting raw response files", () => {
    expect(workflow).toContain("GITHUB_STEP_SUMMARY");
    expect(workflow).toContain("gh issue comment 189");
    expect(workflow).toContain("gh issue close 189 --reason completed");
    expect(workflow).toContain("API keys were not retained");
    expect(workflow).not.toContain("actions/upload-artifact");
  });

  it("keeps the operator runbook aligned to service-specific credentials", () => {
    expect(runbook).toContain("VA_FORMS_SANDBOX_API_KEY");
    expect(runbook).toContain("VA_BENEFITS_REFERENCE_SANDBOX_API_KEY");
    expect(runbook).toContain("the VA Forms request must use only the Forms key");
    expect(runbook).toContain(
      "the Benefits Reference Data request must use only the Benefits Reference Data key",
    );
    expect(runbook).toContain("workflow ID `332298000` has **zero recorded runs**");
    expect(runbook).not.toContain("`VA_SANDBOX_API_KEY`");
  });
});
