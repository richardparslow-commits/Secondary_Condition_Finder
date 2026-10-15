import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createOutput } from "../scripts/probe-va-gov-links";

/**
 * The VA.gov walkthrough probe could not report the failure it exists to catch.
 *
 * `link-probe` captures stdout with `> va-gov-walkthrough-probe-report.json`,
 * but the probe wrote its progress banner and per-URL lines to stdout ahead of
 * the JSON report, and both readers parsed the whole captured file. So on a run
 * with a genuinely dead deep link the step summary was silently dropped (the
 * `|| true` on that shell line hid it) and `track-rot` died on `JSON.parse`
 * (`Unexpected token 'v', "va-gov-wal"...`) before it reached a single `gh`
 * call — the tracking issue was never opened, which is the workflow's entire
 * purpose. Measured on 2026-10-14 against a real captured run
 * (docs/va-gov-probe-handoff-policy-2026-10-14.md).
 *
 * Two independent guards are pinned here: the probe's `--json` stdout is now
 * exactly one JSON document (diagnostics on stderr), and both readers slice
 * from the first `{` so a banner can never kill the hand-off again.
 */

interface CapturedStream {
  text: string;
}

function capture(): CapturedStream & { write: (chunk: string) => boolean } {
  const stream = {
    text: "",
    write(chunk: string) {
      stream.text += chunk;
      return true;
    },
  };
  return stream;
}

/** The probe script is plain JS; its inferred option type is what matters here. */
type OutputOptions = Parameters<typeof createOutput>[0];

function output(json: boolean, stdout: ReturnType<typeof capture>, stderr: ReturnType<typeof capture>) {
  return createOutput({ json, stdout, stderr } as unknown as OutputOptions);
}

const REPORT = {
  probedAt: "2026-10-14T06:23:00.000Z",
  totalUrls: 8,
  aliveCount: 6,
  deadCount: 1,
  serverErrorCount: 0,
  unreachableCount: 1,
  status: "FAIL",
  results: [],
  dead: [],
  serverErrors: [],
  unreachable: [],
};

describe("probe output routing (--json is machine-readable)", () => {
  it("puts exactly one JSON document on stdout and every human line on stderr", () => {
    const stdout = capture();
    const stderr = capture();
    const out = output(true, stdout, stderr);

    out.note("va-gov-walkthrough-probe: probing 8 walkthrough deep-link(s)…");
    out.note("  [dead] https://www.va.gov/gone (status 404)");
    out.note("va-gov-walkthrough-probe: FAIL — 6 alive, 1 dead, 0 server-error, 1 unreachable.");
    out.report(REPORT);

    // The whole point: a shell redirect of stdout must capture something
    // JSON.parse accepts, with nothing ahead of it.
    expect(JSON.parse(stdout.text)).toEqual(REPORT);
    expect(stdout.text.trimStart().startsWith("{")).toBe(true);
    expect(stdout.text).not.toContain("probing");
    expect(stdout.text).not.toContain("[dead]");

    // A human still reads the progress lines, in the run log.
    expect(stderr.text).toContain("probing 8 walkthrough deep-link(s)");
    expect(stderr.text).toContain("[dead] https://www.va.gov/gone");
    expect(stderr.text).toContain("1 dead");
  });

  it("keeps everything on stdout for the maintainer run, and emits no JSON", () => {
    const stdout = capture();
    const stderr = capture();
    const out = output(false, stdout, stderr);

    out.note("va-gov-walkthrough-probe: probing 8 walkthrough deep-link(s)…");
    out.report(REPORT);

    expect(stdout.text).toContain("probing 8 walkthrough deep-link(s)");
    expect(stderr.text).toBe("");
    // Without --json there is no report on stdout at all, so a human run is
    // never confused by a report they did not ask for.
    expect(stdout.text).not.toContain('"probedAt"');
  });

  it("routes every human-facing line through the seam instead of bare console.log", () => {
    const source = readFileSync(path.join(process.cwd(), "scripts/probe-va-gov-links.js"), "utf8");
    const main = source.slice(
      source.indexOf("async function main()"),
      source.indexOf("if (require.main === module)"),
    );
    expect(main.length).toBeGreaterThan(200);

    expect(main).toContain("out.note(");
    expect(main).toContain("out.report(report)");
    // The regression: prose (or JSON) written straight to stdout alongside the
    // report. Only the load failure may go straight to console.error.
    expect(main).not.toContain("console.log(");
    expect(main.match(/console\.error\(/g) ?? []).toHaveLength(1);
  });
});

describe("the workflow's readers exercise the real captured report", () => {
  const workflow = readFileSync(
    path.join(process.cwd(), ".github/workflows/va-gov-walkthrough-probe.yml"),
    "utf8",
  );
  const marker = '-e "';
  const start = workflow.indexOf(marker);
  let end = start + marker.length;
  while (end < workflow.length) {
    if (workflow[end] === "\\") end += 2;
    else if (workflow[end] === '"') break;
    else end += 1;
  }
  const summaryJs = workflow.slice(start + marker.length, end).replace(/\\"/g, '"');

  /** Runs the step-summary payload over `reportText`, as the workflow does. */
  function runSummary(reportText: string): string {
    const dir = mkdtempSync(path.join(tmpdir(), "va-probe-"));
    writeFileSync(path.join(dir, "va-gov-walkthrough-probe-report.json"), reportText);
    writeFileSync(path.join(dir, "summary.mjs"), summaryJs);
    const summaryPath = path.join(dir, "summary.md");
    execFileSync(process.execPath, [path.join(dir, "summary.mjs")], {
      cwd: dir,
      env: { ...process.env, GITHUB_STEP_SUMMARY: summaryPath },
      stdio: "pipe",
    });
    return readFileSync(summaryPath, "utf8");
  }

  it("writes the weekly summary from a pure JSON report", () => {
    const summary = runSummary(JSON.stringify(REPORT));

    expect(summary).toContain("status: FAIL");
    expect(summary).toContain("deep links probed: 8");
    expect(summary).toContain("dead routes (404/410): 1");
    expect(summary).toContain("unreachable: 1");
  });

  it("still writes it when a banner precedes the report", () => {
    // This is the 2026-10-14 defect, reproduced at the reader: prose ahead of
    // the JSON used to throw, and the shell's `|| true` turned that into a
    // silently missing summary.
    const banner = "va-gov-walkthrough-probe: probing 8 walkthrough deep-link(s)…\n";
    const summary = runSummary(`${banner}${JSON.stringify(REPORT, null, 2)}\n`);

    expect(summary).toContain("status: FAIL");
    expect(summary).toContain("dead routes (404/410): 1");
  });
});

describe("track-rot maintains the issue in both directions and survives a missing report", () => {
  const workflow = readFileSync(
    path.join(process.cwd(), ".github/workflows/va-gov-walkthrough-probe.yml"),
    "utf8",
  );
  const issueJs = workflow.slice(workflow.indexOf("--input-type=module - <<'NODE'"));

  it("tolerates a banner and a report that never arrived", () => {
    // Both readers must slice from the first `{`: the probe's banner broke this
    // once, and a cancelled sweep leaves an empty capture.
    const tolerant = workflow.match(/indexOf\(["']\{["']\)/g) ?? [];
    expect(tolerant.length).toBe(2);
    expect(issueJs).toContain("if (!report)");
    expect(issueJs).toContain("No usable walkthrough probe report for this run");
    expect(issueJs).toContain("process.exit(0)");
  });

  it("does not turn a missing artifact into a second failure", () => {
    const downloadStep = workflow.slice(
      workflow.indexOf("Download probe report artifact"),
      workflow.indexOf("Maintain walkthrough route-rot tracking issue"),
    );
    expect(downloadStep).toContain("continue-on-error: true");
  });

  it("opens or updates the issue when the probe fails, and closes it when green", () => {
    const trackSection = workflow.slice(workflow.indexOf("track-rot:"));
    expect(trackSection).toContain("needs: link-probe");
    expect(trackSection).toContain("if: always()");
    expect(trackSection).toContain("PROBE_RESULT: ${{ needs.link-probe.result }}");
    expect(issueJs).toContain("process.env.PROBE_RESULT");
    expect(issueJs).toContain('outcome !== "failure"');
    expect(issueJs).toContain('outcome === "success" && matches.length > 0');
    expect(issueJs).toContain('gh(["issue", "create", "--title", title, "--body", body]);');
    expect(issueJs).toContain('gh(["issue", "edit", String(matches[0].number), "--body", body]);');
    expect(issueJs).toContain('"close"');
    expect(issueJs).toContain('"completed"');
    // A notice that outlives its cause is its own false signal.
    expect(workflow).not.toContain("auto-closed");
    expect(issueJs).toContain("closes when a");
  });

  it("states which route states the probe could and could not check", () => {
    // `unreachable` means the route was not checked, which is not a finding
    // about it — the same distinction the citation-decay probe learned to draw.
    expect(issueJs).toContain("was NOT checked");
    expect(issueJs).toContain("## Unreachable (not checked — not dead)");
    expect(issueJs).toContain("report.unreachable");
    expect(issueJs).toContain("## Dead routes (HTTP 404/410)");
    expect(issueJs).toContain("## Server errors (VA.gov returned 5xx)");
  });
});
