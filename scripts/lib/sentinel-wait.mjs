/** Poll one condition without overlapping requests or renewing the deadline. */
export async function waitForCondition({
  probe, label, timeoutMs, intervalMs = 400, now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), onProgress = () => {},
}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Wait timeout must be positive milliseconds.");
  const started = now();
  const deadline = started + timeoutMs;
  let last = null;
  // Reported to `onProgress` so a caller can tell "the probe answered false"
  // from "the probe threw". Those are different failures — a page that answers
  // is reachable, a page that throws on every probe is wedged — and only the
  // status distinguishes them.
  let status = "value";
  while (now() < deadline) {
    try {
      last = await probe(Math.max(1, Math.min(5_000, deadline - now())));
      status = "value";
      if (last === true) return;
    } catch (error) {
      last = error.message;
      status = "error";
    }
    onProgress({ label, elapsedMs: now() - started, last, status });
    const remaining = deadline - now();
    if (remaining <= 0) break;
    await sleep(Math.min(intervalMs, remaining));
  }
  throw new Error(`timed out waiting for ${label} (last=${JSON.stringify(last)})`);
}
