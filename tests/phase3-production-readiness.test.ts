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

  it("keeps credentialed sandbox validation pending until objective evidence exists", () => {
    const request = readRepoFile("docs/phase3-production-access-package.md");
    const checklist = readRepoFile("docs/phase3-submission-checklist.md");
    const audit = readRepoFile("docs/phase2-completion-audit.md");
    const gates = readRepoFile("docs/external-manual-gates-status.md");

    expect(request).toContain("Credentialed live sandbox proof in issue #189");
    expect(checklist).toContain("- [x] Issue #189 is closed with sanitized credentialed sandbox success evidence for VA Forms and Benefits Reference Data.");
    expect(gates).toMatch(/Issue #189[\s\S]*COMPLETE \/ CLOSED/i);
    expect(gates).toMatch(/Issue #195[\s\S]*OPEN \/ HUMAN-ONLY/i);
    expect(audit).toContain("Phase 2 external completion status: PENDING ONE EXTERNAL GATE");
    expect(audit).toContain("it now has one successful credentialed run on `main`");
  });

  it("records the current Vercel checkpoint while requiring fresh submission-time verification", () => {
    const request = readRepoFile("docs/phase3-production-access-package.md");
    const checklist = readRepoFile("docs/phase3-submission-checklist.md");
    const phasePlan = readRepoFile("docs/phase-plan.md");

    for (const text of [request, checklist, phasePlan]) {
      expect(text).toContain("193f26030b9b90b81c832c6a645f179717abf307");
      expect(text).toContain("CI #797");
      expect(text).toContain("dpl_BwX77rhfw5Bank2oRe3zjgYaykR6");
      expect(text).toContain("Production Runtime Readiness #156");
    }

    expect(checklist).toContain("these checks must be repeated for the final submission commit");
    expect(request).toContain("not a permanent submission-time guarantee");
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
    expect(demo).toContain("no persistent workflow/recommendation event-history logger");
    expect(demo).toContain("no real Veteran PII/PHI or credential appears on screen");
    expect(demo).not.toContain("aggregate-only recommendation-event metrics");
  });
});
