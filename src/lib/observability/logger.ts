/**
 * Structured JSON logger for operational observability.
 *
 * Emits timestamped, JSON-formatted lines to stdout/stderr so Vercel / OTel
 * ingestors can collect them without extra infrastructure. No PII, no raw
 * evidence, no workflow payloads — callers must pass only sanitized fields.
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

function redactFields(fields: LogFields): LogFields {
  // Shallow copy and strip any accidental sensitive keys if present.
  const sanitized: LogFields = { ...fields };
  for (const key of ["payload", "rawText", "evidence", "cookie", "secret", "apiKey"]) {
    if (key in sanitized) delete (sanitized as Record<string, unknown>)[key];
  }
  return sanitized;
}

function emit(level: LogLevel, component: string, message: string, fields: LogFields = {}): void {
  // Keep test output quiet unless explicitly observed.
  if (isTestEnv() && level === "debug") return;

  const record = {
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
    ...redactFields(fields),
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
