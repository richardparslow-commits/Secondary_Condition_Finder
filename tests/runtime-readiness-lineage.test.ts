import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("production runtime readiness lineage", () => {
  it("only verifies commits from successful main CI runs", () => {
    const workflow = read(".github/workflows/production-runtime-readiness.yml");

    expect(workflow).toContain("workflow_run:");
    expect(workflow).not.toContain("workflow_dispatch:");
    expect(workflow).not.toContain("deployed_commit");
    expect(workflow).not.toContain("DISPATCH_SHA");
    expect(workflow).toContain(
      "github.event.workflow_run.conclusion == 'success'",
    );
    expect(workflow).toContain(
      "github.event.workflow_run.head_branch == 'main'",
    );
    expect(workflow).toContain(
      "WORKFLOW_RUN_SHA: ${{ github.event.workflow_run.head_sha }}",
    );
    expect(workflow).toContain('commit_sha="$WORKFLOW_RUN_SHA"');
    expect(workflow).not.toContain('commit_sha="${DISPATCH_SHA:-$GITHUB_SHA}"');
  });
});
