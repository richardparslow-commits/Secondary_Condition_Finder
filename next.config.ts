import { readdirSync } from "node:fs";
import { join } from "node:path";

import type { NextConfig } from "next";

/**
 * Baseline hardening headers applied to every route.
 *
 * Values are intentionally byte-identical to the duplicate set applied by
 * the edge proxy (src/proxy.ts) for middleware-constructed responses: when
 * two instances of `Strict-Transport-Security` or `X-Frame-Options` are
 * present, browsers honour the first / ignore duplicates, so a weaker
 * duplicate would silently downgrade protection.
 */
const securityHeaders = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

/**
 * Cross-Origin Isolation (COI) headers for the browser-local WASM OCR
 * architecture (tesseract.js in /tesseract/*, PDF worker).
 *
 * `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy:
 * require-corp` isolate the document from cross-origin windows and block any
 * cross-origin subresource that does not opt in via CORP/CORS. This is what
 * unlocks `crossOriginIsolated` state and SharedArrayBuffer in Web Workers
 * for the OCR pipeline — and it is safe to apply app-wide today because the
 * app loads zero cross-origin subresources: tesseract.js assets are
 * same-origin `/tesseract/*`, workers are same-origin blob:/module scripts,
 * and external VA links are plain navigations (`<a href>`), which COEP does
 * not restrict.
 *
 * If an external image, script, or iframe ever becomes a requirement on a
 * public route, add that path prefix to `COI_EXEMPT_PREFIXES` below (and
 * serve the resource with `Cross-Origin-Resource-Policy` or CORS headers);
 * it will then receive the baseline headers only.
 */
const crossOriginIsolationHeaders = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
];

/**
 * Route prefixes opted out of strict Cross-Origin Isolation.
 *
 * Empty today: no route embeds cross-origin subresources. Entries are path
 * prefixes (e.g. `/partner-embed`); they still receive `securityHeaders`,
 * they only forgo COOP/COEP. The source is regenerated whenever this list
 * changes, so the opt-out mechanism stays exercised rather than rotting in
 * a comment.
 */
export const COI_EXEMPT_PREFIXES: readonly string[] = [];

/**
 * Build the `source` pattern for the COI header rule.
 *
 * With no exemptions this is the blanket `/:path*`. Each exempt prefix is
 * escaped and folded into a negative lookahead so those prefixes (and only
 * they) fall outside the COI rule while the blanket baseline rule still
 * covers them. The lookahead applies *after* the pattern's leading slash
 * (the same convention as the proxy matcher's `_next/static`-style
 * alternatives), so prefix leading slashes are stripped and a `(?:/|$)`
 * boundary prevents longer sibling paths from being accidentally exempted.
 * `prefixes` is injectable for tests; production always uses the
 * `COI_EXEMPT_PREFIXES` constant.
 */
export function crossOriginIsolationSource(
  prefixes: readonly string[] = COI_EXEMPT_PREFIXES,
): string {
  const alternatives = prefixes
    .map((prefix) =>
      prefix
        .replace(/^\/+/, "")
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .trim(),
    )
    .filter((body) => body.length > 0)
    .map((body) => `${body}(?:/|$)`);
  if (alternatives.length === 0) return "/:path*";
  return `/((?!${alternatives.join("|")}).*)`;
}

/**
 * Cache policy for the unversioned static worker assets (`public/tesseract/*`
 * and `public/pdf.worker.min.mjs`).
 *
 * `immutable` is deliberately absent. Those URLs do not change when the
 * pinned `tesseract.js` / `pdfjs-dist` packages are upgraded, so a
 * year-long immutable entry would outlive a deploy and pair a stale worker or
 * WASM core with a new page bundle. One hour bounds that skew while still
 * avoiding a re-download of the 4.5 MiB core on a reload; `must-revalidate`
 * forbids serving the stale copy once the window closes.
 *
 * The same value is written into `public/_headers` for the Sites assets
 * binding, which answers before the Next.js worker and therefore never runs
 * `headers()`. `tests/static-asset-delivery.test.ts` pins both copies and
 * refuses `immutable` or a TTL beyond a day on these unversioned paths.
 */
export const STATIC_ASSET_CACHE_CONTROL = "public,max-age=3600,must-revalidate";

/**
 * Paths the cache policy covers, in Next.js `headers()` source syntax.
 *
 * The worker files are listed individually rather than as `/tesseract/:path*`
 * because `/tesseract/eng.traineddata.gz` is a rewrite to `/api/ocr-model`,
 * not an asset. A directory wildcard matched the incoming request and
 * replaced the route's one-year `immutable` header with this one-hour policy
 * (observed on a dev server), which would make every OCR model load
 * revalidate. A test enumerates `public/tesseract/` so a new asset cannot be
 * added without being listed here.
 */
export const STATIC_ASSET_CACHE_SOURCES = [
  "/tesseract/worker.min.js",
  "/tesseract/worker-guard.js",
  "/tesseract/coi-probe.js",
  "/tesseract/tesseract-core-simd.wasm.js",
  "/pdf.worker.min.mjs",
] as const;

const isAzureStaticWebAppsBuild = process.env.AZURE_STATIC_WEB_APPS_BUILD === "1";

/**
 * Directories under `data/` that must never reach a deployment artifact.
 *
 * `knowledge-base-quarantine/` holds retired, unapproved clinical mappings kept
 * exactly as delivered (REL-01). Nothing loads them, and shipping them would
 * put unreviewed drafts into production — which is what happened: the app-wide
 * tracing include matched this directory, so every server trace and the
 * standalone bundle carried it. This list is the single place a retirement is
 * registered, and `npm run audit:traces` fails if a quarantined file reaches an
 * artifact anyway (for example once a loader traces the data tree again).
 */
const RETIRED_DATA_DOMAINS = ["knowledge-base-quarantine"];

/**
 * Include every live data domain app-wide, without first including retired
 * content. Discover domains at build time so a new runtime domain is not
 * silently omitted from deployment. Keep route exclusions as defense-in-depth;
 * instrumentation's dynamic reads must preserve their own directory boundary.
 */
function runtimeDataTracingIncludes(): string[] {
  return readdirSync(join(process.cwd(), "data"), { withFileTypes: true })
    .filter((entry) =>
      entry.isDirectory()
        ? !RETIRED_DATA_DOMAINS.includes(entry.name)
        : entry.isFile() && entry.name.endsWith(".json"),
    )
    .map((entry) =>
      entry.isDirectory() ? `./data/${entry.name}/**/*.json` : `./data/${entry.name}`,
    )
    .sort();
}

function retiredDataTracingExcludes(): string[] {
  return RETIRED_DATA_DOMAINS.map((domain) => `./data/${domain}/**`);
}

const nextConfig: NextConfig = {
  ...(isAzureStaticWebAppsBuild ? { output: "standalone" as const } : {}),
  reactStrictMode: true,
  // Do not advertise the exact Next.js version on every response.
  poweredByHeader: false,
  /**
   * Compress responses on Node hosts (Docker, Azure, `next start`).
   *
   * This is Next.js's default, pinned explicitly because it is the only
   * server-side compression the app controls: the worker assets are plain
   * JavaScript, so they compress well, and switching this off would silently
   * send the 4.5 MiB OCR core uncompressed. This setting does not reach the
   * Sites deployment — Cloudflare's assets binding negotiates Brotli/gzip
   * itself — so `public/_headers` must never declare `Content-Encoding` or
   * `no-transform` for those files.
   */
  compress: true,
  /**
   * App-wide file-tracing include for the filesystem-backed knowledge base —
   * intentionally NOT scoped per route.
   *
   * The data directory is a genuine application-wide *server* dependency:
   * the memoized loaders in src/lib/{catalog,kb,presumptive,regulatory}/load
   * are imported by every secondary-workflow page, the presumptive pages,
   * /terms, the health API, both server-action modules, and the
   * instrumentation warmup (src/instrumentation.ts -> lib/data/preload).
   * Narrowing the include to individual routes (e.g. only
   * /api/regulatory/preflight) would omit data/*.json from the traced
   * standalone output of every other page that renders with
   * `loadConditionCatalog()` — a silent failure mode that only appears at
   * runtime as ENOENT in production, not in the build.
   *
   * Live domains are discovered below; retired domains are never included.
   * If the data approaches the serverless function budget, narrow per domain,
   * never per route.
   */
  outputFileTracingIncludes: {
    "/**": runtimeDataTracingIncludes(),
    // Node tracing selects pg-cloudflare's empty default export; OpenNext
    // bundles the workerd export instead and needs its socket implementation.
    "/api/internal/tiger-catalog-compare": ["./node_modules/pg-cloudflare/dist/index.js"],
  },
  /**
   * Retired data is subtracted from every route's trace.
   *
   * Dynamic loader tracing can still find retired data even though the
   * explicit include omits it. Retirement is registered once, in
   * RETIRED_DATA_DOMAINS, and `npm run audit:traces` fails if such a file reaches
   * any artifact, including the instrumentation trace and standalone bundle.
   * Instrumentation is not an App Router route, so its loader paths must remain
   * statically bounded rather than depending on these route exclusions.
   */
  outputFileTracingExcludes: {
    "/**": retiredDataTracingExcludes(),
  },
  /**
   * No custom `webpack()` key — a deliberate decision, not an omission.
   *
   * Next.js 16 builds with Turbopack by default and custom webpack
   * configuration is silently not applied, so a `webpack()` function here
   * would be dead config. Neither escape hatch it would provide is needed:
   * (1) `node:fs`/`node:path` are imported exclusively by server-only
   * modules (all loaders carry `import "server-only"`); no client component
   * touches Node built-ins, so there is nothing to externalize; (2) the OCR
   * WASM core is fetched at runtime from same-origin `/tesseract/*` by
   * tesseract.js — no `.wasm` file is imported through the bundler graph —
   * so `asyncWebAssembly` (or the Turbopack equivalent under the `turbopack`
   * key) would configure a feature the app does not use.
   */
  /**
   * Serve the OCR language model from its route, not from `public/`.
   *
   * The 10.4 MiB traineddata cannot live in the Sites upload (32 MiB for the
   * whole deployment, Worker included), but tesseract.js still requests the
   * canonical same-origin path. The route reads the pinned postinstall copy on
   * Node and a digest-verified copy of the same package file on Workers; see
   * `src/lib/evidence/ocr-model.ts`. Keeping the URL stable is what lets the
   * browser stay same-origin (`connect-src 'self'`) with no client change.
   */
  async rewrites() {
    return [{ source: "/tesseract/eng.traineddata.gz", destination: "/api/ocr-model" }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      ...STATIC_ASSET_CACHE_SOURCES.map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: STATIC_ASSET_CACHE_CONTROL }],
      })),
      {
        source: crossOriginIsolationSource(),
        headers: crossOriginIsolationHeaders,
      },
    ];
  },
};

export default nextConfig;
