/**
 * Structured JSON logger for operational observability.
 *
 * Emits timestamped, JSON-formatted lines to stdout/stderr so platform log
 * ingest can collect them without extra infrastructure. No PII, no raw
 * evidence, no workflow payloads. Callers should still pass only sanitized
 * fields; at emit time `PROHIBITED_LOG_FIELDS` are suppressed recursively and
 * case-insensitively, and every remaining value must additionally match an
 * operational shape allowlist — an arbitrary string (an upstream error body,
 * a query string, a renamed field) is replaced with the redaction marker
 * instead of being written through.
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
/**
 * Value-shape validation for fields that are safe to log.
 *
 * A key blocklist cannot govern a free-form string: `error`, `message`, or a
 * renamed field can carry document text, an upstream response body, or a
 * query string through to stdout. Logged values are therefore accepted only
 * when their key and their shape are both on the operational allowlist;
 * every other value is replaced with the redaction marker.
 */
const SAFE_NUMERIC_FIELDS = new Set([
  "attempt", "status", "durationMs", "count", "failures", "delayMs", "bytes",
  "cooldownMs", "epoch", "sharedEpoch", "cleared",
  "primaryCount", "recommendationCount", "unmappedCount",
]);
const SAFE_TEXT_FIELDS: Readonly<Record<string, RegExp>> = {
  // API pathnames only: no scheme, host, query string, or fragment.
  path: /^\/[A-Za-z0-9._~\-/]{0,200}$/,
  route: /^\/[A-Za-z0-9._~\-/]{0,200}$/,
  requestId: /^[A-Za-z0-9-]{1,64}$/,
  service: /^[a-z0-9-]{1,64}$/,
  environment: /^(?:sandbox|production|development|test)$/,
  outcome: /^[a-z-]{1,32}$/,
  component: /^[a-z0-9-]{1,64}$/,
  action: /^[a-z-]{1,64}$/,
  source: /^[a-z0-9-]{1,64}$/,
  status: /^(?:success|failure|unauthorized)$/,
};
const SAFE_MESSAGES = new Set([
  "recommendation executed", "request handled",
  "CSRF origin mismatch", "CSRF origin not in dev allowlist", "CSRF referer mismatch", "CSRF: no Origin or Referer header on request",
  "circuit half-open; admitting a single probe", "circuit closed after success", "circuit re-opened from half-open", "circuit opened", "circuit opened by upstream rate limit",
  "va request blocked by circuit breaker", "va request http error", "va request retrying after transient error", "va request invalid payload", "va request success", "va request retrying after network/timeout",
  "va shared cache read http error", "va shared cache read error", "va shared cache read failed", "va shared cache write skipped — unserializable value", "va shared cache write skipped — value too large", "va shared cache write skipped — key not allowlisted", "va shared cache write skipped — epoch unavailable", "va shared cache write skipped — key budget exceeded", "va shared cache write skipped — key budget unavailable", "va shared cache write http error", "va shared cache write error", "va shared cache write failed",
  "va shared cache invalidation epoch advanced", "va shared cache invalidation epoch unavailable",
  "va shared fetch lease granted", "va shared fetch lease contended", "va shared fetch lease released", "va shared fetch lease unavailable",
  "va shared kv command failed",
  "shared circuit probe lease granted", "shared circuit probe lease released", "shared circuit cooldown published", "shared circuit cooldown publish incomplete",
]);
/** Code-controlled message families (never attacker input). */
const SAFE_MESSAGE_PATTERNS: readonly RegExp[] = [
  /^audit:[a-z-]{1,64}$/,
  /^va request [a-z-]{1,32}$/,
  /^va shared cache [a-z -]{1,64}$/,
];
const SAFE_COMPONENT_PATTERN = /^[a-z0-9-]{1,64}$/;

/** Suppressed values are replaced rather than dropped, so suppression stays auditable. */
const REDACTION_MARKER = "[redacted]";

/** Depth cap: bounds cost and terminates on accidental cyclic structures. */
const MAX_REDACTION_DEPTH = 8;

function isProhibitedKey(key: string): boolean {
  return PROHIBITED_LOG_FIELD_SET.has(key.toLowerCase());
}

function redactValue(key: string, value: unknown, depth: number): unknown {
  if (depth > MAX_REDACTION_DEPTH || isProhibitedKey(key)) return REDACTION_MARKER;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") {
    return SAFE_NUMERIC_FIELDS.has(key) && Number.isFinite(value) && value >= 0
      ? value
      : REDACTION_MARKER;
  }
  if (typeof value === "string") {
    return SAFE_TEXT_FIELDS[key]?.test(value) ? value : REDACTION_MARKER;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => redactValue(key, entry, depth + 1));
  }
  if (value && typeof value === "object") {
    const nested: Record<string, unknown> = {};
    for (const [name, entry] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
      nested[name] = redactValue(name, entry, depth + 1);
    }
    return nested;
  }
  return REDACTION_MARKER;
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
    sanitized[key] = redactValue(key, value, 1);
  }
  return sanitized as LogFields;
}

function emit(level: LogLevel, component: string, message: string, fields: LogFields = {}): void {
  // Keep test output quiet unless explicitly observed.
  if (isTestEnv() && level === "debug") return;

  const record = {
    timestamp: new Date().toISOString(),
    level,
    component: SAFE_COMPONENT_PATTERN.test(component) ? component : "application",
    message:
      SAFE_MESSAGES.has(message) || SAFE_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))
        ? message
        : "OPERATIONAL_EVENT",
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
