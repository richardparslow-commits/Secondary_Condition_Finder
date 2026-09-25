/**
 * Structured JSON logger for operational observability.
 *
 * Emits timestamped, JSON-formatted lines to stdout/stderr so Vercel / OTel
 * ingestors can collect them without extra infrastructure. No PII, no raw
 * evidence, no workflow payloads. Callers should still pass only sanitized
 * fields; `PROHIBITED_LOG_FIELDS` are additionally suppressed recursively and
 * case-insensitively at emit time as a second line of defence, so a nested or
 * renamed key cannot carry PHI through to the sink.
 *
 * Usage:
 *   import { createLogger } from "@/lib/observability/logger";
 *   const logger = createLogger("va-sandbox");
 *   logger.info("va request succeeded", { service, status, durationMs });
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  [key: string]: unknown;
  // Correlation helpers — safe to log:
  requestId?: string;
  service?: string;
  path?: string;
  attempt?: number;
  outcome?: string;
  status?: number;
  durationMs?: number;
  component?: string;
  // Never log: raw evidence text, workflow condition payloads, secrets
}

function isTestEnv(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

/**
 * Governance contract: log field names that must never reach a sink.
 *
 * Exported so tests and future callers assert against one authoritative list
 * instead of a private inline array. Matching is case-insensitive and applied
 * at every nesting depth: a shallow, exact-case, top-level blocklist is
 * defeated by wrapping the same value (`{ meta: { ssn } }`) or by renaming a
 * key (`SSN`, `RawNotes`) — which is exactly how PHI reaches stdout and from
 * there the platform log ingest.
 */
export const PROHIBITED_LOG_FIELDS: readonly string[] = [
  // Free-form clinical text and document payloads
  "freeText", "rawText", "rawNotes", "clinicalNotes", "notes", "evidence",
  "payload", "ocrText", "documentText", "extractedText",
  // Direct identifiers and quasi-identifiers
  "ssn", "fullSsn", "patientName", "dob", "dateOfBirth", "address",
  "streetAddress", "phone", "phoneNumber", "email", "zip", "zipCode",
  // Secrets and session material
  "cookie", "cookies", "secret", "apiKey", "api_key", "token", "accessToken",
  "refreshToken", "authorization", "password", "session", "sessionId",
];

const PROHIBITED_LOG_FIELD_SET = new Set(
  PROHIBITED_LOG_FIELDS.map((field) => field.toLowerCase()),
);

/** Suppressed values are replaced rather than dropped, so suppression stays auditable. */
const REDACTION_MARKER = "[redacted]";

/** Depth cap: bounds cost and terminates on accidental cyclic structures. */
const MAX_REDACTION_DEPTH = 8;

function isProhibitedKey(key: string): boolean {
  return PROHIBITED_LOG_FIELD_SET.has(key.toLowerCase());
}

function redactValue(value: unknown, depth: number): unknown {
  if (depth > MAX_REDACTION_DEPTH) return REDACTION_MARKER;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((entry) => redactValue(entry, depth + 1));
  if (value && typeof value === "object") {
    const nested: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      nested[key] = isProhibitedKey(key) ? REDACTION_MARKER : redactValue(entry, depth + 1);
    }
    return nested;
  }
  return value;
}

/**
 * Recursively suppress prohibited fields before a record is serialized.
 *
 * Operational correlation fields (`requestId`, `service`, `path`, `status`,
 * `durationMs`, `outcome`, `component`) are preserved — `path` is a VA API
 * pathname, never a full request URL carrying a query string.
 */
export function redactLogFields(fields: LogFields): LogFields {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    sanitized[key] = isProhibitedKey(key) ? REDACTION_MARKER : redactValue(value, 1);
  }
  return sanitized as LogFields;
}

function emit(level: LogLevel, component: string, message: string, fields: LogFields = {}): void {
  // Keep test output quiet unless explicitly observed.
  if (isTestEnv() && level === "debug") return;

  const record = {
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
    ...redactLogFields(fields),
  };

  const line = JSON.stringify(record);

  if (level === "error" || level === "warn") {
    console.error(line);
  } else if (level === "debug" && process.env.NODE_ENV !== "production") {
    console.debug(line);
  } else {
    console.log(line);
  }
}

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(extraFields: LogFields): Logger;
}

export function createLogger(component: string, baseFields: LogFields = {}): Logger {
  const withBase = (fields: LogFields = {}): LogFields => ({ ...baseFields, ...fields });

  return {
    debug: (message, fields) => emit("debug", component, message, withBase(fields)),
    info: (message, fields) => emit("info", component, message, withBase(fields)),
    warn: (message, fields) => emit("warn", component, message, withBase(fields)),
    error: (message, fields) => emit("error", component, message, withBase(fields)),
    child: (extraFields) => createLogger(component, { ...baseFields, ...extraFields }),
  };
}

// ---------------------------------------------------------------------------
// OpenTelemetry metric helpers (thin wrapper over @opentelemetry/api)
// Vercel's registerOTel already instruments HTTP; these custom metrics are
// best-effort and no-op when OTEL is not configured (e.g., tests, local dev
// without collector). Failures never throw.
// ---------------------------------------------------------------------------

let otelMetrics: {
  recommendationLatency?: { record: (v: number, attrs?: Record<string, string | number>) => void };
  evidenceParserDuration?: { record: (v: number, attrs?: Record<string, string | number>) => void };
  vaApiLatency?: { record: (v: number, attrs?: Record<string, string | number>) => void };
  vaApiErrors?: { add: (v: number, attrs?: Record<string, string | number>) => void };
} | null = null;

let metricsInitAttempted = false;

function getMetrics(): typeof otelMetrics {
  if (metricsInitAttempted) return otelMetrics;
  metricsInitAttempted = true;
  try {
    // Lazy require so tests without OTEL still pass and bundling stays light.
    // `eval` avoids Next.js static analysis treating this as a hard dependency.
    const api: typeof import("@opentelemetry/api") = eval("require")("@opentelemetry/api");
    const meter = api.metrics.getMeter("secondary-condition-finder");
    otelMetrics = {
      recommendationLatency: meter.createHistogram("recommendation.latency.ms", {
        description: "Recommendation engine execution time",
        unit: "ms",
      }),
      evidenceParserDuration: meter.createHistogram("evidence.parser.duration.ms", {
        description: "Evidence parser (PDF/DOCX/OCR) duration per document",
        unit: "ms",
      }),
      vaApiLatency: meter.createHistogram("va.api.latency.ms", {
        description: "VA API request latency",
        unit: "ms",
      }),
      vaApiErrors: meter.createCounter("va.api.errors", {
        description: "Count of VA API errors by outcome",
      }),
    };
  } catch {
    otelMetrics = null;
  }
  return otelMetrics;
}

export function recordRecommendationLatency(durationMs: number, attributes: Record<string, string | number> = {}): void {
  try {
    getMetrics()?.recommendationLatency?.record(durationMs, attributes);
  } catch {
    // metrics are best-effort
  }
}

export function recordEvidenceParserDuration(durationMs: number, attributes: Record<string, string | number> = {}): void {
  try {
    getMetrics()?.evidenceParserDuration?.record(durationMs, attributes);
  } catch {
    // best-effort
  }
}

export function recordVaApiLatency(durationMs: number, attributes: Record<string, string | number> = {}): void {
  try {
    getMetrics()?.vaApiLatency?.record(durationMs, attributes);
  } catch {
    // best-effort
  }
}

export function recordVaApiError(attributes: Record<string, string | number> = {}): void {
  try {
    getMetrics()?.vaApiErrors?.add(1, attributes);
  } catch {
    // best-effort
  }
}
