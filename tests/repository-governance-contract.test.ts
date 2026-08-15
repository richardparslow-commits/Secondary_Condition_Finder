import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("repository governance contract", () => {
  it("keeps the post-merge provenance check and active-main-rules drift gate in CI", () => {
    const ci = read(".github/workflows/ci.yml");

    expect(ci).toContain("Verify main commit came through a merged PR");
    expect(ci).toContain("Verify active main governance rules");
    expect(ci).toContain("/rules/branches/main");
    expect(ci).toContain('"pull_request"');
    expect(ci).toContain('"required_status_checks"');
    expect(ci).toContain('"non_fast_forward"');
    expect(ci).toContain('"deletion"');
    expect(ci).toContain('check?.context === "verify"');
    expect(ci).toContain("steps.branch_rules.outcome");
  });

  it("documents that repository settings are the preventive control", () => {
    const governance = read("docs/repository-governance.md");

    expect(governance).toContain("active branch ruleset");
    expect(governance).toContain("Require a pull request before merging");
    expect(governance).toContain("`verify`");
    expect(governance).toContain("Block force pushes");
    expect(governance).toContain("Block deletion");
    expect(governance).toContain("does not replace the GitHub ruleset");
  });
});
