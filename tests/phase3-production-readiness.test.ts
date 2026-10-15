import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import AboutPage from "@/app/about/page";
import HomePage from "@/app/page";

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Phase 3 production-access package contracts", () => {
  it("publishes a product description with explicit end-user and scope boundaries", () => {
    const about = renderToStaticMarkup(AboutPage());

    expect(about).toContain("The primary end user is a Veteran");
    expect(about).toContain("does not diagnose medical conditions");
    expect(about).toContain("does not access an individual Veteran");
    expect(about).toContain('href="/privacy"');
    expect(about).toContain('href="/terms"');
  });

  it("keeps the public product description discoverable from home", () => {
    const home = renderToStaticMarkup(HomePage());
    expect(home).toContain('href="/about"');
  });

  it("limits the production request to the two implemented open-data services", () => {
    const request = readRepoFile("docs/phase3-production-access-package.md");

    expect(request).toContain("VA Forms API — Open Data");
    expect(request).toContain("Benefits Reference Data API — Open Data");
    expect(request).toContain("APIs deliberately not requested");
    expect(request).toContain("Benefits Intake, Benefits Claims, Benefits Documents");
  });

  it("describes the current VA product surfaces and preserves algorithm isolation", () => {
    const request = readRepoFile("docs/phase3-production-access-package.md");
    const checklist = readRepoFile("docs/phase3-submission-checklist.md");
    const demo = readRepoFile("docs/phase3-demo-script.md");

    for (const text of [request, checklist, demo]) {
      expect(text).toContain("/va-forms/finder");
      expect(text).toContain("/va-reference/service-branches");
    }

    expect(request).toContain("VA reference data is deliberately separated from medical/evidence decision logic");
    expect(request).toContain("secondary recommendations are computed independently");
    expect(request).toContain("`matchPresumptives()` does not consume service-branch reference context");
    expect(checklist).toContain("VA reference terminology does not change recommendation rank");
    expect(demo).toContain("the reference block does not affect rank, evidence strength, nexus reasoning");
  });

  it("keeps completed public sandbox evidence distinct from pending account and human gates", () => {
    const request = readRepoFile("docs/phase3-production-access-package.md");
    const checklist = readRepoFile("docs/phase3-submission-checklist.md");
    const audit = readRepoFile("docs/phase2-completion-audit.md");
    const gates = readRepoFile("docs/external-manual-gates-status.md");

    expect(request).toContain("evidence recorded for closed issue #189");
    expect(request).toContain("not part of this production request");
    expect(gates).toContain("Synthetic provider tests establish code behavior only");
    expect(checklist).toContain("- [x] Issue #189 is closed with sanitized credentialed sandbox success evidence for VA Forms and Benefits Reference Data.");
    expect(gates).toMatch(/Issue #189[\s\S]*COMPLETE \/ CLOSED/i);
    expect(gates).toMatch(/Issue #195[\s\S]*OPEN \/ HUMAN-ONLY/i);
    expect(audit).toContain("Phase 2 external completion status: PENDING ONE EXTERNAL GATE");
    expect(audit).toContain("it now has one successful credentialed run on `main`");
  });

  it("labels historical Vercel checkpoints honestly and requires exact-build submission verification", () => {
    const request = readRepoFile("docs/phase3-production-access-package.md");
    const checklist = readRepoFile("docs/phase3-submission-checklist.md");
    const phasePlan = readRepoFile("docs/phase-plan.md");

    for (const text of [request, checklist, phasePlan]) {
      expect(text).toContain("193f26030b9b90b81c832c6a645f179717abf307");
      expect(text).toContain("CI #797");
      expect(text).toContain("dpl_BwX77rhfw5Bank2oRe3zjgYaykR6");
      expect(text).toContain("Production Runtime Readiness #156");
    }

    expect(checklist).toContain("Historical production checkpoint — not current submission proof");
    expect(checklist).toContain("resolve and verify the exact final submission build");
    expect(request).toContain("not independently reverified");
    expect(request).toContain("not a VA production grant or live VA production connectivity proof");
  });

  it("documents service-specific sandbox and production credentials", () => {
    const request = readRepoFile("docs/phase3-production-access-package.md");
    const checklist = readRepoFile("docs/phase3-submission-checklist.md");

    for (const text of [request, checklist]) {
      expect(text).toContain("VA_API_ENV=sandbox|production");
      expect(text).toContain("VA_API_ENABLED=true");
      expect(text).toContain("VA_FORMS_SANDBOX_API_KEY");
      expect(text).toContain("VA_BENEFITS_REFERENCE_SANDBOX_API_KEY");
      expect(text).toContain("VA_FORMS_PRODUCTION_API_KEY");
      expect(text).toContain("VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY");
    }
  });

  it("does not overstate accessibility readiness", () => {
    const request = readRepoFile("docs/phase3-production-access-package.md");
    const checklist = readRepoFile("docs/phase3-submission-checklist.md");
    const accessibility = readRepoFile("docs/accessibility-audit.md");

    expect(request).toContain("not a conformance certification");
    expect(request).toContain("complete issue #195");
    expect(checklist).toContain("- [ ] Issue #195 is closed with recorded manual Section 508/accessibility evidence");
    expect(accessibility).toContain("PARTIAL EVIDENCE — MANUAL CONFORMANCE REVIEW PENDING");
    expect(accessibility).toContain("https://secondary-condition-finder.vercel.app");
  });

  it.each([
    { issue: 189, status: "COMPLETE / CLOSED", securityStatus: "CLOSED" },
    { issue: 195, status: "OPEN / HUMAN-ONLY", securityStatus: "OPEN" },
    { issue: 213, status: "COMPLETE / CLOSED", securityStatus: "CLOSED" },
    { issue: 287, status: "CLOSED / NOT PURSUED", securityStatus: "CLOSED" },
    { issue: 537, status: "CLOSED / RECORDED WITH RESIDUAL ACCEPTED", securityStatus: "CLOSED" },
    { issue: 538, status: "CLOSED / RECORDED WITH RESIDUAL ACCEPTED", securityStatus: "CLOSED" },
    { issue: 539, status: "OPEN / CHANNEL UNVERIFIED", securityStatus: "OPEN / CHANNEL UNVERIFIED" },
  ])("names the accountable owner for R-04 gate #$issue in the register and runbooks", ({ issue, status, securityStatus }) => {
    const gates = readRepoFile("docs/external-manual-gates-status.md");
    const deployment = readRepoFile("docs/deployment-readiness.md");
    const security = readRepoFile("docs/security-operations.md");
    const issueUrl = `https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/${issue}`;

    // Bound each assertion to its own gate: another gate's owner or status
    // must not make an unowned/mislabelled row pass.
    const section = gates.split(`## Issue #${issue} — `)[1]?.split("\n## ")[0];
    expect(section, `missing gate section #${issue}`).toBeDefined();
    expect(section).toContain(status);
    expect(section).toContain("Richard Parslow (`richardparslow-commits`)");

    const register = gates.split("## R-04 ownership register")[1]?.split("\n## ")[0];
    const registerRows = register?.split("\n").filter((line) => line.startsWith("| ") && line.includes(`](${issueUrl})`));
    expect(registerRows).toHaveLength(1);
    const registerCells = registerRows![0]!.split("|").map((cell) => cell.trim());
    expect(registerCells[3]).toContain(status);
    expect(registerCells[4]).toContain("Richard Parslow (`richardparslow-commits`)");
    expect(registerCells[6]).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(registerCells[7]).not.toBe("");
    expect(registerCells[8]).not.toBe("");

    const boundary = deployment.split("## Known external verification boundaries")[1];
    const runbookRows = boundary?.split("\n").filter((line) => line.startsWith("| ") && line.includes(`](${issueUrl})`));
    expect(runbookRows).toHaveLength(1);
    const runbookCells = runbookRows![0]!.split("|").map((cell) => cell.trim());
    expect(runbookCells[3]).toBe(status);
    expect(runbookCells[4]).toBe("Richard Parslow (`richardparslow-commits`)");
    expect(runbookCells[5]).not.toBe("");

    const securityBoundary = security.split("## External gates")[1];
    const securityRows = securityBoundary?.split("\n").filter((line) => line.startsWith(`- **#${issue} — `));
    expect(securityRows).toHaveLength(1);
    expect(securityRows![0]).toContain(`:** ${securityStatus}; Richard Parslow`);
  });

  it("requires explicit ownership handoff without substituting assignment for human evidence", () => {
    const deployment = readRepoFile("docs/deployment-readiness.md").split("## Known external verification boundaries")[1];
    const security = readRepoFile("docs/security-operations.md").split("## External gates")[1];

    for (const boundary of [deployment, security]) {
      expect(boundary).toContain("named successor");
      expect(boundary).toMatch(/escalat/i);
      expect(boundary).toContain("independent tester");
      expect(boundary).toContain("separate legal approver");
    }
    expect(deployment).toContain("Never close a gate merely because ownership is recorded");
    expect(security).toContain("This ownership update closes no human/operator gate");
    expect(security).not.toContain("#189 remains the deferred");
  });

  it("covers VA review fields without inventing unresolved applicant facts", () => {
    const request = readRepoFile("docs/phase3-production-access-package.md");
    const checklist = readRepoFile("docs/phase3-submission-checklist.md");

    expect(request).toContain("Do not invent a revenue model");
    expect(checklist).toContain("Do not infer or invent organization, revenue, compliance, or certification facts");
  });

  it("provides a bounded demo with no real Veteran data and no stale event-logger claim", () => {
    const demo = readRepoFile("docs/phase3-demo-script.md");

    expect(demo).toContain("30–60 minute walkthrough");
    expect(demo).toContain("Do not use real Veteran PII, PHI");
    expect(demo).toContain("allowlisted operational workflow/recommendation count/status events enter server logs");
    expect(demo).not.toContain("no persistent workflow/recommendation event-history logger");
    expect(demo).toContain("no real Veteran PII/PHI or credential appears on screen");
    expect(demo).not.toContain("aggregate-only recommendation-event metrics");
  });
});
