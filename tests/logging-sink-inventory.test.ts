import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { AUTOMATIC_TRACE_EXPORT } from "@/lib/observability/telemetry-policy";

/**
 * Logging-sink inventory (B08 residual).
 *
 * The audit's remaining B08 question is whether the reviewed sink inventory is
 * *complete*: every place the application can emit a record — platform-log
 * lines, external trace/metric export, and the browser-report intake — must be
 * enumerated, so a new sink fails here instead of shipping silently. This
 * suite pins that enumeration against the working tree:
 *
 * 1. Platform-log writers: only `observability/logger.ts` (the single
 *    redacting choke point) plus fixed-string `console.*` call sites whose
 *    shapes are governed by `tests/phi-logging-boundary.test.ts`.
 * 2. Audit-event callers: the exact routes/actions that may emit `auditLog`.
 * 3. External export: LangSmith wiring lives in exactly one server-only
 *    module that nothing under `src/` invokes (unreachable in production);
 *    OTel meters exist in exactly three modules and stay no-ops because
 *    `registerOTel` is never called (pinned by
 *    `tests/telemetry-policy.test.ts`); export defaults stay off.
 * 4. Browser-report intake (`/api/csp-report`): ingests POST bodies but never
 *    logs them — no console, no logger import, content-free 204/429 only.
 *
 * What this suite cannot prove is stated in the audit list rather than
 * papered over here: hosting-platform collection, retention, access controls,
 * and export paths need hosting-account access (see B08 posture).
 */

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

function listSourceFiles(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
        return listSourceFiles(absolute);
      }
      return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [absolute] : [];
    });
}

const SOURCE_FILES = listSourceFiles(SRC);
const relative = (file: string) => path.relative(ROOT, file).split(path.sep).join("/");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Real import statements only: doc-comment usage examples name the same
// specifiers, so comments are stripped before matching (this also handles
// imports wrapped across lines, which a per-line match would miss).
const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'/])\/\/[^\n]*/g, "$1");
const hasStaticImport = (source: string, specifiers: readonly string[]) => {
  const code = stripComments(source);
  return specifiers.some((specifier) =>
    new RegExp(`from\\s*["']${escapeRegExp(specifier)}["']`).test(code),
  );
};
const importersOf = (...specifiers: readonly string[]) =>
  SOURCE_FILES.map(relative)
    .filter((file) => hasStaticImport(read(file), specifiers))
    .sort();

describe("logging-sink inventory (B08)", () => {
  it("emits platform-log lines through exactly the reviewed logger clients", () => {
    // Every module that can construct the redacting logger. A new entry is a
    // review decision: the fields it logs must be operational-only.
    expect(importersOf("@/lib/observability/logger", "./logger")).toEqual(
      [
        "src/lib/engine/recommend.ts",
        "src/lib/observability/audit.ts",
        "src/lib/security/csrf.ts",
        "src/lib/va/circuit-breaker.ts",
        // A04: a cached candidate or a fresh view its own loader DTO rejects is
        // otherwise a silent degradation. Reviewed fields are operational-only:
        // a fixed `outcome` enum and, for the shared store, a byte count — never
        // a cached value, a lookup key, or a search text.
        "src/lib/va/reference-cache-access.ts",
        "src/lib/va/reference-shared-cache.ts",
        "src/lib/va/sandbox.ts",
        "src/lib/va/shared-circuit.ts",
        "src/lib/va/shared-single-flight.ts",
      ].sort(),
    );
  });

  it("emits audit events from exactly the reviewed routes and actions", () => {
    expect(importersOf("@/lib/observability/audit")).toEqual(
      [
        "src/app/api/admin/cache-clear/route.ts",
        "src/app/api/regulatory/preflight/route.ts",
        "src/lib/actions/accredited-representatives.ts",
      ].sort(),
    );
  });

  it("touches console directly from exactly the reviewed call sites", () => {
    // Shapes are governed by tests/phi-logging-boundary.test.ts; this pins
    // membership so a new direct call site fails here first.
    const consoleFiles = SOURCE_FILES.map(relative)
      .filter((file) => read(file).includes("console."))
      .sort();
    expect(consoleFiles).toEqual(
      [
        "src/app/api/error.tsx",
        "src/app/error.tsx",
        "src/app/presumptive/error.tsx",
        "src/app/secondary/error.tsx",
        "src/lib/catalog/load.ts",
        "src/lib/data/preload.ts",
        "src/lib/engine/metrics.ts",
        "src/lib/evidence/storage.ts",
        "src/lib/kb/load.ts",
        "src/lib/observability/logger.ts",
        "src/lib/presumptive/load.ts",
        "src/lib/regulatory/load.ts",
        "src/lib/workflow-session-crypto.ts",
      ].sort(),
    );
  });

  it("keeps LangSmith wiring in one server-only module nothing invokes", () => {
    expect(importersOf("@/lib/observability/langsmith")).toEqual([
      "src/lib/engine/recommend-tracing.ts",
    ]);
    const tracing = read("src/lib/engine/recommend-tracing.ts");
    expect(tracing).toContain('import "server-only"');
    // The traced wrapper is exported for synthetic/public-input server use;
    // no production call site may invoke it with veteran context.
    const callers = SOURCE_FILES.map(relative).filter(
      (file) =>
        file !== "src/lib/engine/recommend-tracing.ts" &&
        /(recommendTraced|recommendWithTracing|sanitizeRecommendationTrace)/.test(
          stripComments(read(file)),
        ),
    );
    expect(callers).toEqual([]);
  });

  it("holds OTel meters in exactly three no-op-without-collector modules", () => {
    const meterHolders = SOURCE_FILES.map(relative)
      .filter((file) => read(file).includes("@opentelemetry/api"))
      .sort();
    expect(meterHolders).toEqual(
      [
        "src/lib/engine/metrics.ts",
        "src/lib/observability/csp-metrics.ts",
        "src/lib/observability/logger.ts",
      ].sort(),
    );
  });

  it("never exports traces automatically and keeps external keys out of version control", () => {
    expect(AUTOMATIC_TRACE_EXPORT.enabled).toBe(false);
    expect(AUTOMATIC_TRACE_EXPORT.status).toBe("disabled-pending-review");
    const example = read(".env.example");
    expect(example).toMatch(/LANGSMITH_TRACING=false/);
    expect(example).not.toMatch(/LANGSMITH_API_KEY=\S/);
  });

  it("never logs the raw CSP report body at the browser-report intake", () => {
    const route = read("src/app/api/csp-report/route.ts");
    expect(route).not.toContain("console.");
    expect(route).not.toContain("observability/logger");
    expect(route).not.toContain("auditLog(");
    // Content-free statuses only: malformed/oversized/unreadable bodies all
    // answer 204, abusive rates 429 — the endpoint is never an oracle.
    expect(route).toContain("status: 204");
    expect(route).toContain("status: 429");
  });
});
