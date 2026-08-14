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

  it("gates the complete public production route matrix on HTTP 200", () => {
    const workflow = read(workflowPath);

    expect(workflow).toContain("Gate production route matrix");
    expect(workflow).toContain("probe_status() {");
    for (const route of [
      "/",
      "/about",
      "/secondary",
      "/secondary/condition-caused-by",
      "/secondary/condition-aggravation",
      "/secondary/legal",
      "/secondary/diagnosed",
      "/secondary/service-connected",
      "/secondary/ratings",
      "/secondary/upload",
      "/secondary/suggestions",
      "/secondary/evidence",
      "/presumptive",
      "/presumptive/results",
      "/scenarios",
      "/va-forms",
      "/va-forms/finder",
      "/va-reference",
      "/va-reference/service-branches",
      "/privacy",
      "/terms",
    ]) {
      expect(workflow).toContain(`"${route}"`);
    }
    expect(workflow).toContain('--output /dev/null');
    expect(workflow).toContain('if [ "$status" != "200" ]');
    expect(workflow).toContain("Production route gate failed");
    expect(workflow).toContain('echo "failure_count=${#failures[@]}"');
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

  it("classifies failure without exposing response bodies", () => {
    const workflow = read(workflowPath);

    expect(workflow).toContain('outcome="network_error"');
    expect(workflow).toContain('outcome="http_error"');
    expect(workflow).toContain('outcome="payload_not_ready"');
    expect(workflow).toContain('outcome="unexpected_payload"');
    expect(workflow).toContain("Record failed runtime evidence");
    expect(workflow).toContain("Route matrix failures:");
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

  it("transitions issue 213 to completed only after routes and readiness succeed", () => {
    const workflow = read(workflowPath);

    expect(workflow).toContain("if: steps.readiness.outputs.ready == 'true'");
    expect(workflow).toContain('Route matrix: \\`${{ steps.routes.outputs.route_count }} routes, ${{ steps.routes.outputs.failure_count }} failures\\`');
    expect(workflow).toContain('gh issue comment "$RUNTIME_READINESS_ISSUE" --repo "$GITHUB_REPOSITORY"');
    expect(workflow).toContain('gh issue close "$RUNTIME_READINESS_ISSUE" --repo "$GITHUB_REPOSITORY" --reason completed');
    expect(workflow).toContain("No secret value, secret length, hash, derived key material");
  });
});
