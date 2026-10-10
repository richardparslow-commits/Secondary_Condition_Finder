import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  PRIV01_SENTINEL_SCOPE,
  matchesPriv01SentinelScope,
  priv01SentinelScopeMatches,
} from "../scripts/priv01-sentinel-scope.mjs";

/**
 * PRIV-01 sentinel gate wiring.
 *
 * The PRIV-01 stage-4 browser sentinel is the one privacy check that cannot be
 * satisfied by reading source: it plants unique sentinels in every private
 * field, drives the real workflow in a real browser, and fails if a sentinel
 * reaches a request, a response body, an HTML/RSC payload, the browser or
 * server log, a trace, or browser storage. For it to be a gate rather than an
 * occasionally-run script, these have to stay true in CI:
 *
 *   1. It runs as its own job, so its wall clock is its own: the walk starts a
 *      dev server, drives Chrome and runs page-side OCR, and as a step inside
 *      `verify` it could spend the budget every other gate needed — and be
 *      truncated by `verify`'s ceiling into an opaque cancellation instead of a
 *      diagnosis.
 *   2. It is still *required*: `verify` needs that job and fails when it
 *      fails, so enforcement stays on the single context branch protection
 *      already watches. A job that is merely named in the workflow, or that
 *      skips itself on failure, is not a gate.
 *   3. It is path-filtered where it can be, and only there: pull requests whose
 *      change set cannot move the browser-local posture skip the walk, every
 *      non-PR event runs it, and a change set that cannot be read runs it
 *      rather than skipping it.
 *   4. It fails instead of skipping when the runner cannot host it — a green
 *      run must mean the walk actually happened.
 *   5. The trigger scope itself stays complete: this test walks the
 *      load-bearing directories on disk, so a new privacy-bearing module that
 *      no scope pattern covers fails the suite instead of quietly falling
 *      outside the gate.
 */

const ROOT = process.cwd();
const CI = read(".github/workflows/ci.yml");
const SCOPE_MODULE = "scripts/priv01-sentinel-scope.mjs";
const SENTINEL_STEP = "Run PRIV-01 stage-4 browser sentinel";
const SCOPE_STEP = "Detect PRIV-01 sentinel scope changes";
const SENTINEL_JOB = "priv01_sentinel";
const SCOPE_JOB = "priv01_scope";
const SERVER_LOG = "ci-priv01-sentinel-server.log";
const EVIDENCE_JSON = "ci-priv01-sentinel-evidence.json";
const WALK_LOG = "ci-priv01-sentinel.log";
const APP_PORT = "3117";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function listFiles(relativeDir: string): string[] {
  return fs.readdirSync(path.join(ROOT, relativeDir), { withFileTypes: true }).flatMap((entry) => {
    const child = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) return listFiles(child);
    return entry.isFile() ? [child] : [];
  });
}

/**
 * One job's block, from its key to the next top-level job key. Slice-based
 * rather than substring-based on purpose: `expect(ci).toContain("if: always()")`
 * would pass with the condition on the wrong job, which is exactly the mistake
 * that makes a gate advisory.
 */
function jobBlock(name: string): string {
  const start = CI.indexOf(`\n  ${name}:\n`);
  expect(start, `ci.yml has no job named ${name}`).toBeGreaterThan(-1);
  const rest = CI.slice(start + 1);
  const next = /\n {2}[a-z0-9_-]+:\n/.exec(rest.slice(1));
  return next ? rest.slice(0, next.index + 1) : rest;
}

function stepBlock(job: string, stepName: string): string {
  const block = jobBlock(job);
  const start = block.indexOf(`- name: ${stepName}`);
  expect(start, `${job} has no step named ${stepName}`).toBeGreaterThan(-1);
  const next = block.slice(start + 1).search(/\n {6}- /);
  return next === -1 ? block.slice(start) : block.slice(start, start + 1 + next);
}

function timeoutMinutes(block: string): number {
  const match = /timeout-minutes:\s*(\d+)/.exec(block);
  expect(match, "expected a timeout-minutes ceiling").not.toBeNull();
  return Number(match![1]);
}

/**
 * Directories whose every file is in scope: the workflow's own routes,
 * components and browser-local state, the evidence/OCR pipeline, the client
 * corpus the browser fetches, and the refusal layer. The assertion below is
 * one-directional on purpose — scope may cover more than these directories,
 * but it may not cover less.
 */
const IN_SCOPE_DIRECTORIES = [
  "src/app/secondary",
  "src/components/secondary",
  "src/components/evidence",
  "src/lib/secondary-workflow",
  "src/lib/evidence",
  "src/lib/client-corpus",
  "src/lib/security",
  "public/tesseract",
];

/** Single files that must stay in scope even though a directory rule is not what covers them. */
const IN_SCOPE_FILES = [
  "src/proxy.ts",
  "src/lib/workflow-session-crypto.ts",
  "next.config.ts",
  "scripts/acceptance-browser-sentinel.mjs",
  "scripts/lib/sentinel-wait.mjs",
  "scripts/lib/sentinel-run-state.mjs",
  "scripts/lib/sentinel-progress.mjs",
  SCOPE_MODULE,
  "scripts/build-client-corpus.mjs",
  ".github/workflows/ci.yml",
];

describe("PRIV-01 sentinel CI gate", () => {
  it("runs the stage-4 sentinel as its own job, with the walk as its own step", () => {
    const job = jobBlock(SENTINEL_JOB);
    expect(job).toContain(`- name: ${SENTINEL_STEP}`);
    expect(job).toContain("node scripts/acceptance-browser-sentinel.mjs");
    // The step name is what the acceptance contract documents, so a rename has
    // to be a deliberate change to both.
    expect(stepBlock(SENTINEL_JOB, SENTINEL_STEP)).toContain("id: priv01_sentinel");
  });

  it("gives the walk its own time budget, strictly inside the job's", () => {
    // Independent means: a walk that hangs cannot consume the time of any other
    // gate, and the ceiling that kills this job is a backstop rather than the
    // walk's own budget. The step budget has to be smaller, or the inner budget
    // would never be the one that fires.
    const jobTimeout = timeoutMinutes(jobBlock(SENTINEL_JOB));
    const walkTimeout = timeoutMinutes(stepBlock(SENTINEL_JOB, SENTINEL_STEP));
    expect(jobTimeout).toBeGreaterThan(0);
    expect(walkTimeout).toBeGreaterThan(0);
    expect(walkTimeout).toBeLessThan(jobTimeout);

    // `verify` no longer pays for the walk at all.
    expect(jobBlock("verify")).not.toContain(SENTINEL_STEP);
    expect(timeoutMinutes(jobBlock("verify"))).toBeGreaterThan(0);
  });

  it("keeps the job required, via the one context branch protection watches", () => {
    const verify = jobBlock("verify");
    expect(verify).toContain(`needs: [${SCOPE_JOB}, ${SENTINEL_JOB}]`);
    // Without `always()` a failed sentinel job *skips* `verify`, and a skipped
    // required check is not a failed one — the pull request could merge with
    // the walk red.
    expect(verify).toContain("if: always()");
    const aggregator = stepBlock("verify", "Fail the job if any gate failed");
    expect(aggregator).toContain(`needs.${SENTINEL_JOB}.result }}" = "failure"`);
    // A filter that never answered must not read as "out of scope".
    expect(aggregator).toContain(`needs.${SCOPE_JOB}.result }}" != "success"`);
    // The gate cannot become advisory by dropping out of the aggregator.
    expect(aggregator).not.toContain(`steps.${SENTINEL_JOB}.outcome`);
  });

  it("filters pull requests by change set, and only pull requests", () => {
    const scopeJob = jobBlock(SCOPE_JOB);
    expect(scopeJob).toContain(`- name: ${SCOPE_STEP}`);
    expect(scopeJob).toContain("id: scope");
    // The verdict is a job output, because the job that consumes it is another job.
    expect(scopeJob).toMatch(/outputs:\s*\n\s+changed: \$\{\{ steps\.scope\.outputs\.changed \}\}/);
    expect(scopeJob).toContain(`./${SCOPE_MODULE}`);
    expect(scopeJob).toContain("/pulls/${number}/files?per_page=100&page=");
    // Non-PR events (push to main, manual dispatch) run the walk outright.
    expect(scopeJob).toContain('eventName !== "pull_request"');
    expect(scopeJob).toContain("the contract has to hold here");
    // The consumer is the walk job, and it is skipped only on an explicit false.
    expect(jobBlock(SENTINEL_JOB)).toContain(
      `if: needs.${SCOPE_JOB}.outputs.changed == 'true'`,
    );
    expect(jobBlock(SENTINEL_JOB)).toContain(`needs: ${SCOPE_JOB}`);
  });

  it("fails closed when the change set cannot be read", () => {
    // Skipping the gate because an API call failed would let a privacy change
    // merge with no browser evidence at all. The verdict is also written to the
    // run summary, because the job acting on it is a different job.
    expect(jobBlock(SCOPE_JOB)).toMatch(/catch \(error\) \{[\s\S]{0,400}?setOutput\(\s*"true"/);
    expect(jobBlock(SCOPE_JOB)).toContain("running the gate");
    expect(jobBlock(SCOPE_JOB)).toContain("GITHUB_STEP_SUMMARY");
  });

  it("starts the app the walk drives and hands it that server's own log", () => {
    // The runner scans the server log and trace for sentinels, so the log it is
    // pointed at has to be the log of the server it drove — a stale or
    // mismatched path would turn the scan vacuous.
    const job = jobBlock(SENTINEL_JOB);
    expect(job).toContain(`npm run dev -- -H 127.0.0.1 -p ${APP_PORT} > ${SERVER_LOG} 2>&1 &`);
    expect(job).toContain(`SENTINEL_APP_BASE: "http://127.0.0.1:${APP_PORT}"`);
    expect(job).toContain(`SENTINEL_SERVER_LOG: \${{ github.workspace }}/${SERVER_LOG}`);
    expect(job).toContain(`SENTINEL_REPORT_PATH: \${{ github.workspace }}/${EVIDENCE_JSON}`);
    expect(job).toContain('echo "CHROME_PATH=$browser" >> "$GITHUB_ENV"');
    // Readiness is checked before the walk, so a dead server is diagnosed as a
    // server problem instead of as a sentinel failure.
    expect(job).toContain(`http://127.0.0.1:${APP_PORT}/api/health`);
    // The job that starts the app also stops it, whether or not the walk passed.
    const stop = stepBlock(SENTINEL_JOB, "Stop the app the walk drove");
    expect(stop).toContain("if: always()");
    expect(stop).toContain("steps.server.outputs.server_pid");
  });

  it("fails rather than skipping when the runner cannot host the walk", () => {
    const job = jobBlock(SENTINEL_JOB);
    expect(job).toContain("No Chrome/Chromium binary on this runner");
    expect(job).toContain("The dev server never answered /api/health");
    // The walk's exit status is what the step reports (pipefail + the pipeline
    // is the last command).
    expect(stepBlock(SENTINEL_JOB, SENTINEL_STEP)).toContain("set -o pipefail");
    expect(stepBlock(SENTINEL_JOB, SENTINEL_STEP)).toContain(`2>&1 | tee ${WALK_LOG}`);
  });

  it("collects the walk's log, verdict and evidence for diagnosis", () => {
    // A finding has to be reviewable from the run itself, and the walk's own
    // progress lines are how a wedged run is told from a slow one — so the
    // phases, heartbeats and stall verdicts go to the run summary, and the log,
    // server log and evidence JSON ride the job's artifact.
    const summary = stepBlock(SENTINEL_JOB, "Summarize where the walk stopped");
    expect(summary).toContain("GITHUB_STEP_SUMMARY");
    expect(summary).toContain("STALLED");
    expect(summary).toContain(WALK_LOG);
    expect(summary).toContain("steps.priv01_sentinel.outcome");

    const upload = stepBlock(SENTINEL_JOB, "Upload the sentinel evidence");
    expect(upload).toContain("if: always()");
    for (const file of [WALK_LOG, SERVER_LOG, EVIDENCE_JSON]) {
      expect(upload).toContain(file);
    }

    // The verifying job still reports the jobs it waits on, since it owns the
    // required context.
    const diagnostics = stepBlock("verify", "Collect diagnostic summary");
    expect(diagnostics).toContain(`needs.${SCOPE_JOB}.result`);
    expect(diagnostics).toContain(`needs.${SENTINEL_JOB}.result`);
  });

  it("declares no advisory steps outside the job that aggregates them", () => {
    // `verify` re-fails its own `continue-on-error` steps by name. A step with
    // that flag in another job would be advisory with nothing to catch it.
    // (tests/ci-gate-wiring.test.ts pins the aggregator itself.)
    for (const job of [SCOPE_JOB, SENTINEL_JOB, "sentinel-acceptance"]) {
      expect(jobBlock(job), `${job} must not claim to be advisory`).not.toContain(
        "continue-on-error: true",
      );
    }
  });

  it("keeps every load-bearing module inside the trigger scope", () => {
    for (const directory of IN_SCOPE_DIRECTORIES) {
      const files = listFiles(directory);
      expect(files.length, `${directory} is missing or empty`).toBeGreaterThan(0);
      const outside = files.filter((file) => !matchesPriv01SentinelScope(file));
      expect(
        outside,
        `${directory} holds files no scope pattern covers, so a change to them would not re-run the sentinel`,
      ).toEqual([]);
    }

    for (const file of IN_SCOPE_FILES) {
      expect(fs.existsSync(path.join(ROOT, file)), `${file} moved or was deleted`).toBe(true);
      expect(matchesPriv01SentinelScope(file), `${file} fell out of the trigger scope`).toBe(true);
    }
  });

  it("leaves unrelated changes alone", () => {
    for (const file of [
      "README.md",
      "docs/privacy-acceptance-contract-2026-10-07.md",
      "docs/master-specification.md",
      "src/lib/kb/schema.ts",
      "src/components/CitationLabel.tsx",
      "tests/clinical-evidence-promotion-batch1.test.ts",
      "tests/doc-lint.test.ts",
      "data/knowledge-base/graph/node.json",
      "e2e/secondary-workflow.mjs",
    ]) {
      expect(matchesPriv01SentinelScope(file), `${file} should not trigger the browser walk`).toBe(
        false,
      );
    }
  });

  it("normalizes the paths the pull-request API reports", () => {
    expect(priv01SentinelScopeMatches(["./src/proxy.ts", "README.md"])).toEqual(["./src/proxy.ts"]);
    expect(
      priv01SentinelScopeMatches([
        "src/lib/evidence/ocr-session.ts",
        "src/app/secondary/evidence/page.tsx",
        "tests/private-context-request-guard.test.ts",
        "public/tesseract/worker-guard.js",
        "src/lib/security/private-context-request-guard.ts",
        "src/lib/kb/graph.ts",
      ]),
    ).toEqual([
      "src/lib/evidence/ocr-session.ts",
      "src/app/secondary/evidence/page.tsx",
      "tests/private-context-request-guard.test.ts",
      "public/tesseract/worker-guard.js",
      "src/lib/security/private-context-request-guard.ts",
    ]);
  });

  it("keeps the gate's description of itself true", () => {
    // The sentinel and the acceptance contract both described it as a
    // maintainer-only gate, then as a step in `verify`. Now that CI enforces it
    // as its own job, a stale claim is the kind of drift this repository pins
    // elsewhere too.
    const sentinel = read("scripts/acceptance-browser-sentinel.mjs");
    expect(sentinel).not.toContain("maintainer gate, not CI");
    expect(sentinel).toContain(".github/workflows/ci.yml");
    expect(sentinel).toContain(SENTINEL_JOB);

    const contract = read("docs/privacy-acceptance-contract-2026-10-07.md");
    expect(contract).not.toContain("maintainer gate, not CI");
    expect(contract).toContain(SENTINEL_STEP);
    expect(contract).not.toContain("Two steps in the required `verify` job");

    const masterSpec = read("docs/master-specification.md");
    expect(masterSpec).toContain("acceptance-browser-sentinel.mjs");
  });

  it("keeps the scope list non-trivial and anchored", () => {
    // A scope that matched everything would defeat the filter; the exact
    // patterns are exercised above, so this only guards the shape.
    expect(PRIV01_SENTINEL_SCOPE.length).toBeGreaterThanOrEqual(10);
    expect(matchesPriv01SentinelScope("")).toBe(false);
  });
});
