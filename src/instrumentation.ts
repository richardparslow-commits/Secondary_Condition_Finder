import { AUTOMATIC_TRACE_EXPORT } from "@/lib/observability/telemetry-policy";

export function register() {
  // Automatic trace export is policy-gated: see telemetry-policy.ts for the
  // decision and the requirements to re-enable it, and
  // tests/telemetry-policy.test.ts for the canaries that enforce it. Do not
  // call `registerOTel` while the policy is disabled — framework spans would
  // carry query strings and exception text past the application log redaction.
  if (AUTOMATIC_TRACE_EXPORT.enabled) {
    // Deliberately empty while the policy is disabled: enabling this branch
    // requires the sanitizing processor plus the collector review first.
  }
  if (process.env.NEXT_RUNTIME === "edge") return;
  // Custom OTEL metrics (recommendation latency, VA API latency/errors,
  // evidence parser) are registered lazily via src/lib/observability/logger.ts
  // so they inherit the same OTel exporter without extra configuration.

  // Non-blocking warmup of filesystem-backed knowledge data (catalog, KB,
  // presumptives, regulatory).  Uses async fs/promises so the event loop
  // stays unblocked; shares the same module caches as the sync loaders so a
  // completed warmup turns the first user request into a pure memory hit.
  // Best-effort — failures are logged and the sync fallback remains.
  // Dynamic import avoids loading the preload module (and its transitive
  // data dependencies) during `next build` collection.
  import("@/lib/data/preload")
    .then(({ warmupDataCaches }) => warmupDataCaches())
    .catch(() => {
      // Warmup is advisory; never block server startup.
    });
}
