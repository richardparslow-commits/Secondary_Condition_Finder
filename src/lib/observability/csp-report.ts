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

/**
 * Maximum accepted raw report body size. Larger bodies are counted, not parsed.
 *
 * A Reporting API entry repeats the full `originalPolicy`, document URL and
 * user agent, so five benign `img-src` entries can exceed 4 KiB even though a
 * single classic report fits comfortably. The 8 KiB bound keeps that batch
 * parseable while still refusing an unbounded hostile payload (Heal
 * s2-reporting-api-csp-batch-dropped-as-oversized-1).
 */
export const CSP_REPORT_MAX_BODY_BYTES = 8_192;

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Reads the first present key, so classic kebab and Reporting API camelCase agree. */
function field(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
}

function reportBody(entry: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(entry["csp-report"]) ?? asRecord(entry.body) ?? entry;
}

/**
 * Reduces a parsed violation-report body to bounded, content-free events.
 * Accepts the classic `application/csp-report` shape
 * (`{"csp-report": {...}}`), the single-object Reporting API shape, and the
 * Reporting API's array of `{ type, body }` entries. The classic format uses
 * kebab-case fields; the Reporting API uses camelCase, so both are read.
 * Returns an empty list when nothing usable is present.
 */
export function extractCspViolationEvents(raw: unknown): CspViolationEvent[] {
  const entries = Array.isArray(raw) ? raw : [raw];
  const events: CspViolationEvent[] = [];
  for (const entry of entries) {
    const record = asRecord(entry);
    if (!record) continue;
    // A Reporting API batch can contain other report types; only violations
    // belong in the CSP window. Classic reports have no `type` field.
    if (typeof record.type === "string" && record.type !== "csp-violation") continue;
    const report = reportBody(record);
    if (!report) continue;

    const documentOrigin = originOf(field(report, ["document-uri", "documentURL"]));
    const effectiveDirective = boundedDirective(
      field(report, [
        "effective-directive",
        "violated-directive",
        "effectiveDirective",
        "violatedDirective",
      ]),
    );
    if (!documentOrigin && effectiveDirective === "unknown") continue;

    events.push({
      effectiveDirective,
      disposition: boundedDisposition(report.disposition),
      documentOrigin: documentOrigin ?? "unknown",
      blockedOrigin: originOf(field(report, ["blocked-uri", "blockedURL"])),
      sourceFileOrigin: originOf(field(report, ["source-file", "sourceFile"])),
      sampleFingerprint: sampleFingerprint(report.sample),
    });
  }
  return events;
}

/** Single-report compatibility wrapper for callers that only need one event. */
export function extractCspViolationEvent(raw: unknown): CspViolationEvent | null {
  return extractCspViolationEvents(raw)[0] ?? null;
}
