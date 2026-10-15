import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The scheduled Semgrep SAST run could not report its own failure.
 *
 * Every other scheduled workflow in this repository maintains a tracking issue
 * in both directions — `dependency-scheduled-audit`, `citation-decay-watch`,
 * `runtime-drift-probe`, `va-gov-walkthrough-probe` — because a red run in a
 * private repository's Actions history is not a notification. `codeql-sast.yml`
 * had no hand-off at all: a weekly ERROR-severity finding, or a gate that could
 * not run at all, ended in the run list and nowhere else
 * (docs/sast-monitor-handoff-policy-2026-10-14.md).
 *
 * This suite executes the workflow's own text rather than describing it:
 *  - the scan step runs with a stubbed `semgrep`, for a findings result, a
 *    gate-could-not-run result and a clean result;
 *  - the summary step runs against those outputs;
 *  - the tracking-issue payload runs with a stubbed `gh`, opening, updating and
 *    closing the issue as the outcomes require.
 *
 * Two claims the file used to make are also pinned as corrected: it said
 * WARN/INVENTORY findings were surfaced (semgrep's `--severity ERROR` selects
 * only ERROR-severity rules, so they never were) and that no source excerpts
 * reached the log (semgrep's text formatter prints the matched lines, and it
 * did).
 */

const WORKFLOW = ".github/workflows/codeql-sast.yml";

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const workflow = read(WORKFLOW);

/** Steps are six-space list items under `steps:` (same split as ci-gate-wiring). */
function stepBlocks(source: string): string[] {
  return source.split(/\n(?= {6}- )/).filter((block) => block.includes("name:"));
}

function step(workflowSource: string, name: string): string {
  const block = stepBlocks(workflowSource).find((candidate) => candidate.includes(name));
  expect(block, `workflow step "${name}"`).toBeDefined();
  return block!;
}

/**
 * The shell body of a `run: |` step, ending where YAML ends it: the first line
 * indented less than the block (the next step, or the next job). Dedenting the
 * whole file instead would append the following steps to the script.
 */
function runScript(block: string): string {
  const lines = block.split("\n");
  const start = lines.findIndex((line) => /^\s+run: \|/.test(line));
  expect(start, "step has a `run: |` body").toBeGreaterThan(-1);
  const indent = /^\s*/.exec(lines[start + 1])?.[0].length ?? 0;
  expect(indent, "the `run: |` body is indented").toBeGreaterThan(0);

  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") {
      body.push("");
      continue;
    }
    const leading = /^\s*/.exec(line)![0].length;
    if (leading < indent) break;
    body.push(line.slice(indent));
  }
  return body.join("\n").replace(/\n+$/, "\n");
}

/**
 * The tracking-issue payload, or "" when the workflow has none — which is the
 * pre-fix shape, and must surface as failing assertions rather than as a
 * collection error that hides which invariant broke.
 */
function issuePayload(source: string): string {
  const marker = "--input-type=module - <<'NODE'";
  const start = source.indexOf(marker);
  if (start === -1) return "";
  return source.slice(start + marker.length, source.indexOf("\n          NODE", start));
}

const payload = issuePayload(workflow);

function tempDir(prefix: string): string {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

/** A stub command on its own PATH, so the real workflow text runs unchanged. */
function stub(name: string, script: string): { dir: string; calls: string } {
  const dir = tempDir(`sast-${name}-`);
  const file = path.join(dir, name);
  writeFileSync(file, script);
  chmodSync(file, 0o755);
  return { dir, calls: path.join(dir, "calls.log") };
}

const FINDING_REPORT = {
  results: [
    {
      check_id: "javascript.lang.security.audit.detect-non-literal-fs-filename",
      path: "src/lib/thing.ts",
      start: { line: 42, col: 3 },
      end: { line: 42, col: 20 },
      extra: { severity: "ERROR", lines: "const secret = fs.readFileSync(userPath);" },
    },
    {
      check_id: "javascript.express.security.audit.xss.direct-response-write",
      path: "scripts/report.mjs",
      start: { line: 7, col: 1 },
      end: { line: 7, col: 30 },
      extra: { severity: "ERROR", lines: "res.write(userInput);" },
    },
  ],
  errors: [],
  paths: { scanned: ["src/lib/thing.ts", "scripts/report.mjs"] },
};

/** Runs the workflow's scan step with a stubbed semgrep. */
function runScan(options: { json: string; exit: number }): {
  status: number;
  stdout: string;
  outputs: Record<string, string>;
} {
  const stubScript =
    "#!/usr/bin/env bash\n" +
    (options.json ? `cat <<'JSON'\n${options.json}\nJSON\n` : "") +
    'echo "Scanning 2 files" >&2\n' +
    `exit ${options.exit}\n`;
  const semgrep = stub("semgrep", stubScript);
  const workspace = tempDir("sast-workspace-");
  const script = path.join(workspace, "scan.sh");
  writeFileSync(script, runScript(step(workflow, "Scan src/ and scripts/")));
  const outputFile = path.join(workspace, "github_output");
  writeFileSync(outputFile, "");

  let status = 0;
  let stdout = "";
  try {
    stdout = execFileSync("bash", [script], {
      cwd: workspace,
      env: {
        ...process.env,
        PATH: `${semgrep.dir}:${process.env.PATH}`,
        GITHUB_OUTPUT: outputFile,
        GITHUB_STEP_SUMMARY: path.join(workspace, "summary.md"),
      },
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (error) {
    status = (error as { status?: number }).status ?? 0;
    stdout = String((error as { stdout?: string }).stdout ?? "");
  }

  const raw = readFileSync(outputFile, "utf8");
  const outputs: Record<string, string> = {};
  const detail = /finding_detail<<SEMGREP_SAST_DETAIL_EOF\n([\s\S]*?)\nSEMGREP_SAST_DETAIL_EOF/.exec(raw);
  outputs.finding_detail = detail ? detail[1] : "";
  outputs.semgrep_exit_code = /semgrep_exit_code=(\d+)/.exec(raw)?.[1] ?? "";
  return { status, stdout, outputs };
}

/** Runs the workflow's summary step over the recorded outputs. */
function runSummary(outcome: string, outputs: Record<string, string>): string {
  const workspace = tempDir("sast-summary-");
  const script = path.join(workspace, "summary.sh");
  writeFileSync(script, runScript(step(workflow, "Record the scan outcome")));
  const summary = path.join(workspace, "summary.md");
  writeFileSync(summary, "");
  execFileSync("bash", [script], {
    env: {
      ...process.env,
      SCAN_OUTCOME: outcome,
      SEMGREP_EXIT_CODE: outputs.semgrep_exit_code ?? "",
      FINDING_DETAIL: outputs.finding_detail ?? "",
      GITHUB_STEP_SUMMARY: summary,
    },
    stdio: "pipe",
  });
  return readFileSync(summary, "utf8");
}

/** Runs the tracking-issue payload with a stubbed `gh`. */
/** A stub `gh` that records every call and answers `issue list` from an env var. */
function ghStub(): { dir: string; calls: string } {
  const dir = tempDir("sast-gh-");
  const calls = path.join(dir, "calls.log");
  writeFileSync(calls, "");
  const file = path.join(dir, "gh");
  writeFileSync(
    file,
    "#!/usr/bin/env bash\n" +
      `printf '%s\\n' "$*" >> ${JSON.stringify(calls)}\n` +
      'if [ "$1" = "issue" ] && [ "$2" = "list" ]; then printf \'%s\' "${GH_LIST_RESPONSE:-[]}"; fi\n' +
      "exit 0\n",
  );
  chmodSync(file, 0o755);
  return { dir, calls };
}

function runPayload(env: Record<string, string>): { status: number | undefined; stdout: string; calls: string } {
  const gh = ghStub();
  const dir = tempDir("sast-payload-");
  const script = path.join(dir, "payload.mjs");
  writeFileSync(script, payload);

  let status: number | undefined;
  let stdout = "";
  try {
    stdout = execFileSync(process.execPath, [script], {
      env: {
        ...process.env,
        PATH: `${gh.dir}:${process.env.PATH}`,
        GITHUB_SERVER_URL: "https://github.example",
        GITHUB_REPOSITORY: "owner/repo",
        GITHUB_RUN_ID: "12345",
        GITHUB_SHA: "abc1234",
        GH_TOKEN: "stub",
        SCAN_RESULT: "",
        SEMGREP_EXIT_CODE: "",
        FINDING_DETAIL: "",
        ...env,
      },
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (error) {
    status = (error as { status?: number }).status;
    stdout = String((error as { stdout?: string }).stdout ?? "");
  }
  return { status, stdout, calls: readFileSync(gh.calls, "utf8") };
}

describe("the scan step reports a verdict it can hand off", () => {
  it("turns ERROR findings into a sanitized list, never the matched source", () => {
    const scan = runScan({ json: JSON.stringify(FINDING_REPORT, null, 2), exit: 1 });

    // The gate is semgrep's own exit status, so a findings run fails the step.
    expect(scan.status).toBe(1);
    expect(scan.outputs.semgrep_exit_code).toBe("1");
    expect(scan.outputs.finding_detail).toContain(
      "`javascript.lang.security.audit.detect-non-literal-fs-filename` — `src/lib/thing.ts:42`",
    );
    expect(scan.outputs.finding_detail).toContain("`scripts/report.mjs:7`");

    // The JSON holds the matched lines; nothing here may echo them.
    expect(scan.outputs.finding_detail).not.toContain("readFileSync(userPath)");
    expect(scan.outputs.finding_detail).not.toContain("res.write");
    expect(scan.stdout).not.toContain("check_id");
    expect(scan.stdout).not.toContain("severity");
  });

  it("carries a gate that could not run as its own outcome, not as a finding", () => {
    // A remote ruleset fetch failure leaves no JSON and exits non-zero; the
    // detail must stay empty so the issue body cannot call it findings.
    const scan = runScan({ json: "", exit: 7 });

    expect(scan.status).toBe(7);
    expect(scan.outputs.semgrep_exit_code).toBe("7");
    expect(scan.outputs.finding_detail).toBe("");
  });

  it("carries nothing when the scan is clean", () => {
    const scan = runScan({
      json: JSON.stringify({ results: [], errors: [], paths: { scanned: [] } }),
      exit: 0,
    });

    expect(scan.status).toBe(0);
    expect(scan.outputs.semgrep_exit_code).toBe("0");
    expect(scan.outputs.finding_detail).toBe("");
  });

  it("writes all three outcomes into the run summary", () => {
    const findings = runScan({ json: JSON.stringify(FINDING_REPORT, null, 2), exit: 1 });
    const findingsSummary = runSummary("failure", findings.outputs);
    expect(findingsSummary).toContain("Result: semgrep reported ERROR-severity findings");
    expect(findingsSummary).toContain("`src/lib/thing.ts:42`");
    expect(findingsSummary).not.toContain("readFileSync(userPath)");

    const broken = runScan({ json: "", exit: 7 });
    const brokenSummary = runSummary("failure", broken.outputs);
    expect(brokenSummary).toContain("the scan did not complete and carried no finding detail (exit 7)");
    expect(brokenSummary).toContain("this run says nothing about the code either way");

    const clean = runScan({ json: JSON.stringify({ results: [] }), exit: 0 });
    expect(runSummary("success", clean.outputs)).toContain(
      "the scan completed with 0 ERROR-severity findings",
    );

    // The summary must not promise findings it never collects.
    expect(findingsSummary).toContain("WARNING/INVENTORY findings are not selected by it");
  });
});

describe("the tracking-issue payload reports what actually happened", () => {
  it("opens one issue with the sanitized findings when the scan reported them", () => {
    const run = runPayload({
      SCAN_RESULT: "failure",
      SEMGREP_EXIT_CODE: "1",
      FINDING_DETAIL: "- `rule.one` — `src/lib/thing.ts:42`",
    });

    expect(run.calls).toContain("issue create");
    expect(run.calls).toContain("Scheduled Semgrep SAST failure — review the scan");
    expect(run.calls).toContain("reported ERROR-severity findings");
    expect(run.calls).toContain("`rule.one` — `src/lib/thing.ts:42`");
    // Metadata only, and scoped to this repository: the job has no checkout.
    expect(run.calls).toContain("--repo owner/repo");
    expect(run.calls).not.toContain("readFileSync");
    expect(run.stdout).toContain("Opened new tracking issue");
  });

  it("says a run whose gate did not run is not a finding", () => {
    const run = runPayload({ SCAN_RESULT: "failure", SEMGREP_EXIT_CODE: "7", FINDING_DETAIL: "" });

    expect(run.calls).toContain("did not complete");
    expect(run.calls).toContain("**not a finding**");
    expect(run.calls).toContain("semgrep exited 7");
    expect(run.calls).toContain("This run says nothing about the code");
    expect(run.calls).not.toContain("reported ERROR-severity findings");
  });

  it("opens the issue anyway when a findings run carried no detail", () => {
    // Losing the detail costs context; losing the notification cost the signal
    // (the same ordering the runtime drift probe settled on).
    const run = runPayload({ SCAN_RESULT: "failure", SEMGREP_EXIT_CODE: "1", FINDING_DETAIL: "" });

    expect(run.calls).toContain("issue create");
    expect(run.calls).toContain("did not carry their locations");
  });

  it("updates the open issue in place rather than filing a second one", () => {
    const run = runPayload({
      SCAN_RESULT: "failure",
      SEMGREP_EXIT_CODE: "1",
      FINDING_DETAIL: "- `rule.two` — `scripts/report.mjs:7`",
      GH_LIST_RESPONSE: JSON.stringify([
        { number: 41, title: "Something else entirely" },
        { number: 42, title: "Scheduled Semgrep SAST failure — review the scan" },
      ]),
    });

    expect(run.calls).toContain("issue edit 42");
    expect(run.calls).not.toContain("issue create");
    expect(run.stdout).toContain("Updated tracking issue #42");
  });

  it("closes the issue when a scheduled or manual run is clean again", () => {
    const run = runPayload({
      SCAN_RESULT: "success",
      SEMGREP_EXIT_CODE: "0",
      GH_LIST_RESPONSE: JSON.stringify([
        { number: 42, title: "Scheduled Semgrep SAST failure — review the scan" },
      ]),
    });

    expect(run.calls).toContain("issue close 42");
    expect(run.calls).toContain("--reason completed");
    expect(run.calls).toContain("closes automatically");
    expect(run.stdout).toContain("Closed tracking issue #42");
  });

  it("changes nothing on a green run with no open issue, or a run that never finished", () => {
    const green = runPayload({ SCAN_RESULT: "success", SEMGREP_EXIT_CODE: "0" });
    expect(green.calls).not.toContain("issue create");
    expect(green.calls).not.toContain("issue close");
    expect(green.calls).not.toContain("issue edit");

    // A cancelled run is not a green result, so it must not close the issue.
    const cancelled = runPayload({
      SCAN_RESULT: "cancelled",
      GH_LIST_RESPONSE: JSON.stringify([
        { number: 42, title: "Scheduled Semgrep SAST failure — review the scan" },
      ]),
    });
    expect(cancelled.calls).not.toContain("issue close");
    expect(cancelled.stdout).toContain("no tracking-issue change");
  });

  it("syntax-checks the payload the heredoc embeds", () => {
    expect(payload, "the workflow must embed a tracking-issue payload").not.toBe("");
    const dir = tempDir("sast-payload-syntax-");
    const file = path.join(dir, "payload.mjs");
    writeFileSync(file, payload);
    expect(payload.length).toBeGreaterThan(1000);
    expect(() => execFileSync(process.execPath, ["--check", file], { stdio: "pipe" })).not.toThrow();
  });
});

describe("the hand-off touches no artifact and no scan workspace", () => {
  it("keeps the scan job read-only and the write permission in the reporting job", () => {
    // The scan job inherits the workflow-level grant, which must stay read-only.
    const topPermissions = workflow.slice(
      workflow.indexOf("permissions:"),
      workflow.indexOf("jobs:"),
    );
    expect(topPermissions).toContain("contents: read");
    expect(topPermissions).not.toContain("issues: write");

    const scanJob = workflow.slice(workflow.indexOf("jobs:"), workflow.indexOf("record-sast-outcome:"));
    expect(scanJob).not.toContain("issues: write");
    expect(scanJob).not.toContain("permissions:");

    const reportJob = workflow.slice(workflow.indexOf("record-sast-outcome:"));
    expect(reportJob).toContain("needs: semgrep");
    expect(reportJob).toContain("if: always()");
    expect(reportJob).toContain("issues: write");
    expect(reportJob).not.toContain("contents: write");
    // PR runs never maintain the issue: their own check is the signal.
    expect(reportJob).toContain("github.event_name != 'pull_request'");
  });

  it("passes the findings as job outputs instead of uploading the scan report", () => {
    expect(workflow).toContain("finding_detail: ${{ steps.scan.outputs.finding_detail }}");
    expect(workflow).toContain("echo \"finding_detail<<SEMGREP_SAST_DETAIL_EOF\"");
    expect(workflow).toContain("FINDING_DETAIL: ${{ needs.semgrep.outputs.finding_detail }}");
    expect(workflow).toContain("process.env.FINDING_DETAIL");
    expect(workflow).not.toContain("upload-artifact");
    expect(workflow).not.toContain("download-artifact");
    // No reader of the reporting side ever opens a workspace file: job
    // workspaces are separate runners, which is how the drift probe lost its
    // notification.
    expect(payload, "the workflow must embed a tracking-issue payload").not.toBe("");
    expect(payload).not.toContain("readFileSync");
  });
});

describe("every scheduled workflow can reach a human", () => {
  const dir = path.join(process.cwd(), ".github/workflows");

  /** Job names of a workflow file (two-space headers under `jobs:`). */
  function jobs(source: string): string[] {
    const header = source.indexOf("\njobs:");
    if (header === -1) return [];
    return source
      .slice(header)
      .split("\n")
      .filter((line) => /^ {2}[A-Za-z0-9_-]+:\s*$/.test(line))
      .map((line) => line.trim().replace(/:$/, ""));
  }

  /**
   * A scheduled workflow with no way to write an issue is a monitor that cannot
   * report. This is the repository's own stated rule (see the header of
   * dependency-scheduled-audit.yml: "every scheduled workflow in this
   * repository must be able to fail visibly without a commit").
   */
  function monitorsThatCannotReport(source: string): string[] {
    if (!/^on:[\s\S]*?^\s+schedule:/m.test(source)) return [];
    const gaps: string[] = [];
    if (!source.includes("issues: write")) gaps.push("no job is granted issues: write");
    if (!/gh .*issue|["']issue["'],\s*["'](create|edit|close)["']|issue list/.test(source)) {
      gaps.push("no job mutates an issue");
    }
    return gaps;
  }

  it("holds for every scheduled workflow in the repository", () => {
    const offenders = readdirSync(dir)
      .filter((file) => file.endsWith(".yml"))
      .sort()
      .map((file) => ({
        file,
        gaps: monitorsThatCannotReport(readFileSync(path.join(dir, file), "utf8")),
      }))
      .filter((entry) => entry.gaps.length > 0)
      .map((entry) => `${entry.file}: ${entry.gaps.join("; ")}`);

    expect(offenders, "a scheduled monitor must be able to open a tracking issue").toEqual([]);
  });

  it("catches the shape this workflow shipped with", () => {
    // The pre-2026-10-14 codeql-sast.yml: one read-only job, a weekly schedule,
    // and findings that ended in the run list and nowhere else.
    const preFix = [
      "name: Semgrep SAST",
      "on:",
      "  schedule:",
      '    - cron: "33 3 * * 3"',
      "permissions:",
      "  contents: read",
      "jobs:",
      "  semgrep:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - name: Scan src/ and scripts/",
      "        run: semgrep scan --config p/typescript --severity ERROR --error src scripts",
    ].join("\n");

    expect(monitorsThatCannotReport(preFix)).toEqual([
      "no job is granted issues: write",
      "no job mutates an issue",
    ]);
    expect(monitorsThatCannotReport(workflow)).toEqual([]);
    expect(jobs(workflow)).toEqual(["semgrep", "record-sast-outcome"]);
  });
});
