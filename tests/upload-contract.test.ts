import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("P2 Ticket 7: Upload Step Product Contract", () => {
  it("defines strict non-retentive privacy rules on the upload route", () => {
    const pagePath = path.join(process.cwd(), "src/app/secondary/upload/page.tsx");
    expect(fs.existsSync(pagePath)).toBe(true);

    const content = fs.readFileSync(pagePath, "utf8");
    expect(content).toContain("Evidence Upload Privacy Contract");
    expect(content).toContain("strictly optional");
    expect(content).toContain("raw text logs");
  });
});
