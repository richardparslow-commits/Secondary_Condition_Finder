import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

type JobSection = { name: string; text: string };

/** Splits a workflow into its job sections (2-space headers under `jobs:`). */
function jobSections(source: string): JobSection[] {
  const sections: JobSection[] = [];
  let current: { name: string; lines: string[] } | null = null;
  for (const line of source.split("\n")) {
    const header = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (header) {
      if (current) sections.push({ name: current.name, text: current.lines.join("\n") });
      current = { name: header[1], lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) sections.push({ name: current.name, text: current.lines.join("\n") });
  return sections;
}

/**
 * Jobs that download an artifact they cannot have: the uploader is a different
 * job that is not one of their `needs:` ancestors.
 *
 * Job workspaces are separate, so a job that uploads `drift.txt` can only do so
 * if it is the job that wrote the file, and sibling jobs run in parallel, so a
 * downloader must actually wait for the uploader. Both halves of that shape
 * silently cost the runtime drift probe its tracking issue — the download step
 * failed before the payload ran, which is not a parse error and not a warning
 * anyone would look for.
 */
function unsafeDownloads(source: string): string[] {
  const jobs = jobSections(source);
  const uploaders = jobs
    .filter((job) => job.text.includes("actions/upload-artifact@"))
    .map((job) => job.name);

  return jobs
    .filter((job) => job.text.includes("actions/download-artifact@"))
    .filter((job) => {
      if (uploaders.includes(job.name)) return false;
      const needs = /^ *needs: *(\[[^\]]*\]|.*)$/m.exec(job.text)?.[1] ?? "";
      return !uploaders.some((uploader) => new RegExp(`\\b${uploader}\\b`).test(needs));
    })
    .map((job) => job.name);
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

  it("drives the tracking job from the probe result with least-privilege issue write", () => {
    const trackSection = workflow.slice(workflow.indexOf(`${trackJob}:`));
    expect(trackSection).toContain(`needs: ${probeJob}`);
    // The tracking job's behaviour must follow the probe's own verdict rather
    // than a hard-coded assumption about it (citation-decay-watch branches on
    // it inside the job: failure opens/updates, success closes).
    expect(trackSection).toContain(`needs.${probeJob}.result`);
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
    expect(workflow).toContain("report.maxUndigestedEligibleVerifiedRefs");
  });

  /**
   * The ratchet may only measure a backlog a human can move. A digest anchors
   * to `sourceUrl` and is checked by re-fetching it, so a reference whose URL
   * the probe cannot obtain a comparable body for can never carry one — the SOP
   * requires omitting it rather than recording a false positive. Counting those
   * references made this gate unsatisfiable: on 2026-10-05 the weekly run failed
   * with zero link rot, drift or staleness, purely because 398 undigested
   * references exceeded a pin of 383, and the tracking issue asked a human to
   * re-verify references that had not decayed (issue #518). Both human-facing
   * surfaces must now separate the eligible backlog from the declared,
   * measured digest-ineligible population, so neither can be mistaken for the
   * other — a single "awaiting a digest" number reads as work a human owes.
   */
  it("separates the eligible backlog from the declared ineligible population in the step summary", () => {
    expect(workflow).toContain("report.digestEligibleWithoutDigestCount");
    expect(workflow).toContain("report.digestEligibleReferenceCount");
    expect(workflow).toContain("report.digestIneligibleWithoutDigestCount");
    expect(workflow).toContain("digest-eligible backlog");
    expect(workflow).toContain("digest-ineligible (declared class, no digest possible)");
  });

  it("names the register's review dates wherever the ineligible count is shown", () => {
    // The exclusion is justified by a measurement with a shelf life, so a
    // reader must be able to see when it was last checked and when it lapses.
    expect(workflow.match(/report\.digestIneligibilityRegister\.reviewedOn/g)?.length).toBe(2);
    expect(workflow.match(/report\.digestIneligibilityRegister\.reviewExpiresOn/g)?.length).toBe(2);
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

describe("citation-decay-watch maintains its tracking issue in both directions", () => {
  const workflow = readWorkflow("citation-decay-watch.yml");
  const issueJs = workflow.slice(workflow.indexOf("--input-type=module - <<'NODE'"));

  /**
   * A tracking issue that outlives its cause is its own false signal: the fix
   * for a gate that failed on a signal it could never clear must also stop the
   * notice asking a qualified human to re-verify references that never decayed
   * (issue #518).
   */
  it("branches on the probe result inside the tracking job", () => {
    const trackSection = workflow.slice(workflow.indexOf("track-decay:"));
    expect(trackSection).toContain("PROBE_RESULT: ${{ needs.decay-probe.result }}");
    expect(trackSection).toContain("if: always()");
    expect(issueJs).toContain("process.env.PROBE_RESULT");
  });

  it("still opens or updates the tracking issue when the probe fails", () => {
    expect(issueJs).toContain('outcome !== "failure"');
    expect(issueJs).toContain('gh(["issue", "create", "--title", title, "--body", body]);');
    expect(issueJs).toContain('gh(["issue", "edit", String(matches[0].number), "--body", body]);');
  });

  it("closes the tracking issue when a scheduled run is green again", () => {
    expect(issueJs).toContain('outcome === "success"');
    expect(issueJs).toContain('"close"');
    expect(issueJs).toContain('"--reason"');
    expect(issueJs).toContain('"completed"');
    expect(workflow).not.toContain("is not auto-closed");
  });

  it("closes nothing on a run whose probe never completed", () => {
    // A cancelled or skipped probe is not a green result, so the close is
    // guarded by the success branch rather than by "not failure".
    expect(issueJs).toContain('if (outcome === "success" && matches.length > 0)');
  });
});

describe("citation-decay-watch attributes verification debt to its owning gate", () => {
  const workflow = readWorkflow("citation-decay-watch.yml");

  /**
   * The ceiling once counted unverified references — debt that
   * audit-citation-verification.js already ratchets at
   * CITATION_DEBT_BASELINE.unverified. At 1298 unverified against a budget of 10
   * the weekly gate failed on every run irrespective of link rot or drift, so
   * it could signal neither. Both human-facing surfaces must now state what the
   * ceiling actually measures and where the debt is gated; otherwise a reader
   * sees "unverified: 1298" beside "ceiling usage: 0/10" and concludes the gate
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

describe("no workflow downloads an artifact from a job that cannot have uploaded it", () => {
  const workflowDir = join(process.cwd(), ".github/workflows");
  const files = readdirSync(workflowDir)
    .filter((file) => file.endsWith(".yml"))
    .sort();

  it("holds for every workflow in the repository", () => {
    const offenders = files.flatMap((file) =>
      unsafeDownloads(readFileSync(join(workflowDir, file), "utf8")).map(
        (job) => `${file}:${job}`,
      ),
    );

    expect(
      offenders,
      "a downloading job must `needs:` the job that uploads the artifact (or do the upload \n" +
        "itself): job workspaces are separate, and sibling jobs run in parallel",
    ).toEqual([]);
  });

  it("catches the shape that left the runtime drift probe unable to notify", () => {
    // The pre-2026-10-14 runtime-drift-probe job graph: the artifact is written
    // by `probe`, uploaded by a sibling with no checkout, and downloaded by a
    // third job that only `needs: probe`.
    const preFix = [
      "jobs:",
      "  probe:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: cp \"$tmp_dir/drift.txt\" ./drift.txt",
      "  report-drift:",
      "    needs: probe",
      "    steps:",
      "      - uses: actions/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0 # v5",
      "  upload-drift-artifact:",
      "    needs: probe",
      "    steps:",
      "      - uses: actions/upload-artifact@330a01c490aca151604b8cf639adc76d48f6c5d4 # v5",
    ].join("\n");

    expect(unsafeDownloads(preFix)).toEqual(["report-drift"]);
  });

  it("accepts the shape the probes use, and a needs list", () => {
    const uploadInProducer = [
      "jobs:",
      "  probe:",
      "    steps:",
      "      - uses: actions/upload-artifact@330a01c490aca151604b8cf639adc76d48f6c5d4 # v5",
      "  track:",
      "    needs: [probe, other]",
      "    steps:",
      "      - uses: actions/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0 # v5",
    ].join("\n");

    expect(unsafeDownloads(uploadInProducer)).toEqual([]);
  });
});

describe("citation-decay-watch keeps its uploaded report machine-readable", () => {
  const workflow = readWorkflow("citation-decay-watch.yml");

  /**
   * The first scheduled run (2026-09-28) uploaded npm's script banner ahead of
   * the JSON report. track-decay ran `JSON.parse` over the whole file, died on
   * the banner's leading `>`, and the auto-opened tracking issue — the entire
   * purpose of the watch — never happened. The capture must silence the banner,
   * and both readers must still tolerate one if it ever returns.
   */
  it("silences npm's banner where the report is captured", () => {
    const capture = workflow
      .split("\n")
      .find((line) => line.includes("citations:decay") && line.includes("tee"));
    expect(capture).toBeDefined();
    expect(capture).toMatch(/npm_config_loglevel=silent|--silent/);
  });

  it("parses from the first JSON object in both readers of the report", () => {
    // Exactly two readers parse this artifact: the step-summary `-e` payload
    // and the tracking-issue heredoc. Both must slice from the first `{`.
    const tolerant = workflow.match(/indexOf\(["']\{["']\)/g) ?? [];
    expect(tolerant.length).toBe(2);
  });
});
