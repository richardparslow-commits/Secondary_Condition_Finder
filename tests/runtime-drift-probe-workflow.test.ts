import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
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
    const checks = read(".github/workflows/production-runtime-readiness.yml");

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
