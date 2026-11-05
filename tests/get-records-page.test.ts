import { describe, expect, it } from "vitest";
import fs from "node:fs";

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(`${process.cwd()}/${relativePath}`, "utf8");
}

describe("standalone /get-records walkthrough page", () => {
  it("renders the shared walkthrough component with standalone boundary copy", () => {
    const page = readRepoFile("src/app/get-records/page.tsx");

    expect(page).toContain('import { VaGovRecordWalkthrough } from "@/components/secondary/VaGovRecordWalkthrough";');
    expect(page).toContain("<VaGovRecordWalkthrough evidenceAnalyzerOnPage={false} />");
    // The page carries its own explicit no-credential boundary.
    expect(page).toContain("never asks");
    expect(page).toContain("for, receives, or stores your VA.gov or ID.me credentials, multi-factor codes, or");
    // Onward actions: into the workflow and to the privacy policy.
    expect(page).toContain('href="/secondary"');
    expect(page).toContain('href="/privacy"');
    expect(page).toContain("DisclaimerFooter");
    // No data fetching or credential forms on the standalone page either.
    expect(page).not.toContain("fetch(");
    expect(page).not.toMatch(/type=["']password["']/);
  });

  it("surfaces the walkthrough from the home page utility nav and utility section", () => {
    const home = readRepoFile("src/app/page.tsx");

    expect(home).toContain('<Link href="/get-records">Get Your VA Medical Record</Link>');
    expect(home).toContain('href="/get-records"');
    expect(home).toContain("Get Your VA Medical Record");
    expect(home).toContain("Open the guided download walkthrough");
    // Boundary phrasing on the home card too.
    expect(home).toContain("The app never sees your credentials.");
  });
});
