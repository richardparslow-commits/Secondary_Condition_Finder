import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("app layout design contract", () => {
  it("uses the approved accessible color palette and desktop canvas", () => {
    const css = read("src/app/globals.css").toLowerCase();

    expect(css).toContain("--background: #f8fafc");
    expect(css).toContain("--surface: #ffffff");
    expect(css).toContain("--foreground: #0f172a");
    expect(css).toContain("--primary: #1d4ed8");
    expect(css).toContain("--primary-hover: #1e3a8a");
    expect(css).toContain("width: min(100%, 1200px)");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("prefers-reduced-motion");
  });

  it("does not constrain the root application to the old narrow layout", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain('className="app-shell"');
    expect(layout).not.toContain("max-w-3xl");
  });

  it("applies the shared mockup layout to key research routes", () => {
    const pages = [
      "src/app/page.tsx",
      "src/app/secondary/page.tsx",
      "src/app/secondary/condition-caused-by/page.tsx",
      "src/app/secondary/condition-aggravation/page.tsx",
      "src/app/presumptive/page.tsx",
      "src/app/secondary/diagnosed/page.tsx",
      "src/app/secondary/service-connected/page.tsx",
      "src/app/secondary/ratings/page.tsx",
      "src/app/secondary/upload/page.tsx",
      "src/app/secondary/suggestions/page.tsx",
      "src/app/secondary/evidence/page.tsx",
    ];

    for (const page of pages) {
      const source = read(page);
      expect(source, page).toContain("page-hero");
      expect(source, page).toContain("ui-card");
    }
  });

  it("keeps the real six-step secondary workflow visible instead of mockup-only step semantics", () => {
    expect(read("src/app/secondary/diagnosed/page.tsx")).toContain("Step 1 of 6");
    expect(read("src/app/secondary/service-connected/page.tsx")).toContain("Step 2 of 6");
    expect(read("src/app/secondary/ratings/page.tsx")).toContain("Step 3 of 6");
    expect(read("src/app/secondary/upload/page.tsx")).toContain("Step 4 of 6");
    expect(read("src/app/secondary/suggestions/page.tsx")).toContain("Step 5 of 6");
    expect(read("src/app/secondary/evidence/page.tsx")).toContain("Step 6 of 6");
  });
});
