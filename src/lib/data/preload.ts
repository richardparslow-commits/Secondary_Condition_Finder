import "server-only";

/**
 * Async, non-blocking warmup for filesystem-backed knowledge data.
 *
 * Each loader (catalog, knowledge base, presumptives, regulatory actions)
 * does sync `readdirSync` + `readFileSync` + Zod parse on its first call.
 * On a cold Vercel/AWS Lambda start that work lands inside the first user's
 * request handler.  This helper is intended to run from `instrumentation.ts`
 * `register()` — the Next.js server startup hook that executes once per
 * worker before any request is dispatched — via `fire-and-forget` async I/O
 * (`fs/promises`) so the event loop is never blocked.
 *
 * Contract:
 *   - Shares the same module-level `cached`/`inflight` as the sync loaders,
 *     so a completed warmup turns the first `loadConditionCatalog()` etc. into
 *     a pure in-memory hit (zero filesystem work on the request path).
 *   - Best-effort. A fixed, content-free event records a failure but the
 *     exception is never serialized; the sync fallback remains on the request
 *     path if warmup races or fails.
 *   - Preserves existing validation semantics: throws on invalid JSON or
 *     duplicate ids would still surface on first request, never swallowed
 *     silently. Warmup failures are recorded without their diagnostic detail;
 *     `load*Async` rejects are captured here and will re-throw on the sync path.
 *   - Idempotent. Multiple register() calls (e.g. in tests) dedupe via the
 *     per-loader `inflight` promise so concurrent warmups do not fan out to
 *     N × file-count parallel reads.
 */

let warmupStarted = false;
let warmupPromise: Promise<void> | null = null;

async function doWarmup(): Promise<void> {
  const started = Date.now();
  try {
    // Load catalog first — KB cross-validates against it, so serial startup
    // avoids a spurious cross-catalog validation error.  Remaining loaders are
    // independent once catalog + KB are resident, so run them concurrently.
    const { loadConditionCatalogAsync } = await import("@/lib/catalog/load");
    const { loadKnowledgeBaseAsync } = await import("@/lib/kb/load");
    const { loadExposureCatalogAsync } = await import("@/lib/presumptive/load");
    const { loadRegulatoryActionRegistryAsync } = await import("@/lib/regulatory/load");

    await loadConditionCatalogAsync();
    await Promise.all([
      loadKnowledgeBaseAsync(),
      loadExposureCatalogAsync(),
      loadRegulatoryActionRegistryAsync(),
    ]);

    const elapsed = Date.now() - started;
    console.log(`[data-preload] warmup complete in ${elapsed}ms`);
  } catch {
    // Warmup errors can include filesystem paths or validation payloads; emit
    // only a fixed event name to the platform log sink.
    console.warn("[data-preload] warmup failed — falling back to per-request sync load");
  }
}

/**
 * Fire-and-forget warmup. Call from `instrumentation.ts` `register()`.
 *
 * Intentionally does not return a promise to callers — `register()` is
 * not awaited by Next.js and blocking it would stall server startup.
 * The warmup runs on `fs/promises` so the event loop stays unblocked.
 */
export function warmupDataCaches(): void {
  if (warmupStarted) return;
  warmupStarted = true;
  warmupPromise = doWarmup();
  // Prevent unhandled-rejection warnings if a loader throws before the
  // request-path sync fallback re-throws.
  warmupPromise.catch(() => {});
}

/** Test/ops seam: await the in-flight warmup. No-op if never started. */
export async function awaitDataWarmup(): Promise<void> {
  if (warmupPromise) await warmupPromise;
}

/** Test seam: resets dedupe so tests can re-trigger warmup. */
export function resetDataWarmupState(): void {
  warmupStarted = false;
  warmupPromise = null;
}
