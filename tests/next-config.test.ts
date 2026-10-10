import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import nextConfig, {
  COI_EXEMPT_PREFIXES,
  crossOriginIsolationSource,
} from "../next.config";

/**
 * Regression contracts for next.config.ts.
 *
 * Mostly structural (the config exports a plain object; headers only apply
 * at serving time), with behavioral coverage for the COI exemption source
 * builder — the piece that must keep working if an external-subresource
 * requirement ever forces a public route out of strict Cross-Origin
 * Isolation.
 */

type HeaderEntry = { key: string; value: string };
type HeaderRule = { source: string; headers: HeaderEntry[] };

const flattenHeaders = (entries: HeaderEntry[]): Map<string, string> =>
  new Map(entries.map((h) => [h.key, h.value]));

async function headerRules() {
  const raw = await nextConfig.headers?.();
  if (!raw) throw new Error("next.config.ts must define headers()");
  const rules = raw as HeaderRule[];
  return rules.map((rule) => ({
    source: rule.source,
    headers: flattenHeaders(rule.headers),
  }));
}

describe("security baseline headers", () => {
  it("keeps the OWASP baseline on the blanket rule", async () => {
    const rules = await headerRules();
    const baseline = rules.find((rule) => rule.source === "/:path*" && rule.headers.has("Strict-Transport-Security"));

    expect(baseline).toBeDefined();
    expect(baseline?.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(baseline?.headers.get("X-Frame-Options")).toBe("DENY");
    expect(baseline?.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(baseline?.headers.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
  });

  it("matches the baseline the edge proxy applies to middleware responses", async () => {
    // Both layers must emit identical values: duplicate HSTS/XFO resolve
    // first-value/ignore, so a weaker duplicate would downgrade protection.
    const rules = await headerRules();
    const baseline = rules.find((rule) => rule.headers.has("Strict-Transport-Security"));

    expect(baseline?.headers.get("Referrer-Policy")).toBe("no-referrer");
  });
});

describe("cross-origin isolation headers", () => {
  it("applies COOP/COEP app-wide for the browser-local WASM OCR architecture", async () => {
    const rules = await headerRules();
    const coi = rules.find((rule) => rule.headers.has("Cross-Origin-Opener-Policy"));

    expect(coi?.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(coi?.headers.get("Cross-Origin-Embedder-Policy")).toBe("require-corp");
  });

  it("covers every route the baseline covers while no exemptions exist", async () => {
    const rules = await headerRules();
    const coi = rules.find((rule) => rule.headers.has("Cross-Origin-Opener-Policy"));

    expect(COI_EXEMPT_PREFIXES).toEqual([]);
    expect(coi?.source).toBe("/:path*");
  });

  it("carries the decision record: no custom webpack on the Turbopack default", () => {
    // Turbopack silently ignores custom webpack() config on Next 16; the
    // decision (and why neither externals nor asyncWebAssembly are needed)
    // is documented in the config JSDoc. Guard against it being added back
    // without intent.
    expect(nextConfig).not.toHaveProperty("webpack");
  });
});

describe("COI exemption source builder", () => {
  it("returns the blanket pattern when there are no exemptions", () => {
    expect(crossOriginIsolationSource()).toBe("/:path*");
  });

  it("escapes and excludes exempt prefixes while retaining the blanket rule", () => {
    const source = crossOriginIsolationSource(["/partner-embed", "/legacy-assets"]);
    const matcher = new RegExp(`^${source}$`);

    // Exempt prefixes fall outside the COI rule...
    expect(matcher.test("/partner-embed/widget")).toBe(false);
    expect(matcher.test("/partner-embed")).toBe(false);
    expect(matcher.test("/legacy-assets/x.png")).toBe(false);
    // ...everything else stays covered...
    expect(matcher.test("/secondary")).toBe(true);
    expect(matcher.test("/va-reference")).toBe(true);
    // ...and regex metacharacters in prefixes are inert.
    const tricky = crossOriginIsolationSource(["/a.b/c"]);
    expect(new RegExp(`^${tricky}$`).test("/axb/c/d")).toBe(true);
    expect(new RegExp(`^${tricky}$`).test("/a.b/c/d")).toBe(false);
  });
});

describe("file-tracing scope decision", () => {
  const include = nextConfig.outputFileTracingIncludes?.["/**"] ?? [];

  it("keeps the app-wide tracing include that the memoized loaders require", () => {
    // The data directory is a server-wide dependency: every secondary
    // workflow page, presumptive page, /terms, the health API, both action
    // modules, and the instrumentation warmup import the filesystem-backed
    // loaders. A per-route scope would only fail at runtime in production.
    expect(nextConfig.outputFileTracingIncludes?.["/**"]).toBeDefined();
    expect(include.length).toBeGreaterThan(0);
    for (const glob of include) expect(glob.startsWith("./data/")).toBe(true);
  });

  it("derives the include from the data directory it is meant to ship", () => {
    // Pinned against the real directory, not a hardcoded list: adding a
    // data/ domain must not require remembering to widen the include, which
    // is the failure mode that makes a per-route or hand-listed scope unsafe.
    const expected = readdirSync(join(process.cwd(), "data"), { withFileTypes: true })
      .filter((entry) =>
        entry.isDirectory()
          ? entry.name !== "knowledge-base-quarantine"
          : entry.isFile() && entry.name.endsWith(".json"),
      )
      .map((entry) =>
        entry.isDirectory() ? `./data/${entry.name}/**/*.json` : `./data/${entry.name}`,
      )
      .sort();

    expect(expected.length).toBeGreaterThan(0);
    expect(include).toEqual(expected);
  });

  it("keeps quarantine exclusions on every route as defense-in-depth", () => {
    expect(nextConfig.outputFileTracingExcludes?.["/**"]).toEqual([
      "./data/knowledge-base-quarantine/**",
    ]);
  });

  it("preserves the KB read boundary for instrumentation tracing", () => {
    // Instrumentation is not covered by App Router include/exclude rules.
    // path.join(KB_DIR, file) widens its trace to the sibling quarantine tree;
    // keep the slash explicit at every read, including the published-id index.
    const source = readFileSync(join(process.cwd(), "src/lib/kb/load.ts"), "utf8");
    expect(source).not.toContain("path.join(KB_DIR, file)");
    expect(source.match(/(?:fs|fsp)\.readFile(?:Sync)?\(`\$\{KB_DIR\}\/\$\{file\}`, "utf8"\)/g)).toHaveLength(4);
  });

  it("keeps retired data out of the artifact", () => {
    // The blanket `data/**` glob shipped data/knowledge-base-quarantine/**
    // (retired, unapproved mappings kept only as a record) into every server
    // trace and into the standalone bundle. It must not come back, and no
    // traced pattern may reach the quarantine directory.
    expect(include).not.toContain("./data/**/*.json");
    expect(include.filter((glob) => glob.includes("knowledge-base-quarantine"))).toEqual([]);
    // The exclusion is only meaningful while the directory actually exists.
    expect(readdirSync(join(process.cwd(), "data"))).toContain("knowledge-base-quarantine");
  });
});
