/**
 * CSP / Trusted-Types violation report redaction (server side).
 *
 * Browsers POST violation reports (`application/csp-report` or the
 * Report-To JSON shape) to `/api/csp-report` when the policy in `proxy.ts`
 * blocks something. Raw reports can carry page URLs (path + query), script
 * samples, and source files — none of which may be persisted in an
 * application that promises health-data privacy. This module reduces every
 * report to a bounded, content-free event:
 *
 * - URLs (`document-uri`, `blocked-uri`, `source-file`) are reduced to their
 *   **origin only** — never a path, never a query string.
 * - Directive names are validated against the known directive charset and
 *   length-bounded.
 * - `sample` is dropped entirely: it is arbitrary page-script text. The
 *   bounded `sampleFingerprint` (first 40 chars, hex-only) is kept solely to
 *   correlate repeated violations of the same snippet.
 * - Everything else (line/column numbers, status code, referrer, raw JSON)
 *   is discarded.
 *
 * Redaction happens before any logging or metric emission; the raw body is
 * never written anywhere.
 */

export interface CspViolationEvent {
  /** Bounded directive name (e.g. `require-trusted-types-for`). */
  effectiveDirective: string;
  /** `enforce` or `report` — how the browser treated the violation. */
  disposition: string;
  /** Origin-only document origin (e.g. `https://app.example`). */
  documentOrigin: string;
  /** Origin-only blocked-resource origin; `null` when absent or unparseable. */
  blockedOrigin: string | null;
  /** Origin-only source-file origin; `null` when absent or unparseable. */
  sourceFileOrigin: string | null;
  /** Hex-only prefix (≤40 chars) of the dropped `sample`, for dedup only. */
  sampleFingerprint: string | null;
}

/** Maximum accepted raw report body size. Larger bodies are counted, not parsed. */
export const CSP_REPORT_MAX_BODY_BYTES = 4_096;

const DIRECTIVE_PATTERN = /^[a-z][a-z0-9-]{0,99}$/;
const SAMPLE_FINGERPRINT_PATTERN = /^[0-9a-f]{1,40}$/;

function originOf(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2_048) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch {
    // Relative/blob/about URLs carry no useful origin; report nothing rather
    // than echoing the raw value back.
    return null;
  }
}

function boundedDirective(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  const normalized = value.toLowerCase();
  return DIRECTIVE_PATTERN.test(normalized) ? normalized : "unknown";
}

function boundedDisposition(value: unknown): string {
  return value === "report" ? "report" : "enforce";
}

/**
 * Hex-only prefix of the dropped sample so repeated violations of the same
 * snippet can be correlated without retaining the snippet itself.
 */
function sampleFingerprint(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const hex = Array.from(value.slice(0, 80))
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40);
  return SAMPLE_FINGERPRINT_PATTERN.test(hex) ? hex : null;
}

/**
 * Reduces a parsed violation-report body to a bounded, content-free event.
 * Accepts both the classic `application/csp-report` shape
 * (`{"csp-report": {...}}`) and the modern Report-To JSON shape
 * (`{"body": {...}}`). Returns null when nothing usable is present.
 */
export function extractCspViolationEvent(raw: unknown): CspViolationEvent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const report =
    record["csp-report"] && typeof record["csp-report"] === "object"
      ? (record["csp-report"] as Record<string, unknown>)
      : record.body && typeof record.body === "object"
        ? (record.body as Record<string, unknown>)
        : record;

  const documentOrigin = originOf(report["document-uri"]);
  const effectiveDirective = boundedDirective(
    report["effective-directive"] ?? report["violated-directive"],
  );
  if (!documentOrigin && effectiveDirective === "unknown") return null;

  return {
    effectiveDirective,
    disposition: boundedDisposition(report["disposition"]),
    documentOrigin: documentOrigin ?? "unknown",
    blockedOrigin: originOf(report["blocked-uri"]),
    sourceFileOrigin: originOf(report["source-file"]),
    sampleFingerprint: sampleFingerprint(report["sample"]),
  };
}
