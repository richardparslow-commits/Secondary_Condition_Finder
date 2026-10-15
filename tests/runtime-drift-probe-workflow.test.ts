import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

/**
 * The tracking-issue payload of the drift probe, extracted from its heredoc so
 * the same text the workflow runs can at least be syntax-checked here.
 */
function issuePayload(workflow: string): string {
  const marker = "--input-type=module - <<'NODE'";
  const start = workflow.indexOf(marker);
  expect(start, "tracking-issue heredoc").toBeGreaterThan(-1);
  return workflow.slice(start + marker.length, workflow.indexOf("          NODE", start));
}

describe("runtime drift probe workflow", () => {
  const workflowPath = ".github/workflows/runtime-drift-probe.yml";
  const workflow = read(workflowPath);
  const healthRoute = read("src/app/api/health/route.ts");

  it("runs on a fixed daily schedule and can be dispatched", () => {
    expect(workflow).toContain("schedule:");
    expect(workflow).toContain('cron: "11 4 * * *"');
    expect(workflow).toContain("workflow_dispatch");
    // Off the hour and off the other scheduled workflows' minutes
    // (citation-decay-watch 06:07, CodeQL 03:33).
    expect(workflow).not.toContain('cron: "7 6 * * 1"');
    expect(workflow).not.toContain('cron: "33 3 * * 3"');
  });

  it("probes exactly the two production signals with the required gate thresholds", () => {
    // /runtime-readiness: HTTP 200 + the exact ready marker, same as the
    // readiness gate uses.
    expect(workflow).toContain("/runtime-readiness");
    expect(workflow).toContain('data-runtime-readiness="ready"');
    expect(workflow).toContain('drift+=("readiness');
    // Drift is anything not-ready; the not_ready marker is not pinned here
    // since unexpected payloads are equally drift.
    expect(workflow).not.toContain('drift+=();');

    // /api/health: HTTP 200 with status exactly "healthy" — "degraded" at
    // HTTP 200 is drift, matching the endpoint's documented 200/503 verdict.
    expect(workflow).toContain("/api/health");
    expect(workflow).toContain('health_verdict" = "healthy"');
    expect(workflow).toContain('drift+=("health');

    // Both probes mirror the production URL the readiness workflow verifies.
    expect(workflow).toContain("PRODUCTION_BASE_URL: https://secondary-condition-finder.vercel.app");

    // The check step reads exactly the four leaf components the health
    // endpoint's documented schema gates the 200/503 verdict on — never
    // invents component names, never reads a secret from a response body.
    for (const component of ["catalog", "sessionCrypto", "workflowSession", "kbGraph"]) {
      expect(workflow).toContain(component);
    }
    // Those four names come from the endpoint code, not from the probe.
    expect(healthRoute).toContain("catalog, sessionCrypto");
    expect(healthRoute).toContain("kbGraph.status === \"ok\"");
  });

  it("writes drift evidence without pasting response bodies into the issue", () => {
    // The report job maintains one tracking issue, named with the marker so
    // only this workflow's issue is reused/updated/closed — the same pattern
    // as dependency-scheduled-audit (`search in:title`).
    expect(workflow).toContain("Open or update runtime drift tracking issue");
    expect(workflow).toContain("Close resolved runtime drift tracking issue");
    expect(workflow).toContain("issues: write");

    // The close path is explicitly tied to a green probe, never a skipped one.
    expect(workflow).toContain("if: success() && needs.probe.result == 'success'");
    expect(workflow).toContain("needs.probe.result == 'failure'");

    // No raw response body lives in any issue body — bodies are deleted.
    expect(workflow).toMatch(/temporary response bodies are deleted.*not printed/i);
    expect(workflow).not.toContain("--body-file \"$readiness_body\"");
    expect(workflow).not.toContain("--body-file \"$health_body\"");

    // The upload artifact is the drift summary, not a response body.
    expect(workflow).toContain("path: drift.txt");
  });

  it("does not widen permissions beyond the probe's needs", () => {
    // Top-level is read-only; per-job grants cover only the two write paths.
    const topPermissions = workflow.split("jobs:")[0];
    expect(topPermissions).toContain("contents: read");
    expect(topPermissions).not.toContain("issues: write");

    // The probe job never comments or closes issues.
    const probe = workflow.split("report-drift:")[0];
    expect(probe).not.toContain("issues: write");
    expect(probe).not.toContain("gh issue");

    // No environment/secrets beyond the built-in token.
    expect(workflow).not.toContain("environment:");
    expect(workflow).not.toMatch(/\$\{\{ secrets\./);
  });

  /**
   * The probe could detect drift and not tell anyone.
   *
   * `drift.txt` is written in the probe job's workspace, but the upload lived in
   * a separate job that never checked the repository out — job workspaces are
   * separate, so that runner's workspace had no drift file at all — and
   * `report-drift` downloaded the artifact without depending on that uploader,
   * so the two ran in parallel on a good day. Either way the download step
   * failed before the reporting payload ran: no issue, only a red scheduled run
   * in the run history (docs/runtime-drift-probe-handoff-policy-2026-10-14.md).
   */
  it("uploads the drift details from the job that writes them", () => {
    const probeJob = workflow.slice(workflow.indexOf("jobs:"), workflow.indexOf("report-drift:"));
    expect(probeJob).toContain("actions/upload-artifact@");
    expect(probeJob).toContain("path: drift.txt");

    const uploadStep = probeJob.slice(probeJob.indexOf("Upload drift details"));
    // `always()` so a drifted (failing) run still keeps its evidence, and a
    // silent no-files case so a green run is not a warning every day.
    expect(uploadStep).toContain("if: always()");
    expect(uploadStep).toContain("if-no-files-found: ignore");

    // The separate uploader job is what could not work: no checkout in its
    // workspace, and no `needs` edge from the job that downloaded from it.
    expect(workflow).not.toContain("upload-drift-artifact:");
  });

  it("notifies from the probe's own output rather than from the artifact", () => {
    const reportJob = workflow.slice(
      workflow.indexOf("report-drift:"),
      workflow.indexOf("clear-drift:"),
    );

    // No download at all on the notification path.
    expect(reportJob).not.toContain("actions/download-artifact@");
    expect(workflow).toContain("drift_lines: ${{ steps.check.outputs.drift_lines }}");
    expect(workflow).toContain('echo "drift_lines<<DRIFT_LINES_EOF"');
    expect(reportJob).toContain("DRIFT_LINES: ${{ needs.probe.outputs.drift_lines }}");
    expect(reportJob).toContain("process.env.DRIFT_LINES");

    // The outcome is known from the probe's own failure, so an empty detail set
    // still opens the issue instead of throwing on a missing file.
    expect(reportJob).toContain("did not carry its details");
    expect(reportJob).not.toContain("readFileSync(\"drift.txt\"");
  });

  it("syntax-checks the payload it embeds", () => {
    // The heredoc is the only place the payload is ever run; a quoting change in
    // the YAML would otherwise only surface on a drifted production run.
    const file = join(mkdtempSync(join(tmpdir(), "drift-payload-")), "payload.mjs");
    writeFileSync(file, issuePayload(workflow));
    expect(() => execFileSync(process.execPath, ["--check", file], { stdio: "pipe" })).not.toThrow();
  });

  it("does not duplicate or undermine the exact-commit readiness gate", () => {
    // The probe does not wait for Vercel exact-commit status, does not gate
    // the route matrix, and never touches #213 — Production Runtime
    // Readiness on main CI still owns that evidence.
    const probeJob = workflow.slice(workflow.indexOf("jobs:"), workflow.indexOf("report-drift:"));
    expect(probeJob).not.toContain("commits/");
    expect(probeJob).not.toContain("commit status");
    expect(probeJob).not.toContain("RUNTIME_READINESS_ISSUE");
    expect(probeJob).not.toContain("'213'");

    // Its failure path points the operator at the heavier workflow instead.
    expect(workflow).toContain("Production Runtime Readiness");
  });
});
