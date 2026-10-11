import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// R-03 (VA Lighthouse readiness report §5.3, gap M-05): scheduled dependency
// re-audit, dependency-review on PRs, and SAST. `ci.yml`'s `audit:high` gate
// only runs on push/PR — an advisory published after the last merge would not
// surface until the next unrelated change — and there was no manifest-diff
// visibility for reviewers and no SAST at all. These three workflows close
// that without introducing a second enforcement semantics beside `audit:high`
// (the report explicitly forbids duplicating the gate). Source-scan assertions,
// like the repo's other workflow-wiring tests: no YAML parser dependency is
// present, and string matching on a workflow is exactly what a wiring mistake
// looks like.

const SCHEDULED_AUDIT = ".github/workflows/dependency-scheduled-audit.yml";
const DEPENDENCY_REVIEW = ".github/workflows/dependency-review.yml";
const CODEQL = ".github/workflows/codeql-sast.yml";
const CI = ".github/workflows/ci.yml";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function triggersBlock(source: string): string {
  // The `on:` block runs from `on:` to the first top-level `permissions:` or
  // `jobs:` line.
  const start = source.search(/^on:\s*$/m);
  expect(start, "workflow is missing its on: block").toBeGreaterThanOrEqual(0);
  const rest = source.slice(start);
  const end = rest.search(/^(permissions|jobs):\s*$/m);
  return end === -1 ? rest : rest.slice(0, end);
}

function ensureTopLevelBlocks(source: string): void {
  // Both permissions and jobs exist and are top-level (no leading spaces).
  expect(source).toMatch(/^permissions:\s*$/m);
  expect(source).toMatch(/^jobs:\s*$/m);
}

describe("R-03.1 — scheduled dependency re-audit", () => {
  const source = read(SCHEDULED_AUDIT);
  const on = triggersBlock(source);
  ensureTopLevelBlocks(source);

  it("runs on a weekly schedule and on demand, and never on push or PR", () => {
    expect(on).toContain("schedule:");
    expect(on).toMatch(/cron:\s*"17 6 \* \* 1"/);
    expect(on).toContain("workflow_dispatch:");
    expect(on).not.toMatch(/^\s{2}(push|pull_request):\s*$/m);
  });

  it("re-runs the same enforced audit script ci.yml gates with, not a duplicate gate", () => {
    expect(source).toContain("npm run audit:high");
    expect(read("package.json")).toMatch(/"audit:high":/);
    expect(source).not.toContain("audit-level=high");
  });

  it("records a failure durably by reusing or opening one tracking issue", () => {
    expect(source).toContain("if: steps.audit.outcome == 'failure'");
    expect(source).toContain("gh issue create");
    expect(source).toContain("gh issue list --state open --search");
    expect(source).toContain("--reason completed");
  });

  it("closes the tracking issue when a scheduled run is green again", () => {
    expect(source).toContain("if: steps.audit.outcome == 'success'");
    expect(source).toContain("Close resolved audit tracking issue");
  });

  it("scopes every issue mutation to this repository and reads the default token", () => {
    expect(source).toMatch(/gh issue (?:list|create|close)/);
    expect(source).toContain('--repo "$GITHUB_REPOSITORY"');
    expect(source).toContain("GH_TOKEN: ${{ github.token }}");
  });

  it("never writes advisory details into the issue body or uploads artifacts", () => {
    expect(source).not.toContain("upload-artifact");
    expect(source).toContain("nothing from the audit output is pasted into this issue body");
  });

  it("declares the narrow permissions it uses (read + issues write only)", () => {
    expect(on).not.toContain("pull-requests: write");
    const permissions = source.slice(source.indexOf("permissions:"), source.indexOf("jobs:"));
    expect(permissions).toContain("contents: read");
    expect(permissions).toContain("issues: write");
    expect(permissions).not.toContain("write\n  contents");
    expect(permissions).not.toContain("pull-requests");
  });
});

describe("R-03.2 — dependency review on pull requests", () => {
  const source = read(DEPENDENCY_REVIEW);
  const on = triggersBlock(source);
  ensureTopLevelBlocks(source);

  it("runs only on pull requests", () => {
    expect(on).toContain("pull_request:");
    expect(on).not.toMatch(/^\s{2}(push|schedule):/m);
  });

  it("uses actions/dependency-review-action pinned to an immutable commit", () => {
    expect(source).toMatch(/uses: actions\/dependency-review-action@[0-9a-f]{40} # v4/);
    expect(source).not.toMatch(/uses: actions\/dependency-review-action@v\d/);
  });

  it("fails high-severity PRs with a known fix but leaves the overall advisory gate to ci.yml", () => {
    expect(source).toContain("fail-on-severity: high");
    expect(read(CI)).toContain("npm run audit:high 2>&1 | tee ci-audit.log");
  });
});

describe("R-03.3 — CodeQL SAST for JavaScript/TypeScript", () => {
  const source = read(CODEQL);
  const on = triggersBlock(source);
  ensureTopLevelBlocks(source);

  it("runs on src/scripts PR paths, on a schedule, and on demand", () => {
    expect(on).toContain("workflow_dispatch:");
    expect(on).toMatch(/cron:\s*"33 3 \* \* 3"/);
    expect(source).toMatch(/paths:\n\s+- "src\/\*\*"\n\s+- "scripts\/\*\*"/);
  });

  it("scans the application language with the security-extended suite", () => {
    expect(source).toContain("languages: javascript-typescript");
    expect(source).toContain("queries: security-extended");
    expect(source).toContain("security-events: write");
  });

  it("pins both CodeQL steps to immutable commits from the v3 line", () => {
    expect(source.match(/github\/codeql-action\/init@[0-9a-f]{40}/g)?.length).toBe(1);
    expect(source.match(/github\/codeql-action\/analyze@[0-9a-f]{40}/g)?.length).toBe(1);
    expect(source).not.toMatch(/codeql-action@v\d/);
  });

  it("is scoped to code, not generated datasets or scratch directories", () => {
    expect(source).not.toContain('"data/**"');
    expect(source).not.toContain('"tmp/**"');
  });

  it("does not mutate issues or PR comments (code scanning is the surface)", () => {
    expect(source).not.toContain("issues: write");
    expect(source).not.toContain("pull-requests: write");
  });
});

describe("R-03 — no duplicated enforcement beside the existing audit gate", () => {
  it("does not weaken or duplicate ci.yml's audit:high enforcement", () => {
    const ci = read(CI);
    expect(ci).toContain("npm run audit:high 2>&1 | tee ci-audit.log");
    // The aggregator re-fails ci.yml on the recorded step outcome.
    expect(ci).toMatch(/\$\{\{ steps\.audit\.outcome \}\}"? = "failure"/);
    // The scheduled workflow adds coverage in TIME (post-merge advisories),
    // not a parallel merge-blocking vote.
    expect(read(SCHEDULED_AUDIT)).not.toMatch(/^\s{2}pull_request:/m);
  });
});
