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

  it("limits the initial production request to the two implemented open-data APIs", () => {
    const request = readRepoFile("docs/phase3-production-access-package.md");

    expect(request).toContain("VA Forms API — Open Data");
    expect(request).toContain("Benefits Reference Data API — Open Data");
    expect(request).toContain("APIs deliberately not requested");
    expect(request).toContain("excludes Benefits Intake, Benefits Claims, Benefits Documents");
  });

  it("records completed sandbox validation without overstating accessibility readiness", () => {
    const request = readRepoFile("docs/phase3-production-access-package.md");
    const checklist = readRepoFile("docs/phase3-submission-checklist.md");

    expect(request).toContain("Credentialed sandbox validation is complete and issue #189 is closed");
    expect(checklist).toContain("Issue #189 is closed");
    expect(checklist).toContain("Credentialed sandbox validation is complete and issue #189 is closed");
    expect(request).toContain("This is not a conformance certification");
    expect(request).toContain("complete issue #195");
    expect(checklist).toContain("No claim is made that Section 508 conformance is complete unless issue #195 is closed with objective evidence");
  });

  it("covers VA review fields without inventing unresolved applicant facts", () => {
    const request = readRepoFile("docs/phase3-production-access-package.md");
    const checklist = readRepoFile("docs/phase3-submission-checklist.md");

    expect(request).toContain("Do not invent a revenue model");
    expect(request).toContain("Section 508 / accessibility response");
    expect(request).toContain("Security and incident-response response");
    expect(request).toContain("Vulnerability management response");
    expect(checklist).toContain("Do not infer or invent an organization, revenue model, or compliance status");
  });

  it("provides a bounded 30–60 minute demo with no real Veteran data", () => {
    const demo = readRepoFile("docs/phase3-demo-script.md");

    expect(demo).toContain("30–60 minute walkthrough");
    expect(demo).toContain("Do not use a real Veteran's PII, PHI");
    expect(demo).toContain("Why only two APIs");
    expect(demo).toContain("no real Veteran PII/PHI or secret credential appears on screen");
  });
});
