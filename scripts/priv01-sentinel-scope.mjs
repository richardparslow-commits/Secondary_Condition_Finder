/**
 * Change scope for the PRIV-01 stage-4 browser sentinel gate.
 *
 * The sentinel walk (scripts/acceptance-browser-sentinel.mjs) is the privacy
 * acceptance contract's strongest evidence: it drives a real browser with
 * unique sentinels in every private field and then scans every surface they
 * could have reached. Running it is expensive — it needs a live app plus
 * headless Chrome and page-side OCR — so CI runs it only for pull requests
 * whose change set can plausibly move the browser-local privacy posture, and
 * always for non-PR events (push to main, manual dispatch).
 *
 * A path belongs in this scope when it can change what leaves the browser, or
 * what the walk itself exercises:
 *   - the workflow's own routes, step components and browser-local state;
 *   - the evidence/OCR pipeline and its self-hosted tesseract assets;
 *   - the client corpus the browser fetches;
 *   - the private-context refusal layer and the proxy that wires it;
 *   - the COOP/COEP headers that make the OCR worker cross-origin isolated;
 *   - the sentinel runner, the corpus builder and this scope module — the
 *     gate's own wiring, because changing it must re-earn the walk;
 *   - the privacy/contract suites that encode the same invariant, so a pull
 *     request that edits them re-runs the walk instead of assuming it holds.
 *
 * This module is deliberately dependency-free: CI resolves it through a
 * dynamic import from the workspace root, and
 * tests/priv01-sentinel-gate-wiring.test.ts imports the same matcher and walks
 * the load-bearing source directories on disk, failing when a file there
 * matches no pattern. A new privacy-bearing module therefore cannot be added
 * outside the gate's trigger scope.
 */

export const PRIV01_SENTINEL_SCOPE = Object.freeze([
  /^src\/app\/secondary\//,
  /^src\/components\/secondary\//,
  /^src\/components\/evidence\//,
  /^src\/lib\/secondary-workflow\//,
  /^src\/lib\/evidence\//,
  /^src\/lib\/client-corpus\//,
  /^src\/lib\/security\//,
  /^src\/lib\/workflow-session-crypto\.ts$/,
  /^src\/proxy\.ts$/,
  /^next\.config\.ts$/,
  /^public\/tesseract\//,
  /^scripts\/acceptance-browser-sentinel\.mjs$/,
  /^scripts\/priv01-sentinel-scope\.mjs$/,
  /^scripts\/build-client-corpus\.mjs$/,
  /^\.github\/workflows\/ci\.yml$/,
  /^tests\/(?:privacy|private-context|browser-local|secondary|workflow|local-ocr|ocr-session|evidence-(?:storage|extraction|architecture)|ingestion-privacy|observability-logger-privacy|proxy-security|retired-secondary|e2e-workflow)[^/]*\.test\.ts$/,
]);

/** Normalizes the repository-relative paths the GitHub API and git report. */
function normalizeRepositoryPath(filePath) {
  return String(filePath)
    .trim()
    .replace(/^\.\//, "")
    .replace(/^\//, "");
}

/** True when a repository-relative path is inside the sentinel gate's scope. */
export function matchesPriv01SentinelScope(filePath) {
  const normalized = normalizeRepositoryPath(filePath);
  return PRIV01_SENTINEL_SCOPE.some((pattern) => pattern.test(normalized));
}

/** The subset of a change set that must keep the sentinel gate green. */
export function priv01SentinelScopeMatches(filePaths) {
  return [...filePaths].filter(matchesPriv01SentinelScope);
}
