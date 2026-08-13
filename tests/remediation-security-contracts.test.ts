import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  MAX_WORKFLOW_COOKIE_VALUE_BYTES,
  sealWorkflowState,
} from "@/lib/secondary-workflow/session";

const TEST_SECRET = "test-remediation-workflow-secret-at-least-32-characters";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("security remediation contracts", () => {
  it("keeps the privileged Qwen issue automation disabled", () => {
    const workflow = read(".github/workflows/qwen-agent.yml");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toContain("issue_comment:");
    expect(workflow).not.toContain("issues:\n    types:");
    expect(workflow).not.toContain("QWEN_API_KEY");
    expect(workflow).not.toContain("QwenLM/qwen-code-action");
    expect(workflow).not.toContain("contents: write");
  });

  it("keeps broad CI failure issue auto-closure disabled", () => {
    const workflow = read(".github/workflows/ci-close-issues.yml");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toContain("workflow_run:");
    expect(workflow).not.toContain("issues: write");
    expect(workflow).not.toContain("gh issue close");
  });

  it("accepts ordinary encrypted workflow state within the cookie budget", () => {
    const sealed = sealWorkflowState(
      {
        diagnosedConditionIds: ["condition-a", "condition-b"],
        serviceConnectedConditionIds: ["condition-a"],
        ratingsByConditionId: { "condition-a": 50 },
        documentsShared: false,
        medications: ["medication-a", "medication-b"],
        treatments: ["treatment-a"],
      },
      TEST_SECRET,
    );

    expect(Buffer.byteLength(sealed, "utf8")).toBeLessThanOrEqual(
      MAX_WORKFLOW_COOKIE_VALUE_BYTES,
    );
  });

  it("rejects oversized encrypted workflow state before a browser cookie write", () => {
    const diagnosedConditionIds = Array.from(
      { length: 160 },
      (_, index) => `condition-${index}-${"x".repeat(24)}`,
    );

    expect(() =>
      sealWorkflowState(
        {
          diagnosedConditionIds,
          serviceConnectedConditionIds: diagnosedConditionIds.slice(0, 80),
          ratingsByConditionId: Object.fromEntries(
            diagnosedConditionIds
              .slice(0, 80)
              .map((id) => [id, 50]),
          ),
          documentsShared: true,
        },
        TEST_SECRET,
      ),
    ).toThrow(/safe cookie value budget/i);
  });
});
