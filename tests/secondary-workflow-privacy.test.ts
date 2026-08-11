import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflowPages = [
  "src/app/secondary/diagnosed/page.tsx",
  "src/app/secondary/service-connected/page.tsx",
  "src/app/secondary/ratings/page.tsx",
  "src/app/secondary/upload/page.tsx",
  "src/app/secondary/suggestions/page.tsx",
  "src/app/secondary/evidence/page.tsx",
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("secondary workflow privacy", () => {
  it("does not propagate sensitive workflow state through URLs", () => {
    for (const file of workflowPages) {
      const source = read(file);
      expect(source).not.toContain("workflowStateToSearchParams");
      expect(source).not.toMatch(/method=["']get["']/i);
      expect(source).not.toMatch(/secondary\/(?:diagnosed|service-connected|ratings|upload|suggestions|evidence)\?[^\n]*(?:diagnosed|serviceConnected|rating-)/);
    }
  });

  it("stores workflow state in a short-lived hardened first-party cookie", () => {
    const source = read("src/lib/secondary-workflow/session.ts");
    expect(source).toContain("httpOnly: true");
    expect(source).toContain('sameSite: "strict"');
    expect(source).toContain('path: "/secondary"');
    expect(source).toContain("30 * 60");
  });

  it("disables automatic telemetry route and network tracking", () => {
    const source = read("src/lib/appInsights.ts");
    expect(source).toContain("enableAutoRouteTracking: false");
    expect(source).toContain("disableAjaxTracking: true");
    expect(source).toContain("disableFetchTracking: true");
  });
});
