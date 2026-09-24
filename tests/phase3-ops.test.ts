import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Phase 3 Operational Readiness", () => {
  it("defines an auditable backlog schema and required SOP", () => {
    const tracker = path.join(process.cwd(), "draft-backlog-tracker.csv");
    const guide = path.join(process.cwd(), "docs/SME-AUTHORING-GUIDE.md");
    const sop = path.join(process.cwd(), "docs/citation-verification-sop.md");

    expect(fs.existsSync(tracker)).toBe(true);
    expect(fs.existsSync(guide)).toBe(true);
    expect(fs.existsSync(sop)).toBe(true);

    const header = fs.readFileSync(tracker, "utf8").split(/\r?\n/, 1)[0];
    expect(header.split(",").map((cell) => cell.replaceAll("\"", ""))).toEqual([
      "Condition ID",
      "Body System",
      "Status",
      "Assigned To",
      "Due Date",
      "Publish Gate",
      "Verification Status",
      "Last Verified",
      "Notes",
    ]);
  });

  it("keeps the tracker generator aligned with the required P3 fields", () => {
    const generator = fs.readFileSync(
      path.join(process.cwd(), "scripts/generate-authoring-tracker.js"),
      "utf8",
    );

    for (const field of [
      "Condition ID",
      "Body System",
      "Status",
      "Assigned To",
      "Due Date",
      "Publish Gate",
      "Verification Status",
      "Last Verified",
      "Notes",
    ]) {
      expect(generator).toContain(field);
    }

    expect(generator).toContain('"unassigned"');
    expect(generator).toContain('"TBD"');
    expect(generator).toContain("SME review + citation verification + phase gate");
  });

  it("documents the citation carry-forward rule", () => {
    const sop = fs.readFileSync(
      path.join(process.cwd(), "docs/citation-verification-sop.md"),
      "utf8",
    );

    expect(sop).toContain("verified: false");
    expect(sop).toContain("sourceCheckedOn");
    expect(sop).toContain("primary source");
    expect(sop).toContain("Do not promote it to `verified` based on inference");
  });
});
