# Observability Metrics

## Overview

The application uses [OpenTelemetry](https://opentelemetry.io/) (via `@vercel/otel`) for instrumentation. Custom metrics are registered lazily through `src/lib/observability/logger.ts` and `src/lib/engine/metrics.ts` — they inherit the same OTel exporter configured in `src/instrumentation.ts`.

All metric recording is **best-effort**: if OTEL is not configured (tests, local dev without a collector), the recording functions silently become no-ops. Failures never throw.

---

## Engine-Phase Metrics (`src/lib/engine/metrics.ts`)

The recommendation engine records per-phase latency via **OTEL Histograms** and invocation counts via **OTEL Counters**. These metrics enable performance monitoring, regression detection, and diagnosis of slow recommendation requests.

### Histograms

| Metric | Unit | Description |
|---|---|---|
| `engine.consensus.duration.ms` | ms | Time spent in the consensus ranking loop (iterating primaries × suggestions, accumulating scores, consensus tiers, and per-suggestion signal extraction dispatch). |
| `engine.signals.duration.ms` | ms | Cumulative time spent in signal extraction — `findAlternativeEtiologyWarnings` + `findChronologyWarnings` — across all primaries × suggestions. Accumulated per-iteration. |
| `engine.pathways.duration.ms` | ms | Cumulative time spent in `findIntermediatePathways` — bounded two-edge pathway discovery through published mappings. Accumulated per-primary. |
| `engine.result.duration.ms` | ms | Time spent building the final `Recommendation[]` array: mapping accumulator entries to typed results, `matchIntakeContext`, sorting by score, and Focus Engine `diagnosedConditionIds` filtering. |
| `engine.total.duration.ms` | ms | End-to-end wall-clock time for the entire `recommendImpl` call (all phases combined). |

### Counters

| Metric | Description |
|---|---|
| `engine.cycles.total` | Total recommendation engine invocations (incremented once per call). |
| `engine.recommendations.total` | Total recommendations produced across all invocations (incremented by the count of results in each call). |

### Attributes

All engine metrics accept optional attributes for dimensional analysis:

| Attribute | Type | Description |
|---|---|---|
| `primaryCount` | string | Number of recognized primary conditions in the intake. |
| `recommendationCount` | string | Number of recommendations produced. |

### Debug Logging

When `NODE_ENV` is not `"production"` or `"test"`, `debugLogPhaseTimings()` emits a JSON-structured debug line to stdout with per-phase timings and metadata. This is useful for local profiling without a collector.

---

## Legacy / Top-Level Metrics (`src/lib/observability/logger.ts`)

| Metric | Unit | Description |
|---|---|---|
| `recommendation.latency.ms` | ms | End-to-end recommendation engine execution time (kept for backward compatibility with existing dashboards). |
| `evidence.parser.duration.ms` | ms | Evidence parser (PDF/DOCX/OCR) duration per document. |
| `va.api.latency.ms` | ms | VA API request latency. |
| `va.api.errors` | count | Count of VA API errors by outcome. |

---

## Configuration

Metrics are automatically exported when `@vercel/otel` is registered in `src/instrumentation.ts`. No additional configuration is needed — the custom metrics use the same OTel meter (`secondary-condition-finder` / `secondary-condition-finder-engine`) and exporter as the framework-instrumented HTTP metrics.

### Local Development

Without a collector, metrics silently no-op. To observe them locally:

```bash
# Start a Jaeger instance for local tracing/metrics
docker run -d --name jaeger \
  -e COLLECTOR_OTLP_ENABLED=true \
  -p 16686:16686 \
  -p 4317:4317 \
  jaegertracing/all-in-one:latest
```

Then configure the OTel exporter endpoint via `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317`.

---

## Engine Pipeline Phases

The recommendation engine (`src/lib/engine/recommend.ts`) processes through these phases:

1. **Catalog Recognition** — Match intake primary conditions against the condition catalog.
2. **Consensus Ranking** (`engine.consensus.duration.ms`) — For each recognized primary with a published mapping, iterate suggestions and accumulate: rank-weighted scores, etiological consensus tiers, contributing primaries, evidence gaps, source references, and clinical friction/chronology warnings.
3. **Signal Extraction** (`engine.signals.duration.ms`) — Per-suggestion: `findAlternativeEtiologyWarnings` (history overlap with alternative etiologies) + `findChronologyWarnings` (timeline ordering flags). Accumulated across all iterations.
4. **Pathway Building** (`engine.pathways.duration.ms`) — Per-primary: `findIntermediatePathways` discovers bounded two-edge research paths through published mappings to diagnosed targets. Accumulated across primaries.
5. **Result Assembly** (`engine.result.duration.ms`) — Map accumulator entries to typed `Recommendation[]`, run `matchIntakeContext`, sort by score descending, apply Focus Engine filtering.
