/**
 * Telemetry policy for automatic (framework-generated) trace export.
 *
 * Audit A-04: the installed Next.js fetch instrumentation builds span names and
 * `http.url` attributes from the full request URL — including query strings
 * such as the Forms search text and the accredited-representative ZIP — and the
 * SDK serializes exception text. None of that passes through the application log
 * redaction, and collector retention/access/geography settings are still an
 * operator input. Automatic trace export is therefore deliberately disabled:
 * `registerOTel` is not called, no SDK provider is registered, and the custom
 * OTel metrics in `logger.ts`/`metrics.ts` stay no-ops.
 *
 * Re-enabling requires ALL of the following first:
 * 1. a sanitizing span processor/exporter that strips query strings, URL
 *    credentials, sensitive span names, and exception text before export;
 * 2. canary tests proving those sinks cannot carry query/ZIP/evidence values
 *    (see `tests/telemetry-policy.test.ts`);
 * 3. reconciled privacy, retention, and observability documentation plus the
 *    collector retention/access/deletion answers requested by the audit.
 */
export interface AutomaticTraceExportPolicy {
  /** True only when sanitization and collector review are complete. */
  enabled: boolean;
  status: "disabled-pending-review" | "enabled";
  reason: string;
}

export const AUTOMATIC_TRACE_EXPORT: AutomaticTraceExportPolicy = {
  enabled: false,
  status: "disabled-pending-review",
  reason:
    "Automatic framework spans can carry full request URLs (query strings), span names, and exception text past the application log redaction; disabled until span/URL/exception sanitization and collector retention review are complete.",
};
