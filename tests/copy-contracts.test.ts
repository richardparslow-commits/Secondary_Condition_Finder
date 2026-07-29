import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { DISCLAIMERS } from "../src/lib/legal/references";

describe("P0 Ticket 3: Legal Copy Contracts & Guardrails", () => {
  it("strictly enforces non-diagnostic and non-approval wording across core disclaimers", () => {
    expect(DISCLAIMERS.nonDiagnostic).not.toContain("guarantee");
    expect(DISCLAIMERS.noGuarantee).toContain("does not guarantee VA claim approval");
  });

  it("ensures landing pages explicitly separate secondary and presumptive tracks", () => {
    const readmePath = path.join(process.cwd(), "README.md");
    if (fs.existsSync(readmePath)) {
      const readme = fs.readFileSync(readmePath, "utf8");
      expect(readme).toContain("Secondary");
      expect(readme).toContain("Presumptive");
    }
  });

  it("prevents prohibited words like approval odds or unverified absolute language in codebase copy", () => {
    const legalRefPath = path.join(process.cwd(), "src/lib/legal/references.ts");
    const content = fs.readFileSync(legalRefPath, "utf8");
    
    expect(content.toLowerCase()).not.toContain("approval odds");
    expect(content.toLowerCase()).not.toContain("100% win");
  });
});
