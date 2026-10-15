import fs from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { proxy } from "@/proxy";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

/**
 * SEC-03 — production authorizes styles with a nonce and refuses the style
 * attribute (`style-src-attr 'none'`). That only holds while no component
 * renders one, so the last case below walks `src/` for the two JSX shapes that
 * produce it: the object literal and the string attribute.
 */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx|mts|js|jsx|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

const STYLE_ATTRIBUTE_PATTERN = /(^|\s)style=\{|\sstyle="/;

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

  it("emits a nonce-based production style policy without unsafe-inline", () => {
    const response = proxy(new NextRequest("https://example.test/secondary"));
    const csp = response.headers.get("Content-Security-Policy") ?? "";

    expect(csp).toContain("style-src 'self' 'nonce-");
    expect(csp).not.toMatch(/style-src[^;]*'unsafe-inline'/);
    // A nonce authorizes a `<style>` element; it can never authorize an
    // element's style attribute, so that form is refused outright.
    expect(csp).toContain("style-src-attr 'none'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it("keeps the inline-style allowance to the development policy", () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      const csp =
        proxy(new NextRequest("https://example.test/secondary")).headers.get(
          "Content-Security-Policy",
        ) ?? "";

      // The Next.js dev overlay injects inline markup; no deployment serves
      // this policy.
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).not.toContain("style-src-attr 'none'");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("renders no style attribute that the production policy would refuse", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(path.join(process.cwd(), "src"))) {
      fs.readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (STYLE_ATTRIBUTE_PATTERN.test(line)) {
            offenders.push(`${path.relative(process.cwd(), file)}:${index + 1}`);
          }
        });
    }

    expect(
      offenders,
      "Production CSP is `style-src-attr 'none'` (SEC-03), so a rendered style " +
        "has to be a Tailwind class, an SVG presentation attribute, a drawn SVG " +
        "shape, or a CSSOM write — never a JSX style attribute.",
    ).toEqual([]);
  });

  it("forces request-time rendering so Next can apply the CSP nonce", () => {
    const layout = read("src/app/layout.tsx");

    expect(layout).toContain('import { connection } from "next/server"');
    expect(layout).toContain("await connection()");
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
