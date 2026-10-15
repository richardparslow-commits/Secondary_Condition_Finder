import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// R-03 (VA Lighthouse readiness report §5.3, gap M-05): scheduled dependency
// re-audit, dependency-review on PRs, and SAST. `ci.yml`'s `audit:high` gate
// only runs on push/PR — an advisory published after the last merge would not
// surface until the next unrelated change — and there was no manifest-diff
// visibility for reviewers and no SAST at all.
//
// Two of the three GitHub-native forms were PLAN-GATED, proven by attempts on
// 2026-10-11: this repository is private and GitHub Advanced Security is not
// purchased — the dependency-review action fails hard and the CodeQL SARIF
// upload fails with "Resource not accessible by integration / Code scanning is
// not enabled" (PATCH security_and_analysis → 422 "Advanced security has not
// been purchased; dependency graph and Dependabot alerts WERE enabled — the
// plan-supported halves). The report anticipated exactly this: §5.3 lists
// "CodeQL … or Semgrep with a TypeScript ruleset" as SAST, and dependency
// review's reviewer-visibility intent does not require the paid action.
// These tests pin the shipped shapes: manifest-diff reviewer visibility and
// Semgrep SAST, plus the constraints that keep `audit:high` the single gate.

const SCHEDULED_AUDIT = ".github/workflows/dependency-scheduled-audit.yml";
const DEPENDENCY_REVIEW = ".github/workflows/dependency-review.yml";
const SAST = ".github/workflows/codeql-sast.yml";
const CI = ".github/workflows/ci.yml";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function triggersBlock(source: string): string {
  const start = source.search(/^on:\s*$/m);
  expect(start, "workflow is missing its on: block").toBeGreaterThanOrEqual(0);
  const rest = source.slice(start + 3);
  const end = rest.search(/^(permissions|jobs):\s*$/m);
  return end === -1 ? rest : rest.slice(0, end);
}

describe("R-03.1 — scheduled dependency re-audit", () => {
  const source = read(SCHEDULED_AUDIT);
  const on = triggersBlock(source);

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
    expect(source).toContain('--repo "$GITHUB_REPOSITORY"');
    expect(source).toContain("GH_TOKEN: ${{ github.token }}");
  });

  it("never writes advisory details into the issue body or uploads artifacts", () => {
    expect(source).not.toContain("upload-artifact");
    expect(source).toContain("nothing from the audit output is pasted into this issue body");
  });
});

describe("R-03.2 — dependency manifest review on pull requests", () => {
  const source = read(DEPENDENCY_REVIEW);
  const on = triggersBlock(source);

  it("runs only on pull requests touching manifests", () => {
    expect(on).toContain("pull_request:");
    expect(source).toMatch(/paths:\n(?:\s+- "(?:package|\.github\/workflows).*\n?)+/);
    expect(on).not.toMatch(/^\s{2}(push|schedule):/m);
  });

  it("produces the reviewer-visible manifest diff the paid action would have", () => {
    expect(source).toMatch(/## Dependency manifest changes/);
    expect(source).toMatch(/git diff "\$\{?base\}?" "\$\{?head_sha\}?" -- package\.json package-lock\.json/);
    // Upserted as an issue comment: diff-anchored review comments cannot be
    // edited after the head SHA changes.
    expect(source).toContain("issues/$PR_NUMBER/comments");
    expect(source).toContain("-X PATCH \"repos/$GITHUB_REPOSITORY/issues/comments/");
  });

  it("does not silently swallow the plan constraint but documents the swap-back", () => {
    // Comments wrap the quoted error across lines, so assert on a fragment.
    expect(source).toMatch(/Advanced security has not been|Advanced Security not purchased/);
    expect(source).toMatch(/actions\/dependency-review-action@[0-9a-f]{40} # v4\.8\.3/);
  });

  it("leaves the advisory gate to ci.yml's audit:high (single source of truth)", () => {
    expect(source).toContain("stays the single source of truth");
    expect(source).not.toContain("fail-on-severity");
  });

  it("never uploads artifacts or writes outside its PR comment", () => {
    expect(source).not.toContain("upload-artifact");
    expect(source).toMatch(/permissions:\n  contents: read\n  pull-requests: write/);
  });
});

describe("R-03.3 — SAST via Semgrep (the report's listed alternative)", () => {
  const source = read(SAST);
  const on = triggersBlock(source);

  it("runs on src/scripts PR paths, on a schedule, and on demand", () => {
    expect(on).toContain("workflow_dispatch:");
    expect(on).toMatch(/cron:\s*"33 3 \* \* 3"/);
    expect(source).toMatch(/paths:\n\s+- "src\/\*\*"\n\s+- "scripts\/\*\*"/);
  });

  it("scans the application source with the TypeScript ruleset and gates on ERROR", () => {
    expect(source).toContain("p/typescript");
    expect(source).toContain("--severity ERROR");
    expect(source).toContain("--error");
  });

  it("excludes generated datasets and scratch trees from the scan", () => {
    expect(source).toContain("--exclude 'tmp/'");
    expect(source).toContain("--exclude 'data/'");
  });

  it("does not depend on GitHub Advanced Security (no code-scanning SARIF upload)", () => {
    expect(source).not.toContain("github/codeql-action");
    expect(source).not.toContain("security-events: write");
    expect(source).toMatch(/Advanced Security has not been|not been\s+\n# purchased/);
    expect(source).toMatch(/Semgrep with a TypeScript ruleset/);
  });

  /**
   * Two claims this workflow made were false, and this is what replaced them.
   *
   * "WARN/INVENTORY findings are surfaced in the step summary" could not hold:
   * `--severity ERROR` selects only ERROR-severity rules (semgrep CLI reference:
   * "Report findings only from rules matching the supplied severity level"), so
   * no WARNING/INVENTORY finding ever reaches the output. "No source excerpts
   * are echoed into logs or artifacts" also could not hold: semgrep's text
   * formatter prints the matched source lines, and this job was printing them.
   * `--json` moves them into a file nothing prints and nothing uploads, and the
   * sanitized rule/file/line list is what travels onward.
   */
  it("collects only what its command can collect, and says which severity that is", () => {
    expect(source).toContain("--severity ERROR");
    expect(source).toContain("--error");
    // The corrected statement, in the workflow, the summary and the record.
    expect(source).toContain("WARNING/INVENTORY findings are not selected by it");
    expect(source).toContain("--severity ERROR");
    expect(source).not.toMatch(/WARN\/INVENTORY summarized/i);
    // The old live claim is gone; the phrase survives only inside the record of
    // the correction itself.
    expect(source).not.toContain("Findings are printed as sanitised rule/file/line/location text");
    expect(source).toContain("were false and are corrected here");
  });

  it("keeps the matched source lines in a file that is neither printed nor uploaded", () => {
    expect(source).toContain("--json");
    expect(source).toContain("src scripts > semgrep-sast.json");
    // stderr stays on the runner's log: that is where the engine's diagnostics
    // have to be readable when the gate cannot run at all.
    expect(source).not.toContain("2> semgrep-sast.log");
    expect(source).toContain('finding.get("path")');
    expect(source).not.toContain("cat semgrep-sast.json");
    expect(source).not.toContain("upload-artifact");
  });

  it("lets a scheduled failure reach a human through one tracking issue", () => {
    // The repository rule from dependency-scheduled-audit.yml's header: every
    // scheduled workflow must be able to fail visibly without a commit. This
    // was the last one that could not (docs/sast-monitor-handoff-policy-2026-10-14.md).
    expect(source).toContain("issues: write");
    expect(source).toContain("record-sast-outcome:");
    expect(source).toContain("if: always() && github.event_name != 'pull_request'");
    expect(source).toContain("Close");
    expect(source).toContain('"close"');
    expect(source).toContain("--reason");
    expect(source).toContain("completed");
    // The scan job stays read-only; a PR run's own check is its signal.
    const scanJob = source.slice(source.indexOf("jobs:"), source.indexOf("record-sast-outcome:"));
    expect(scanJob).not.toContain("issues: write");
    expect(scanJob).not.toContain("permissions:");
  });

  it("carries the findings to the issue as a job output, not as an artifact", () => {
    expect(source).toContain("finding_detail: ${{ steps.scan.outputs.finding_detail }}");
    expect(source).toContain("FINDING_DETAIL: ${{ needs.semgrep.outputs.finding_detail }}");
    expect(source).not.toContain("download-artifact");
  });

  it("never grants write access it does not need", () => {
    expect(source).not.toContain('pull-requests: write');
    expect(source).not.toContain("security-events: write");
    expect(source).not.toContain("contents: write");
  });
});

describe("R-03 — no duplicated enforcement beside the existing audit gate", () => {
  it("does not weaken or duplicate ci.yml's audit:high enforcement", () => {
    const ci = read(CI);
    expect(ci).toContain("npm run audit:high 2>&1 | tee ci-audit.log");
    expect(ci).toMatch(/\$\{\{ steps\.audit\.outcome \}\}"? = "failure"/);
    // The scheduled workflow adds coverage in TIME (post-merge advisories),
    // not a parallel merge-blocking vote.
    expect(read(SCHEDULED_AUDIT)).not.toMatch(/^\s{2}pull_request:/m);
  });
});
