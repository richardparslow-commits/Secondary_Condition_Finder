import fs from "node:fs";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { extractCspViolationEvent, CSP_REPORT_MAX_BODY_BYTES } from "../src/lib/observability/csp-report";
import { proxy } from "@/proxy";

/**
 * Contracts for the Trusted Types + CSP violation reporting remediation
 * (priority 8). Verified live in headless Chrome against a production build:
 * enforced TT with the gated `default` policy hydrates cleanly, the
 * same-origin tesseract worker path succeeds, and cross-origin/blob worker
 * payloads are blocked. These tests pin the standing contracts so the
 * guarantees cannot silently regress.
 */

function read(relativePath: string): string {
  return fs.readFileSync(relativePath, "utf8");
}

describe("production CSP carries Trusted Types + reporting directives", () => {
  const response = proxy(new NextRequest("https://example.test/secondary"));
  const csp = response.headers.get("Content-Security-Policy") ?? "";

  it("enforces require-trusted-types-for in the header policy", () => {
    expect(csp).toContain("require-trusted-types-for 'script'");
  });

  it("allowlists the gated default policy plus framework escape hatches, unquoted token names", () => {
    const directive = csp
      .split(";")
      .find((part) => part.trim().startsWith("trusted-types "));
    expect(directive).toBeDefined();
    // `default` must be an unquoted token; quoted strings would be invalid
    // tokens and silently disallowed (verified in Chrome). Framework names
    // keep the quoted form Next.js itself uses.
    expect(directive).toMatch(/(^| )default( |$)/);
    expect(directive).toContain("'nextjs'");
    expect(directive).toContain("'dompurify'");
    expect(directive).not.toMatch(/'tesseract/);
    // 'allow-duplicates' is its own directive per spec, not part of trusted-types.
    expect(csp).toContain("'allow-duplicates'");
  });

  it("keeps the pre-existing script policy pins intact", () => {
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("'wasm-unsafe-eval'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("connect-src 'self'");
  });

  it("wires violation reporting through both mechanisms", () => {
    expect(csp).toContain("report-uri /api/csp-report");
    expect(response.headers.get("Reporting-Endpoints")).toContain("/api/csp-report");
    expect(response.headers.get("Report-To")).toContain("csp-endpoint");
  });

  it("does not enforce Trusted Types in development (dev toolchain exemption)", () => {
    const previous = process.env.NODE_ENV;
    const env = process.env as { NODE_ENV?: string };
    try {
      env.NODE_ENV = "development";
      const devResponse = proxy(new NextRequest("https://example.test/secondary"));
      const devCsp = devResponse.headers.get("Content-Security-Policy") ?? "";
      expect(devCsp).not.toContain("require-trusted-types-for");
      // Violation reporting stays active in dev so toolchain regressions surface.
      expect(devCsp).toContain("report-uri /api/csp-report");
    } finally {
      env.NODE_ENV = previous;
    }
  });

  it("excludes the report endpoint from the security matcher so reporting cannot loop", () => {
    const proxySource = read("src/proxy.ts");
    expect(proxySource).toContain("api/csp-report");
    expect(proxySource).toContain("isCspReportRequest");
  });
});

describe("CSP violation redaction", () => {
  it("reduces classic csp-report payloads to origin-only fields", () => {
    const event = extractCspViolationEvent({
      "csp-report": {
        "document-uri": "https://app.example/secondary/upload?next=/x&secret=1",
        "violated-directive": "require-trusted-types-for",
        "effective-directive": "require-trusted-types-for",
        disposition: "enforce",
        "blocked-uri": "https://evil.test/payload.js",
        "source-file": "https://app.example/_next/static/chunk.js",
        "line-number": 12,
        "column-number": 3,
        sample: "alert(document.cookie) /* arbitrary page script */",
      },
    });

    expect(event).not.toBeNull();
    expect(event?.documentOrigin).toBe("https://app.example");
    expect(event?.blockedOrigin).toBe("https://evil.test");
    expect(event?.sourceFileOrigin).toBe("https://app.example");
    expect(event?.effectiveDirective).toBe("require-trusted-types-for");
    expect(event?.disposition).toBe("enforce");
    // No path, query, or sample text may survive redaction.
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("/secondary/upload");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("document.cookie");
  });

  it("accepts the modern Report-To JSON shape", () => {
    const event = extractCspViolationEvent({
      body: {
        "document-uri": "https://app.example/",
        "effective-directive": "script-src",
        disposition: "report",
      },
    });
    expect(event?.effectiveDirective).toBe("script-src");
    expect(event?.disposition).toBe("report");
  });

  it("drops the sample but keeps a hex-only correlation fingerprint", () => {
    const event = extractCspViolationEvent({
      "csp-report": {
        "document-uri": "https://app.example/",
        "effective-directive": "require-trusted-types-for",
        sample: "evil<script>alert(1)</script>",
      },
    });
    expect(event?.sampleFingerprint).not.toBeNull();
    expect(event?.sampleFingerprint).toMatch(/^[0-9a-f]{1,40}$/);
    expect(JSON.stringify(event)).not.toContain("evil");
  });

  it("fails closed on junk, oversized, and hostile inputs", () => {
    expect(extractCspViolationEvent(null)).toBeNull();
    expect(extractCspViolationEvent("string")).toBeNull();
    expect(extractCspViolationEvent([1, 2])).toBeNull();
    expect(extractCspViolationEvent({})).toBeNull();
    // Directive names are validated against the known charset.
    const hostile = extractCspViolationEvent({
      "csp-report": {
        "document-uri": "https://app.example/",
        "effective-directive": "BAD DIRECTIVE <script>",
      },
    });
    expect(hostile?.effectiveDirective).toBe("unknown");
    // Unparseable/blocked URIs yield null origins, never raw echoes.
    const relative = extractCspViolationEvent({
      "csp-report": { "document-uri": "https://app.example/", "blocked-uri": "inline" },
    });
    expect(relative?.blockedOrigin).toBeNull();
  });

  it("bounds the accepted report body size", () => {
    expect(CSP_REPORT_MAX_BODY_BYTES).toBeLessThanOrEqual(8_192);
  });
});

describe("report endpoint behavior", () => {
  it("answers every well-formed report with a bare 204, never an error oracle", async () => {
    const { POST } = await import("../src/app/api/csp-report/route");
    const request = new NextRequest("https://example.test/api/csp-report", {
      method: "POST",
      headers: { "content-type": "application/csp-report" },
      body: JSON.stringify({
        "csp-report": {
          "document-uri": "https://app.example/",
          "effective-directive": "require-trusted-types-for",
        },
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(204);
  });

  it("answers malformed and wrong-content-type posts with 204 as well", async () => {
    const { POST } = await import("../src/app/api/csp-report/route");
    const malformed = await POST(
      new NextRequest("https://example.test/api/csp-report", {
        method: "POST",
        headers: { "content-type": "application/csp-report" },
        body: "{not-json",
      }),
    );
    expect(malformed.status).toBe(204);

    const wrongType = await POST(
      new NextRequest("https://example.test/api/csp-report", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "hello",
      }),
    );
    expect(wrongType.status).toBe(204);
  });
});

describe("TrustedTypesGate component (structural)", () => {
  const component = read("src/components/security/TrustedTypesGate.tsx");

  it("creates only the default policy, from a client component, before hydration", () => {
    expect(component).toContain('"use client"');
    expect(component).toMatch(/createPolicy\(\s*"default"/);
    expect(component).not.toMatch(/createPolicy\(\s*"tesseract/);
  });

  it("gates script URLs to same-origin http(s) only — no blob, no data, no cross-origin", () => {
    expect(component).toContain('url.protocol !== "https:"');
    expect(component).toContain('url.protocol !== "http:"');
    expect(component).toContain("allowedOrigins.has(url.origin)");
  });

  it("refuses createScript and createHTML outright", () => {
    expect(component).toContain("createScript is not permitted");
    expect(component).toContain("createHTML is not permitted");
  });

  it("mirrors the CSP dev exemption and marks completion for ops verification", () => {
    expect(component).toContain('process.env.NODE_ENV === "development"');
    expect(component).toContain("data-tt-ready");
  });

  it("is mounted in the root layout", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain("<TrustedTypesGate />");
  });
});
