import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Knowledge-base integrity", () => {
  it("passes the complete catalog and knowledge-base integrity audit", () => {
    const script = path.join(process.cwd(), "scripts/validate-knowledge-base.js");
    const output = execFileSync(process.execPath, [script], { encoding: "utf8" });
    const report = JSON.parse(output);

    expect(report.knowledgeBaseFiles).toBeGreaterThan(0);
    expect(report.catalogFiles).toBeGreaterThan(0);
    expect(report.catalogConditions).toBeGreaterThan(0);
    expect(report.errors).toEqual([]);
  });
});
