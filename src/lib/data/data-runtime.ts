import "server-only";

/**
 * Which source can this runtime read the authored `data/` tree from?
 *
 * The loaders read the repository's `data/` directory at request time on Node
 * (tests, `next dev`, Docker, Azure). Cloudflare Workers — the Sites target —
 * runs the same Next.js server bundle without a filesystem: `readdir` answers
 * ENOENT even though the files are in the repository, which made `/terms`,
 * `/presumptive` and the catalog checks in `/api/health` fail there.
 *
 * `NEXT_RUNTIME` cannot answer this: OpenNext sets it to `nodejs` for the
 * server bundle on Workers exactly as a Node host does. workerd identifies
 * itself through `navigator.userAgent` (`Cloudflare-Workers`), which is a
 * per-runtime fact rather than an adapter import, so the loaders stay usable in
 * every other deployment target without a build-time flag.
 *
 * Read per call, not captured at module scope, so a test can stub the user
 * agent and exercise both sources in one process.
 */
export const WORKERS_USER_AGENT = "Cloudflare-Workers";

/** True when this process can read `data/` from disk. */
export function hasDataFilesystem(): boolean {
  return typeof navigator === "undefined" || navigator.userAgent !== WORKERS_USER_AGENT;
}
