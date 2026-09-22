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

const isAzureStaticWebAppsBuild = process.env.AZURE_STATIC_WEB_APPS_BUILD === "1";

const nextConfig: NextConfig = {
  ...(isAzureStaticWebAppsBuild ? { output: "standalone" as const } : {}),
  reactStrictMode: true,
  // Do not advertise the exact Next.js version on every response.
  poweredByHeader: false,
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
   * The whole directory is ~7.2MB across ~857 files — comfortably inside the
   * ~50MB serverless function budget. If it ever approaches that limit, the
   * correct lever is narrowing per *domain* (e.g. drop a retired data/
   * subdirectory from the glob), never per route.
   */
  outputFileTracingIncludes: {
    "/**": ["./data/**/*.json"],
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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: crossOriginIsolationSource(),
        headers: crossOriginIsolationHeaders,
      },
    ];
  },
};

export default nextConfig;
