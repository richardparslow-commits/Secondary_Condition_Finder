import fs from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "@/proxy";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("low-severity audit remediations", () => {
  it("uses an immutable checkout pin in the secret-bearing legacy Azure workflow", () => {
    const workflow = read(".github/workflows/azure-static-web-apps-gentle-tree-04b340f0f.yml");

    expect(workflow).toContain(
      "actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09",
    );
    expect(workflow).not.toMatch(/actions\/checkout@v\d+/);
  });

  it("emits a nonce-based production script policy without unsafe-inline", () => {
    const response = proxy(new NextRequest("https://example.test/secondary"));
    const csp = response.headers.get("Content-Security-Policy");

    expect(csp).toBeTruthy();
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("connect-src 'self'");
  });

  it("does not force request-time rendering in the root layout", () => {
    const layout = read("src/app/layout.tsx");

    expect(layout).not.toContain('import { connection } from "next/server"');
    expect(layout).not.toContain("await connection()");
  });

  it("does not ship the previously ambiguous browser telemetry initializer", () => {
    const layout = read("src/app/layout.tsx");

    expect(layout).not.toContain("AppInsightsInit");
    expect(fs.existsSync(path.join(process.cwd(), "src/lib/appInsights.ts"))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), "src/components/AppInsightsInit.tsx"))).toBe(false);
  });

  it("removes the dormant denylist event-sanitizer API", () => {
    expect(
      fs.existsSync(path.join(process.cwd(), "src/lib/events/privacy-guard.ts")),
    ).toBe(false);
  });

  it("does not expose a workflow-state-to-URL serializer", async () => {
    const stateModule = await import("@/lib/secondary-workflow/state");

    expect("workflowStateToSearchParams" in stateModule).toBe(false);
  });
});
