import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Contract tests for the scheduled watch workflows' artifact hand-off.
 *
 * The tracking jobs (track-decay / track-rot) run on a fresh runner, so the
 * report file written by the probe job only reaches them through the run's
 * artifacts. A missing download step means the tracking job dies on ENOENT
 * and the auto-opened tracking issue — the workflows' entire purpose — never
 * happens. These tests pin the hand-off so the failure mode cannot silently
 * return.
 */

function readWorkflow(name: string): string {
  return readFileSync(`.github/workflows/${name}`, "utf8");
}

describe.each([
  {
    file: "citation-decay-watch.yml",
    probeJob: "decay-probe",
    trackJob: "track-decay",
    artifactPrefix: "citation-decay-report-",
    reportFile: "citation-decay-report.json",
    probeScript: "npm run citations:decay",
  },
  {
    file: "va-gov-walkthrough-probe.yml",
    probeJob: "link-probe",
    trackJob: "track-rot",
    artifactPrefix: "va-gov-walkthrough-probe-report-",
    reportFile: "va-gov-walkthrough-probe-report.json",
    probeScript: "scripts/probe-va-gov-links.js",
  },
])("scheduled probe artifact hand-off ($file)", ({ file, probeJob, trackJob, artifactPrefix, reportFile, probeScript }) => {
  const workflow = readWorkflow(file);

  it("uploads the probe report even when the probe job fails", () => {
    expect(workflow).toContain(reportFile);
    expect(workflow).toContain("actions/upload-artifact@");
    const uploadSection = workflow.slice(workflow.indexOf("Upload"));
    expect(uploadSection).toContain("if: always()");
  });

  it("downloads the report artifact in the tracking job before building the issue body", () => {
    expect(workflow).toContain("actions/download-artifact@");
    // The download must reference the exact run-scoped artifact name the
    // probe job uploaded, not a generic name.
    expect(workflow).toContain(`name: ${artifactPrefix}\${{ github.run_id }}`);
  });

  it("keeps the report file name consistent between probe, artifact, and tracking job", () => {
    const occurrences = workflow.split(reportFile).length - 1;
    // probe command, summary reader, artifact path, tracking-job reader.
    expect(occurrences).toBeGreaterThanOrEqual(4);
  });

  it("gates the tracking job on probe failure with least-privilege issue write", () => {
    const trackSection = workflow.slice(workflow.indexOf(`${trackJob}:`));
    expect(trackSection).toContain(`needs: ${probeJob}`);
    expect(trackSection).toContain("needs." + probeJob + ".result == 'failure'");
    expect(trackSection).toContain("issues: write");
    expect(trackSection).not.toContain("contents: write");
  });

  it("runs the probe against its designed source", () => {
    expect(workflow).toContain(probeScript);
  });
});
