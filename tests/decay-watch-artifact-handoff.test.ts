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

describe("citation-decay-watch surfaces content-drift observability", () => {
  const workflow = readWorkflow("citation-decay-watch.yml");

  /**
   * `contentDriftCount` reads 0 both when every digested source still matches
   * and when no reference carries a digest at all, so publishing the count on
   * its own reports a clean result on a dimension the probe cannot observe.
   * Both human-facing surfaces — the weekly step summary and the auto-opened
   * tracking issue a qualified human acts on — must qualify it with the digest
   * coverage behind it.
   */
  it("qualifies the drift count with detectability and coverage in the step summary", () => {
    expect(workflow).toContain("report.contentDriftDetectable");
    expect(workflow).toContain("report.contentDriftCoveragePercent");
    expect(workflow).toContain("content drift detectable");
  });

  it("reports the digest backlog and its ratchet in the tracking issue", () => {
    expect(workflow).toContain("report.verifiedWithoutDigestCount");
    expect(workflow).toContain("report.verifiedReferenceCount");
    expect(workflow).toContain("report.maxUndigestedVerifiedRefs");
  });

  it("keeps the shell-embedded summary JS free of backticks", () => {
    // The summary runs as `node --input-type=module -e "<js>"`, i.e. the JS sits
    // inside a double-quoted shell string where a backtick is command
    // substitution. The issue-body block is a quoted heredoc and may use them,
    // so this pins only the -e payload.
    const marker = '-e "';
    const start = workflow.indexOf(marker);
    expect(start).toBeGreaterThan(-1);
    const js = workflow.slice(start + marker.length, workflow.indexOf('"', start + marker.length));
    // Guard against the extraction silently matching an empty span.
    expect(js.length).toBeGreaterThan(200);
    expect(js).toContain("report.contentDriftDetectable");
    expect(js).not.toContain("`");
  });
});

describe("citation-decay-watch attributes verification debt to its owning gate", () => {
  const workflow = readWorkflow("citation-decay-watch.yml");

  /**
   * The ceiling once counted unverified references — debt that
   * audit-citation-verification.js already ratchets at
   * CITATION_DEBT_BASELINE.unverified. At 1290 unverified against a budget of 10
   * the weekly gate failed on every run irrespective of link rot or drift, so
   * it could signal neither. Both human-facing surfaces must now state what the
   * ceiling actually measures and where the debt is gated; otherwise a reader
   * sees "unverified: 1290" beside "ceiling usage: 0/10" and concludes the gate
   * is ignoring the debt rather than delegating it.
   */
  it("labels the ceiling with the decay classes it measures in the step summary", () => {
    expect(workflow).toContain("ceiling usage (link rot + stale + drift)");
  });

  it("states that verification debt is ratcheted by citations:audit", () => {
    expect(workflow).toContain("debt ratcheted by citations:audit, not gated here");
  });

  it("carries both labels into the tracking issue body", () => {
    // The tracking issue is the surface a qualified human acts on, so the
    // step summary alone is not sufficient.
    const issueStart = workflow.indexOf("--input-type=module - <<'NODE'");
    expect(issueStart).toBeGreaterThan(-1);
    const issueJs = workflow.slice(issueStart);
    expect(issueJs).toContain("ceiling usage (link rot + stale + drift)");
    expect(issueJs).toContain("debt ratcheted by citations:audit, not gated here");
  });
});
