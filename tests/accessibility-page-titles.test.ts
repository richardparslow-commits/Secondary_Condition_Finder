import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const EXPECTED_PAGE_TITLES = [
  ["src/app/about/page.tsx", "About | Secondary Condition Finder"],
  ["src/app/terms/page.tsx", "Terms | Secondary Condition Finder"],
  ["src/app/secondary/page.tsx", "Secondary Workflow | Secondary Condition Finder"],
  ["src/app/secondary/diagnosed/page.tsx", "Diagnosed Conditions | Secondary Condition Finder"],
  ["src/app/secondary/service-connected/page.tsx", "Service-Connected Conditions | Secondary Condition Finder"],
  ["src/app/secondary/upload/page.tsx", "Supporting Documents | Secondary Condition Finder"],
  ["src/app/presumptive/page.tsx", "Presumptive Research | Secondary Condition Finder"],
  ["src/app/va-forms/page.tsx", "VA Form Reference | Secondary Condition Finder"],
  ["src/app/va-reference/page.tsx", "Disability Reference | Secondary Condition Finder"],
] as const;

const EXPECTED_LAYOUT_TITLES = [
  ["src/app/privacy/layout.tsx", "Privacy | Secondary Condition Finder"],
  ["src/app/secondary/layout.tsx", "Secondary Workflow | Secondary Condition Finder"],
] as const;

describe("manual accessibility route document titles", () => {
  it("keeps the home title descriptive without adding a redundant suffix", () => {
    const source = read("src/app/layout.tsx");
    expect(source).toContain('title: "Secondary Condition Finder"');
  });

  it.each(EXPECTED_PAGE_TITLES)("publishes the expected page title in %s", (sourcePath, title) => {
    const source = read(sourcePath);
    expect(source).toContain(`title: "${title}"`);
  });

  it.each(EXPECTED_LAYOUT_TITLES)("publishes the expected inherited title in %s", (sourcePath, title) => {
    const source = read(sourcePath);
    expect(source).toContain(`title: "${title}"`);
  });

  it("covers every manual review route with either a route title or an explicit route-group title", () => {
    const titleOwnerByRoute = new Map<string, string>([
      ["/", "src/app/layout.tsx"],
      ["/about", "src/app/about/page.tsx"],
      ["/privacy", "src/app/privacy/layout.tsx"],
      ["/terms", "src/app/terms/page.tsx"],
      ["/secondary", "src/app/secondary/page.tsx"],
      ["/secondary/diagnosed", "src/app/secondary/diagnosed/page.tsx"],
      ["/secondary/service-connected", "src/app/secondary/service-connected/page.tsx"],
      ["/secondary/ratings", "src/app/secondary/layout.tsx"],
      ["/secondary/upload", "src/app/secondary/upload/page.tsx"],
      ["/secondary/suggestions", "src/app/secondary/layout.tsx"],
      ["/secondary/evidence", "src/app/secondary/layout.tsx"],
      ["/presumptive", "src/app/presumptive/page.tsx"],
      ["/va-forms", "src/app/va-forms/page.tsx"],
      ["/va-reference", "src/app/va-reference/page.tsx"],
    ]);

    expect([...titleOwnerByRoute.keys()]).toEqual([
      "/",
      "/about",
      "/privacy",
      "/terms",
      "/secondary",
      "/secondary/diagnosed",
      "/secondary/service-connected",
      "/secondary/ratings",
      "/secondary/upload",
      "/secondary/suggestions",
      "/secondary/evidence",
      "/presumptive",
      "/va-forms",
      "/va-reference",
    ]);

    for (const sourcePath of titleOwnerByRoute.values()) {
      expect(read(sourcePath)).toMatch(/title:\s*"[^"]+"/);
    }
  });
});
