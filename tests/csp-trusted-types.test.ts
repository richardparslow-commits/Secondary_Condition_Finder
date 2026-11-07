import fs from "node:fs";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  CSP_REPORT_MAX_BODY_BYTES,
  extractCspViolationEvent,
  extractCspViolationEvents,
} from "../src/lib/observability/csp-report";
import {
  buildTrustedTypesPolicyOptions,
  installTrustedTypesDefaultPolicy,
  type TrustedTypePolicyOptions,
} from "../src/lib/security/trusted-types-policy";
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

  it("allowlists only the gated default policy, with unquoted policy-name tokens", () => {
    const directive = csp
      .split(";")
      .find((part) => part.trim().startsWith("trusted-types "));
    expect(directive).toBeDefined();
    // `default` must be an unquoted token; quoted strings are invalid policy
    // names that Chrome warns about and ignores (verified in the production
    // build: createPolicy('nextjs') threw "Policy disallowed" while the
    // quoted `'nextjs' 'dompurify'` entries were present, and every page load
    // logged two invalid-policy errors). Framework policies are intentionally
    // not allowlisted: Next's plain chunk URLs ride the strict `default`
    // policy, and client navigation was verified violation-free that way.
    expect(directive).toMatch(/(^| )default( |$)/);
    expect(directive).not.toMatch(/'nextjs'/);
    expect(directive).not.toMatch(/'dompurify'/);
    expect(directive).not.toMatch(/'tesseract/);
    // Only keyword-form entries may be quoted in the value list.
    const quotedNames = (directive ?? "").match(/'([^']*)'/g) ?? [];
    for (const quoted of quotedNames) {
      expect(["'allow-duplicates'", "'report-sample'"]).toContain(quoted);
    }
    // 'allow-duplicates' belongs to the trusted-types directive's value list;
    // a standalone directive is unknown and silently ignored by browsers.
    expect(directive).toContain("'allow-duplicates'");
    expect(csp).not.toMatch(/;\s*'allow-duplicates'(;|$)/);
  });

  it("keeps the pre-existing script policy pins intact", () => {
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("'wasm-unsafe-eval'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("connect-src 'self'");
  });

  it("allows workers only from same-origin script URLs (no blob workers)", () => {
    // Tesseract spawns directly from /tesseract/worker.min.js
    // (workerBlobURL: false) because the default policy refuses blob script
    // URLs; omitting `blob:` makes any regression to blob spawning fail in
    // every browser, not only Trusted-Types-enforcing ones.
    expect(csp).toContain("worker-src 'self'");
    expect(csp).not.toMatch(/worker-src[^;]*blob:/);
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

  it("accepts the Reporting API array with camelCase fields", () => {
    const events = extractCspViolationEvents([
      {
        type: "csp-violation",
        age: 1,
        url: "https://app.example/secondary/upload?token=PLANTED-QUERY",
        body: {
          documentURL: "https://app.example/secondary/upload?token=PLANTED-QUERY",
          effectiveDirective: "img-src",
          blockedURL: "https://evil.test/payload.js",
          sourceFile: "https://app.example/_next/static/chunk.js",
          disposition: "enforce",
          sample: "alert(document.cookie)",
        },
      },
      { type: "deprecation", body: { id: "not-a-csp-report" } },
    ]);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      effectiveDirective: "img-src",
      disposition: "enforce",
      documentOrigin: "https://app.example",
      blockedOrigin: "https://evil.test",
      sourceFileOrigin: "https://app.example",
    });
    expect(events[0]?.sampleFingerprint).toMatch(/^[0-9a-f]{1,40}$/);
    expect(JSON.stringify(events)).not.toContain("PLANTED-QUERY");
    expect(JSON.stringify(events)).not.toContain("document.cookie");
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
  it("answers an accepted report with a bare 204, never an error oracle", async () => {
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

  it("sheds abusive request rates with a content-free 429", async () => {
    const { POST } = await import("../src/app/api/csp-report/route");
    const client = "203.0.113.77";
    const report = () =>
      new NextRequest("https://example.test/api/csp-report", {
        method: "POST",
        headers: { "content-type": "application/csp-report", "x-forwarded-for": client },
        body: JSON.stringify({ "csp-report": { "document-uri": "https://app.example/" } }),
      });

    for (let i = 0; i < 30; i += 1) {
      expect((await POST(report())).status).toBe(204);
    }
    const limited = await POST(report());
    expect(limited.status).toBe(429);
    expect(await limited.text()).toBe("");
  });

  it("treats an unreadable request body as a content-free 204, not an error", async () => {
    const { POST } = await import("../src/app/api/csp-report/route");
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("client aborted mid-body"));
      },
    });
    const request = new NextRequest(
      new Request("https://example.test/api/csp-report", {
        method: "POST",
        headers: { "content-type": "application/csp-report" },
        body: stream,
        duplex: "half",
      } as unknown as RequestInit),
    );

    const response = await POST(request);
    expect(response.status).toBe(204);
  });
});

describe("Trusted Types bootstrap (pre-hydration)", () => {
  const instrumentation = read("src/instrumentation-client.ts");

  it("installs the default policy from the client instrumentation hook, not an effect", () => {
    expect(instrumentation).toContain("installTrustedTypesDefaultPolicy");
    expect(instrumentation).toContain("process.env.NODE_ENV");
    expect(instrumentation).not.toContain("useEffect");
    expect(read("src/app/layout.tsx")).not.toContain("TrustedTypesGate");
  });

  it("executes the policy: OCR worker and framework chunk URLs pass, everything else is refused", () => {
    const options = buildTrustedTypesPolicyOptions({
      origin: "https://app.example",
      href: "https://app.example/secondary/upload",
    });
    const createScriptURL = options.createScriptURL!;

    // Real first-party sinks: the pinned tesseract worker (absolute and
    // root-relative) and framework chunk loading during client navigation.
    expect(createScriptURL("https://app.example/tesseract/worker.min.js")).toBe(
      "https://app.example/tesseract/worker.min.js",
    );
    expect(createScriptURL("/tesseract/worker.min.js")).toBe("/tesseract/worker.min.js");
    expect(createScriptURL("https://app.example/_next/static/chunks/app-page.js")).toBe(
      "https://app.example/_next/static/chunks/app-page.js",
    );

    for (const refused of [
      "blob:https://app.example/0e1b0f9a",
      "data:text/javascript,alert(1)",
      "javascript:alert(1)",
      "https://evil.example/payload.js",
      "http://app.example/insecure.js",
      "http://[",
    ]) {
      expect(() => createScriptURL(refused), refused).toThrow(/refused non-same-origin script URL/);
    }
  });

  it("refuses createScript and createHTML outright", () => {
    const options = buildTrustedTypesPolicyOptions({
      origin: "https://app.example",
      href: "https://app.example/",
    });
    expect(() => options.createScript!("alert(1)")).toThrow("createScript is not permitted");
    expect(() => options.createHTML!("<img src=x onerror=alert(1)>")).toThrow(
      "createHTML is not permitted",
    );
  });

  it("installs the policy and marks the document ready", () => {
    const attributes = new Map<string, string>();
    const created: Array<{ name: string; options: TrustedTypePolicyOptions }> = [];
    const installed = installTrustedTypesDefaultPolicy({
      trustedTypes: {
        defaultPolicy: null,
        createPolicy(name, options) {
          created.push({ name, options });
          return {};
        },
      },
      location: { origin: "https://app.example", href: "https://app.example/secondary/upload" },
      document: {
        documentElement: {
          setAttribute(name, value) {
            attributes.set(name, value);
          },
        },
      },
    });

    expect(installed).toBe(true);
    expect(created).toHaveLength(1);
    expect(created[0]?.name).toBe("default");
    expect(attributes.get("data-tt-ready")).toBe("true");
    expect(created[0]!.options.createScriptURL!("/tesseract/worker.min.js")).toBe(
      "/tesseract/worker.min.js",
    );
  });

  it("leaves readiness unset when Trusted Types is unavailable", () => {
    const attributes = new Map<string, string>();
    const installed = installTrustedTypesDefaultPolicy({
      location: { origin: "https://app.example", href: "https://app.example/" },
      document: {
        documentElement: {
          setAttribute(name, value) {
            attributes.set(name, value);
          },
        },
      },
    });

    expect(installed).toBe(false);
    expect(attributes.size).toBe(0);
  });
});
