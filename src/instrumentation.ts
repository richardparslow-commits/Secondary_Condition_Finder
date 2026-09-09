import { registerOTel } from "@vercel/otel";

export function register() {
  registerOTel({ serviceName: "secondary-condition-finder" });
  // Custom OTEL metrics (recommendation latency, VA API latency/errors,
  // evidence parser) are registered lazily via src/lib/observability/logger.ts
  // so they inherit the same OTel exporter without extra configuration.
}
