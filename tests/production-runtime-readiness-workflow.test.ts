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

  it("checks only the non-sensitive runtime readiness response outside the reserved API prefix", () => {
    const workflow = read(workflowPath);

    expect(workflow).toContain("$PRODUCTION_BASE_URL/runtime-readiness");
    expect(workflow).not.toContain("$PRODUCTION_BASE_URL/api/runtime-readiness");
    expect(workflow).toContain(".status == \"ready\"");
    expect(workflow).toContain(".checks.workflowSessionCrypto == true");
    expect(workflow).not.toContain("WORKFLOW_SESSION_SECRET");
    expect(workflow).not.toContain("SECONDARY_WORKFLOW_SESSION_SECRET");
    expect(workflow).not.toContain("upload-artifact");
    expect(workflow).not.toContain("cat \"$body_file\"");
  });

  it("classifies failure without exposing the response body", () => {
    const workflow = read(workflowPath);

    expect(workflow).toContain('outcome="network_error"');
    expect(workflow).toContain('outcome="http_error"');
    expect(workflow).toContain('outcome="payload_not_ready"');
    expect(workflow).toContain("Record failed runtime evidence");
    expect(workflow).toContain("Request outcome:");
    expect(workflow).toContain("HTTP status:");
    expect(workflow).toContain("The response body was not printed or attached");
  });

  it("targets the repository explicitly when recording issue evidence", () => {
    const workflow = read(workflowPath);

    expect(workflow).toContain('--repo "$GITHUB_REPOSITORY"');
    expect(workflow).not.toContain('gh issue comment "$RUNTIME_READINESS_ISSUE" --body-file');
  });

  it("transitions issue 213 to completed only after a successful readiness result", () => {
    const workflow = read(workflowPath);

    expect(workflow).toContain("if: steps.readiness.outputs.ready == 'true'");
    expect(workflow).toContain('gh issue comment "$RUNTIME_READINESS_ISSUE" --repo "$GITHUB_REPOSITORY"');
    expect(workflow).toContain('gh issue close "$RUNTIME_READINESS_ISSUE" --repo "$GITHUB_REPOSITORY" --reason completed');
    expect(workflow).toContain("No secret value, secret length, hash, derived key material");
  });
});
