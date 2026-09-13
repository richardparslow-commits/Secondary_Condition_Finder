import { registerOTel } from "@vercel/otel";

export function register() {
  registerOTel({ serviceName: "secondary-condition-finder" });
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
