import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("P0 Ticket 2: Secondary Landing Explainer & CTA Flow", () => {
  it("contains required caused vs aggravated distinction and canonical legal references", () => {
    const pagePath = path.join(process.cwd(), "src/app/secondary/page.tsx");
    expect(fs.existsSync(pagePath)).toBe(true);

    const content = fs.readFileSync(pagePath, "utf8");
    expect(content).toContain("Caused By");
    expect(content).toContain("Aggravated By");
    expect(content).toContain("38 CFR § 3.310(a)");
    expect(content).toContain("38 CFR § 3.310(b)");
  });

  it("provides an obvious proceed CTA linking directly to Step 1", () => {
    const pagePath = path.join(process.cwd(), "src/app/secondary/page.tsx");
    const content = fs.readFileSync(pagePath, "utf8");
    expect(content).toContain("href=\"/secondary/diagnosed\"");
    expect(content).toContain("Click Here to Proceed to Wizard Step 1");
  });
});
