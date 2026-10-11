/**
 * PHI boundary proof.
 *
 * The audit asks for a *mathematical* claim: veteran health context cannot reach
 * server logs, analytics, or a server component. A claim like that is only worth
 * what its enforcement is worth, so this suite does not restate intentions — it
 * enumerates the real attack surface in the working tree and fails when a
 * regression appears:
 *
 *   1. every `console.*` call site under `src/` (the only place the runtime
 *      serializes an argument into the platform log sink) — checked twice, once
 *      by the text scanner that backs the pre-commit gate and once by the actual
 *      ESLint rule through a real ESLint run;
 *   2. every `"use server"` module and the form keys it reads — the request-derived
 *      surface where an action could hand raw input to the engine;
 *   3. the shipped Content-Security-Policy — the control that keeps an external
 *      analytics script from executing at all, and therefore from reading DOM
 *      text that names a veteran's conditions;
 *   4. the shared vocabulary — a field that must never be logged must also never
 *      be accepted, or the two boundaries have drifted apart.
 *
 * What this suite cannot prove is stated in the audit report rather than papered
 * over here: host-level log retention, the absence of a future third-party
 * service, and whether an interpolated template expression happened to hold
 * request-derived text.
 */
import fs from "node:fs";
import path from "node:path";

import tsParser from "@typescript-eslint/parser";
import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import { PROHIBITED_LOG_FIELDS } from "@/lib/observability/logger";
import { PHI_INPUT_FIELD_NAMES, findPhiInputField } from "@/lib/security/phi-free-action-input";

import phiBoundary from "../eslint-rules/no-unsafe-logging.mjs";
import { SANCTIONED_SINKS, scanSource } from "../scripts/lib/phi-logging-scan.mjs";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const RULE_ID = "phi-boundary/no-unsafe-logging";

function listSourceFiles(directory: string, extensions: readonly string[]): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
        return listSourceFiles(absolute, extensions);
      }
      return extensions.some((extension) => entry.name.endsWith(extension)) ? [absolute] : [];
    });
}

const SOURCE_FILES = listSourceFiles(SRC, [".ts", ".tsx"]);
const relative = (file: string) => path.relative(ROOT, file).split(path.sep).join("/");
const isServerAction = (source: string) => /^\s*["']use server["']/m.test(source);

/** The real rule, run through a real ESLint run against the real file. */
function lintFile(file: string, source: string) {
  const linter = new Linter();
  const messages = linter.verify(
    source,
    [
      {
        files: ["**/*.ts", "**/*.tsx", "**/*.js"],
        languageOptions: { parser: tsParser },
        plugins: { "phi-boundary": phiBoundary },
        rules: { [RULE_ID]: "error" },
      },
    ],
    { filename: file },
  );
  return messages.filter((message) => message.ruleId === RULE_ID);
}

describe("directive 3 — the console invariant holds across src/", () => {
  const consoleFiles = SOURCE_FILES.filter((file) =>
    fs.readFileSync(file, "utf8").includes("console."),
  );

  it("finds the console call sites it claims to check", () => {
    // Guards against the whole suite passing vacuously if a refactor moves the
    // sinks or the detection regresses.
    expect(consoleFiles.length).toBeGreaterThanOrEqual(6);
  });

  it("has no call site that can hand an object to the runtime serializer", () => {
    const violations: string[] = [];
    for (const file of SOURCE_FILES) {
      if (SANCTIONED_SINKS.includes(relative(file))) continue;
      const source = fs.readFileSync(file, "utf8");
      for (const finding of scanSource(source, { isServerAction: isServerAction(source) })) {
        violations.push(`${relative(file)}:${finding.line} [${finding.code}] console.${finding.method}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("agrees with the ESLint rule on the real code, not only on snippets", () => {
    const violations: Record<string, string[]> = {};
    for (const file of consoleFiles) {
      if (SANCTIONED_SINKS.includes(relative(file))) continue;
      const messages = lintFile(file, fs.readFileSync(file, "utf8"));
      if (messages.length > 0) {
        violations[relative(file)] = messages.map((message) => String(message.messageId));
      }
    }
    expect(violations).toEqual({});
  });

  it("keeps client error-boundary sinks free of exception-derived values", () => {
    for (const file of [
      "src/app/error.tsx",
      "src/app/api/error.tsx",
      "src/app/secondary/error.tsx",
      "src/app/presumptive/error.tsx",
    ]) {
      const source = fs.readFileSync(path.join(ROOT, file), "utf8");
      expect(source, file).toContain("createClientErrorEvent(");
      expect(source, file).not.toMatch(/error\.(?:message|stack|cause|digest)/);
    }
  });

  it("justifies each exemption by construction rather than by assertion", () => {
    for (const sink of SANCTIONED_SINKS) {
      const source = fs.readFileSync(path.join(ROOT, sink), "utf8");
      // Each sanctioned sink serializes before emitting, which is the property
      // the rule cannot see from the argument expression alone.
      expect(source, sink).toMatch(/JSON\.stringify/);
    }
  });
});

describe("directive 3 — the rule detects every leaking shape", () => {
  const leaking = [
    ["two arguments dump the second", 'console.error("[tag]", error);'],
    ["a bare error object", "console.error(error);"],
    ["a workflow object", "console.log(workflow);"],
    ["a Zod error message", "console.warn(parsed.error.message);"],
    ["an object literal", "console.log({ ssn, dateOfBirth });"],
    ["a spread", "console.error(...arguments_);"],
    ["an array", "console.info([a, b]);"],
  ] as const;

  for (const [label, code] of leaking) {
    it(`reports ${label}`, () => {
      expect(lintFile("probe.ts", code).length).toBeGreaterThan(0);
    });
  }

  const safe = [
    ["a string literal", 'console.error("catalog load failed");'],
    ["a template literal", "console.error(`catalog ${file} failed`);"],
    ["an explicit serialization", "console.log(JSON.stringify(record));"],
    ["a string coercion", "console.error(String(error));"],
    ["a concatenation", 'console.warn("[preload] failed: " + elapsed);'],
  ] as const;

  for (const [label, code] of safe) {
    it(`accepts ${label}`, () => {
      expect(lintFile("probe.ts", code)).toEqual([]);
    });
  }
});

describe("directive 3 — the pre-commit scanner cannot disagree", () => {
  const planted = [
    ["two arguments", 'console.error("tag", error);', "too-many-arguments"],
    ["bare object", "console.log(payload);", "object-dump"],
    ["object literal", "console.warn({ ssn });", "object-dump"],
  ] as const;

  for (const [label, code, code_] of planted) {
    it(`flags ${label} as ${code_}`, () => {
      const findings = scanSource(`function f() { ${code} }`);
      expect(findings.map((finding) => finding.code)).toContain(code_);
    });
  }

  it("does not flag a compliant structured line", () => {
    const source = 'console.error(JSON.stringify({ level: "error", message: "catalog load failed" }));';
    expect(scanSource(source)).toEqual([]);
  });

  it("treats any direct console call in a Server Action as request-adjacent", () => {
    const source = '"use server";\nconsole.log("handled");';
    expect(scanSource(source, { isServerAction: true }).map((f) => f.code)).toEqual([
      "console-in-server-action",
    ]);
  });
});

describe("directive 3 — ESLint config and the scanner share one exemption list", () => {
  it("disables the rule for exactly the sanctioned sinks", () => {
    const config = fs.readFileSync(path.join(ROOT, "eslint.config.mjs"), "utf8");
    expect(config).toContain(`"${RULE_ID}": "error"`);
    const block = config.slice(config.indexOf("Sanctioned sinks."));
    const disabled = [...block.slice(0, block.indexOf("},")).matchAll(/"([^"]+\.tsx?)"/g)]
      .map((match) => match[1])
      .sort();
    expect(disabled).toEqual([...SANCTIONED_SINKS].sort());
  });
});

/**
 * Directive names the shipped policy is built from, matched by name rather than
 * by suffix: a `-src`-suffixed pattern silently omitted `base-uri` and
 * `form-action`, which are two of the directives that matter most for keeping a
 * scraped page from posting DOM text somewhere.
 */
const CSP_DIRECTIVE_NAMES = [
  "default-src", "script-src", "script-src-attr", "style-src", "img-src",
  "font-src", "connect-src", "worker-src", "manifest-src", "media-src",
  "frame-src", "object-src", "base-uri", "form-action", "frame-ancestors",
  "upgrade-insecure-requests",
] as const;

describe("directive 1 — the shipped CSP forbids every external origin", () => {
  const proxySource = fs.readFileSync(path.join(ROOT, "src/proxy.ts"), "utf8");
  const directives = CSP_DIRECTIVE_NAMES.flatMap((name) =>
    [...proxySource.matchAll(new RegExp(`"(${name}(?:[^"]*))"`, "g"))].map(
      (match) => match[1],
    ),
  );

  it("extracts every directive it asserts about", () => {
    const policy = directives.join("; ");
    const missing = CSP_DIRECTIVE_NAMES.filter((name) => !policy.includes(name));
    expect(missing).toEqual([]);
  });

  it("allowlists no external origin in any resource family", () => {
    const external = directives.filter((directive) => /https?:\/\//.test(directive));
    expect(external).toEqual([]);
  });

  it("blocks external script execution and the exfiltration channels analytics need", () => {
    const policy = directives.join("; ");
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("connect-src 'self'");
    expect(policy).toContain("img-src 'self' data: blob:");
    expect(policy).toContain("frame-src 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
  });

  it("hardens script-src with a nonce and strict-dynamic, and requires Trusted Types", () => {
    expect(proxySource).toContain("'nonce-${nonce}'");
    expect(proxySource).toContain("'strict-dynamic'");
    expect(proxySource).toContain("require-trusted-types-for 'script'");
    expect(proxySource).toContain("script-src-attr 'none'");
  });

  it("keeps the CSP in one place so a duplicate cannot downgrade it", () => {
    const nextConfig = fs.readFileSync(path.join(ROOT, "next.config.ts"), "utf8");
    expect(nextConfig).not.toMatch(/key:\s*"Content-Security-Policy"/);
  });
});

describe("directive 2 — Server Actions cannot carry PHI", () => {
  const actionFiles = SOURCE_FILES.filter((file) =>
    isServerAction(fs.readFileSync(file, "utf8")),
  );

  it("finds the action modules it claims to check", () => {
    expect(actionFiles.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps every action under src/lib/actions/ and free of direct logging", () => {
    for (const file of actionFiles) {
      expect(relative(file).startsWith("src/lib/actions/"), relative(file)).toBe(true);
      const source = fs.readFileSync(file, "utf8");
      expect(scanSource(source, { isServerAction: true }), relative(file)).toEqual([]);
    }
  });

  it("reads only PHI-free form keys from request-derived input", () => {
    const offenders: string[] = [];
    for (const file of actionFiles) {
      const source = fs.readFileSync(file, "utf8");
      const keys = [
        ...[...source.matchAll(/formData\.get\(\s*"([^"]+)"/g)].map((match) => match[1]),
        ...[...source.matchAll(/textValue\(\s*formData\s*,\s*"([^"]+)"/g)].map((match) => match[1]),
      ];
      for (const key of keys) {
        const refused = findPhiInputField([key]);
        if (refused) offenders.push(`${relative(file)}: ${key} -> ${refused}`);
      }
      expect(keys.length, `${relative(file)} exposes form keys to check`).toBeGreaterThan(0);
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * The egress boundary.
 *
 * The directive names the boundary between the parsing components and the
 * backend, and the only way out of a browser-local parser is a network call. So
 * rather than assert intent, enumerate every outbound primitive in `src/` and
 * require the list to match a reviewed allowlist. A future analytics snippet,
 * beacon, or third-party SDK anywhere under `src/` fails here, and the failure
 * message says what to do about it.
 */
const EGRESS_PATTERN =
  /(?<![A-Za-z0-9_$.])(?:fetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket|new\s+EventSource|navigator\.sendBeacon)/;

/**
 * Reviewed egress allowlist.
 *
 * The four `src/lib/va/*` modules are server-side and target VA endpoints pinned
 * by `config.ts` (discovery-verified paths on `sandbox-api.va.gov`, disabled by
 * default). `SandboxConnectForm` is the one client-side call and posts to
 * `form.action` — its own page, same-origin, which `form-action 'self'` and
 * `connect-src 'self'` also enforce at the browser.
 *
 * The credentialed account flow's outbound call now lives in exactly one of
 * them, `account/transport.ts`: `account/oauth.ts` (token, JWKS, revocation) and
 * `client.ts` (the credentialed read) delegate to it, so this inventory names the
 * module that actually reaches the network rather than two that no longer do.
 * Both were listed here while they held their own `fetch`, and neither may hold
 * one again without this list changing — which is the check working, not an
 * exemption being granted. The demo fixture module deliberately has no egress at
 * all: it only answers requests, and `transport.ts` falls through for the rest.
 * `api-client.ts` is the restricted-API (Claims/Intake) counterpart: server-only,
 * bearer tokens pinned to the configured VA origin, redirects refused, no logger
 * or console sink, failures returned as values.
 */
const REVIEWED_EGRESS_FILES = [
  "src/components/va-account/SandboxConnectForm.tsx",
  "src/lib/va/account/store.ts",
  "src/lib/va/account/transport.ts",
  "src/lib/va/api-client.ts",
  "src/lib/va/reference-shared-cache.ts",
  "src/lib/va/sandbox.ts",
].sort();

describe("directive 1 — nothing parses veteran data and then calls out", () => {
  const egressFiles = SOURCE_FILES.filter((file) =>
    EGRESS_PATTERN.test(fs.readFileSync(file, "utf8")),
  )
    .map(relative)
    .sort();

  it("matches a reviewed egress allowlist", () => {
    // A new entry here is a review decision: either it is same-origin, or it is a
    // server-side call to a pinned endpoint. Anything else must not ship.
    expect(egressFiles).toEqual(REVIEWED_EGRESS_FILES);
  });

  it("has no outbound primitive in any evidence parser or local analyzer", () => {
    const parsingSurfaces = SOURCE_FILES.filter((file) => {
      const name = relative(file);
      return (
        name.startsWith("src/lib/evidence/") ||
        name.startsWith("src/components/evidence/") ||
        name.endsWith("Dd214LocalAnalyzer.tsx") ||
        name.endsWith("PresumptiveResults.tsx") ||
        name.endsWith("presumptive/results/page.tsx")
      );
    });
    // Guard against the check passing because the globs stopped matching.
    expect(parsingSurfaces.length).toBeGreaterThanOrEqual(4);
    const offenders = parsingSurfaces
      .filter((file) => EGRESS_PATTERN.test(fs.readFileSync(file, "utf8")))
      .map(relative);
    expect(offenders).toEqual([]);
  });

  it("ships no analytics or telemetry SDK that could bundle a beacon", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    const banned = /(analytics|sentry|posthog|mixpanel|segment|amplitude|datadog|fullstory|hotjar|clarity|matomo|gtag|gtm|bugsnag|logrocket|newrelic)/i;
    const offenders = Object.keys(manifest.dependencies ?? {}).filter((name) =>
      banned.test(name),
    );
    expect(offenders).toEqual([]);
  });

  it("exposes no NEXT_PUBLIC_ variable that could carry a key to the browser", () => {
    const leaks: string[] = [];
    for (const file of SOURCE_FILES) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
        leaks.push(`${relative(file)}: ${match[0]}`);
      }
    }
    expect(leaks).toEqual([]);
  });
});

describe("the boundaries share one vocabulary", () => {
  /**
   * The one field the two boundaries must disagree about.
   *
   * `searchAccreditedRepresentatives` has to accept a ZIP to query the public
   * VSO/attorney directory — that is the query, not health context — while a ZIP
   * remains a quasi-identifier that must never reach the log sink. Pinning the
   * delta to this exact list means any *other* divergence fails here instead of
   * quietly widening, and a new entry has to be justified in review.
   */
  const LOG_ONLY_FIELDS = ["zip"];

  it("refuses as input every field the logger refuses to emit, less the pinned delta", () => {
    const missing = PROHIBITED_LOG_FIELDS.filter(
      (field) => !LOG_ONLY_FIELDS.includes(field) && findPhiInputField([field]) === null,
    );
    expect(missing).toEqual([]);
  });

  it("keeps the log-only delta exactly as documented", () => {
    for (const field of LOG_ONLY_FIELDS) {
      expect(PROHIBITED_LOG_FIELDS, field).toContain(field);
      expect(findPhiInputField([field]), field).toBeNull();
    }
  });

  it("declares no duplicate canonical names", () => {
    expect(new Set(PHI_INPUT_FIELD_NAMES).size).toBe(PHI_INPUT_FIELD_NAMES.length);
  });
});
