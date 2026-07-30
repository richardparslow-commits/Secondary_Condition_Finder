import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Phase 3 Operational Readiness", () => {
  it("verifies backlog tracker and SME guide exist", () => {
    const tracker = path.join(process.cwd(), "draft-backlog-tracker.csv");
    const guide = path.join(process.cwd(), "docs/SME-AUTHORING-GUIDE.md");
    
    expect(fs.existsSync(tracker)).toBe(true);
    expect(fs.existsSync(guide)).toBe(true);
  });
});
