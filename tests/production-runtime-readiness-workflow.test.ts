import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("production runtime readiness workflow", () => {
  const workflowPath = ".github/workflows/production-runtime-readiness.yml";

  it("runs only after successful CI on main", () => {
    const workflow = read(workflowPath);

    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain("workflows:\n      - CI");
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(workflow).not.toContain("Azure Static Web Apps CI/CD");
  });

  it("records a status-only host capability matrix", () => {
    const workflow = read(workflowPath);

    expect(workflow).toContain("Probe production route matrix");
    expect(workflow).toContain("probe_status() {");
    expect(workflow).toContain("probe_status '/'");
    expect(workflow).toContain("probe_status '/about'");
    expect(workflow).toContain("probe_status '/va-forms'");
    expect(workflow).toContain("--output /dev/null");
    expect(workflow).toContain("Route matrix:");
  });

  it("checks only the non-sensitive dynamic-page readiness marker", () => {
    const workflow = read(workflowPath);

    expect(workflow).toContain("$PRODUCTION_BASE_URL/runtime-readiness");
    expect(workflow).not.toContain("$PRODUCTION_BASE_URL/api/runtime-readiness");
    expect(workflow).toContain("Accept: text/html");
    expect(workflow).toContain('data-runtime-readiness="ready"');
    expect(workflow).toContain('data-runtime-readiness="not_ready"');
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
    expect(workflow).toContain('outcome="unexpected_payload"');
    expect(workflow).toContain("Record failed runtime evidence");
    expect(workflow).toContain("Readiness request outcome:");
    expect(workflow).toContain("Readiness HTTP status:");
    expect(workflow).toContain(
      "Temporary response bodies are deleted and are not printed or attached",
    );
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
