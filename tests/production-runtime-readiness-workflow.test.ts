import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("production runtime readiness workflow", () => {
  const workflowPath = ".github/workflows/production-runtime-readiness.yml";

  it("runs only after successful Azure deployments of main", () => {
    const workflow = read(workflowPath);

    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain("Azure Static Web Apps CI/CD");
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain("github.event.workflow_run.head_branch == 'main'");
  });

  it("checks only the non-sensitive runtime readiness response", () => {
    const workflow = read(workflowPath);

    expect(workflow).toContain("/api/runtime-readiness");
    expect(workflow).toContain(".status == \"ready\"");
    expect(workflow).toContain(".checks.workflowSessionCrypto == true");
    expect(workflow).not.toContain("WORKFLOW_SESSION_SECRET");
    expect(workflow).not.toContain("SECONDARY_WORKFLOW_SESSION_SECRET");
    expect(workflow).not.toContain("upload-artifact");
    expect(workflow).not.toContain("cat \"$body_file\"");
  });

  it("closes issue 213 only after a successful readiness result", () => {
    const workflow = read(workflowPath);

    expect(workflow).toContain("if: steps.readiness.outputs.ready == 'true'");
    expect(workflow).toContain('gh issue comment "$RUNTIME_READINESS_ISSUE"');
    expect(workflow).toContain('gh issue close "$RUNTIME_READINESS_ISSUE" --reason completed');
    expect(workflow).toContain("No secret value, secret length, hash, derived key material");
  });
});
