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
 * occasionally-run script, three things have to stay true in CI:
 *
 *   1. It runs as its own named step whose outcome re-fails the job, and it
 *      fails instead of silently skipping when the runner cannot host it — a
 *      green `verify` must mean the walk actually happened.
 *   2. It runs wherever the browser-local privacy posture can change (the
 *      workflow, its state modules, the refusal layer, the local OCR assets,
 *      the contract suites), and is skipped only when none of them are touched.
 *   3. The trigger scope itself stays complete: this test walks the
 *      load-bearing directories on disk, so a new privacy-bearing module that
 *      no scope pattern covers fails the suite instead of quietly falling
 *      outside the gate.
 */

const ROOT = process.cwd();
const CI = read(".github/workflows/ci.yml");
const SCOPE_MODULE = "scripts/priv01-sentinel-scope.mjs";
const SENTINEL_STEP = "Run PRIV-01 stage-4 browser sentinel";
const SCOPE_STEP = "Detect PRIV-01 sentinel scope changes";
const SERVER_LOG = "ci-priv01-sentinel-server.log";
const EVIDENCE_JSON = "ci-priv01-sentinel-evidence.json";
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
  SCOPE_MODULE,
  "scripts/build-client-corpus.mjs",
  ".github/workflows/ci.yml",
];

describe("PRIV-01 sentinel CI gate", () => {
  it("runs the stage-4 sentinel as an enforced, attributable step", () => {
    expect(CI, "ci.yml lost the PRIV-01 sentinel step").toContain(`- name: ${SENTINEL_STEP}`);
    expect(CI).toContain("node scripts/acceptance-browser-sentinel.mjs");
    expect(CI).toContain("id: priv01_sentinel");
    expect(CI).toContain("continue-on-error: true");
    // The job aggregates every continue-on-error gate; this is the explicit pin
    // for this gate so removing it is a deliberate change, not an accident.
    expect(CI).toContain('steps.priv01_sentinel.outcome }}" = "failure"');
  });

  it("starts the app the walk drives and hands it that server's own log", () => {
    // The runner scans the server log and trace for sentinels, so the log it is
    // pointed at has to be the log of the server it drove — a stale or
    // mismatched path would turn the scan vacuous.
    expect(CI).toContain(`npm run dev -- -H 127.0.0.1 -p ${APP_PORT} > ${SERVER_LOG} 2>&1 &`);
    expect(CI).toContain(`SENTINEL_APP_BASE="http://127.0.0.1:${APP_PORT}"`);
    expect(CI).toContain(`SENTINEL_SERVER_LOG="$PWD/${SERVER_LOG}"`);
    expect(CI).toContain(`SENTINEL_REPORT_PATH="$PWD/${EVIDENCE_JSON}"`);
    expect(CI).toContain('CHROME_PATH="$browser"');
    // Readiness is checked before the walk, so a dead server is diagnosed as a
    // server problem instead of as a sentinel failure.
    expect(CI).toContain(`http://127.0.0.1:${APP_PORT}/api/health`);
    // The evidence rides the diagnostics artifact: a leak finding has to be
    // reviewable from the run, not only from a surviving workspace.
    expect(CI).toContain(EVIDENCE_JSON);
  });

  it("fails rather than skipping when the runner cannot host the walk", () => {
    // A missing browser or an unhealthy server must not leave the gate green:
    // both branches exit non-zero, and the sentinel's own exit status is what
    // the step reports (pipefail + the pipeline is the last command).
    expect(CI).toContain("No Chrome/Chromium binary on this runner");
    expect(CI).toContain("The dev server never answered /api/health");
    const step = CI.slice(CI.indexOf(`- name: ${SENTINEL_STEP}`));
    expect(step.slice(0, step.indexOf("- name: Collect diagnostic summary"))).toContain(
      "set -o pipefail",
    );
  });

  it("runs for every change that can move the browser-local posture", () => {
    expect(CI, "ci.yml lost the sentinel scope-detection step").toContain(`- name: ${SCOPE_STEP}`);
    expect(CI).toContain("id: priv01_scope");
    // Pull requests are filtered by their actual change set …
    expect(CI).toContain("if: github.event_name == 'pull_request'");
    expect(CI).toContain(`./${SCOPE_MODULE}`);
    expect(CI).toContain("/pulls/${number}/files?per_page=100&page=");
    // … while every non-PR event (push to main, manual dispatch) runs the gate
    // unconditionally, because that is where the contract has to hold.
    expect(CI).toContain(
      "steps.build.outcome == 'success' && (github.event_name != 'pull_request' || steps.priv01_scope.outputs.changed == 'true')",
    );
  });

  it("fails closed when the change set cannot be read", () => {
    // Skipping the gate because an API call failed would let a privacy change
    // merge with no browser evidence at all.
    expect(CI).toMatch(/catch \(error\) \{[\s\S]{0,400}?setOutput\(\s*"true"/);
    expect(CI).toContain("running the gate");
  });

  it("collects the gate's log, outcome and evidence for diagnosis", () => {
    expect(CI).toContain("ci-priv01-sentinel.log");
    expect(CI).toContain("ci-priv01-scope.log");
    expect(CI).toContain('echo "- priv01-sentinel: ${{ steps.priv01_sentinel.outcome }}"');
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
    // maintainer-only gate. Now that CI enforces it, that claim would be
    // false, and a false contract claim is the kind of drift this repository
    // pins elsewhere too.
    const sentinel = read("scripts/acceptance-browser-sentinel.mjs");
    expect(sentinel).not.toContain("maintainer gate, not CI");
    expect(sentinel).toContain(".github/workflows/ci.yml");

    const contract = read("docs/privacy-acceptance-contract-2026-10-07.md");
    expect(contract).not.toContain("maintainer gate, not CI");
    expect(contract).toContain(SENTINEL_STEP);

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
