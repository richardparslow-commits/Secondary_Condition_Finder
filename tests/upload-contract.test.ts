import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("P2 Ticket 7: Evidence Review Product Contract", () => {
  it("defines strict non-retentive privacy rules on the upload route", () => {
    const pagePath = path.join(process.cwd(), "src/components/secondary/steps/UploadStep.tsx");
    expect(fs.existsSync(pagePath)).toBe(true);

    const content = fs.readFileSync(pagePath, "utf8");
    expect(content).toContain("Evidence Upload Privacy Contract");
    expect(content).toContain("strictly optional");
    expect(content).toContain("raw text logs");
    expect(content).toContain("Raw medical document content is not sent to this application server");
    expect(content).toContain("LocalEvidenceAnalyzer");
  });

  it("keeps local evidence excerpts out of every workflow state carrier", () => {
    const statePath = path.join(process.cwd(), "src/lib/secondary-workflow/state.ts");
    const stepPath = path.join(
      process.cwd(),
      "src/components/secondary/steps/UploadStep.tsx",
    );
    const clientStepsPath = path.join(
      process.cwd(),
      "src/lib/secondary-workflow/client-steps.ts",
    );
    const state = fs.readFileSync(statePath, "utf8");
    const step = fs.readFileSync(stepPath, "utf8");
    const clientSteps = fs.readFileSync(clientStepsPath, "utf8");

    for (const source of [state, step, clientSteps]) {
      expect(source).not.toContain("evidenceExcerpt");
      expect(source).not.toContain("documentText");
    }
  });

  it("surfaces local excerpts only through browser session storage", () => {
    const analyzerPath = path.join(process.cwd(), "src/components/evidence/LocalEvidenceAnalyzer.tsx");
    const reviewPath = path.join(process.cwd(), "src/components/evidence/LocalEvidenceReview.tsx");
    const analyzer = fs.readFileSync(analyzerPath, "utf8");
    const review = fs.readFileSync(reviewPath, "utf8");

    expect(analyzer).toContain("window.sessionStorage");
    expect(review).toContain("window.sessionStorage");
    expect(analyzer).not.toContain("fetch(");
    expect(review).not.toContain("fetch(");
  });
});
