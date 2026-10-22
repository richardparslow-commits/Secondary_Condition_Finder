import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import nextConfig, {
  STATIC_ASSET_CACHE_CONTROL,
  STATIC_ASSET_CACHE_SOURCES,
} from "../next.config";
import { OCR_MODEL_CACHE_CONTROL, OCR_MODEL_PATH } from "../src/lib/evidence/ocr-model";

/**
 * Static-asset delivery contract.
 *
 * Two hosts serve these files and only one of them runs Next.js. On Vercel and
 * Node the app's `headers()` applies; on the Sites/Cloudflare deployment the
 * assets binding answers first and `public/_headers` is the only thing that
 * controls the response. A cache policy that exists in one place and not the
 * other is therefore a silent difference in what users are served, so both
 * copies are asserted here.
 *
 * The assets are unversioned (`/tesseract/worker.min.js`, not
 * `/tesseract/worker.<hash>.min.js`), which is why `immutable` is refused: a
 * year-long immutable entry would survive a dependency upgrade and pair a
 * stale worker or WASM core with the new page bundle that requests it.
 *
 * Compression is deliberately not declared. Both hosts negotiate it from the
 * JavaScript content type, and a static `Content-Encoding` would either
 * suppress that or claim an encoding the bytes do not have.
 */

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

/** `public/_headers` scope for each `headers()` source. */
function headersFileScope(source: (typeof STATIC_ASSET_CACHE_SOURCES)[number]): string {
  return source.startsWith("/tesseract/") ? "/tesseract/*" : source;
}

async function headerRules(): Promise<HeaderRule[]> {
  const rules = (await nextConfig.headers?.()) as HeaderRule[] | undefined;
  if (!rules) throw new Error("next.config.ts must define headers()");
  return rules;
}

const headersFile = (): string =>
  readFileSync(join(process.cwd(), "public/_headers"), "utf8").replace(/\r\n/g, "\n");

/**
 * Parse the `_headers` file into scope → header map.
 *
 * Comments are stripped first so the leading documentation block does not hide
 * the first rule; a blank line separates rules, exactly as the file-format
 * spec and Cloudflare's parser define it.
 */
function headersFileRules(): Map<string, Map<string, string>> {
  const rules = new Map<string, Map<string, string>>();
  for (const block of headersFile().split(/\n\s*\n/)) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
    if (lines.length < 2 || !lines[0].startsWith("/")) continue;
    rules.set(
      lines[0],
      new Map(
        lines.slice(1).map((line) => {
          const separator = line.indexOf(":");
          return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
        }),
      ),
    );
  }
  return rules;
}

describe("static worker-asset cache policy", () => {
  it("revalidates unversioned URLs instead of marking them immutable", () => {
    expect(STATIC_ASSET_CACHE_CONTROL).not.toContain("immutable");
    expect(STATIC_ASSET_CACHE_CONTROL).toContain("must-revalidate");

    const maxAge = Number(/max-age=(\d+)/.exec(STATIC_ASSET_CACHE_CONTROL)?.[1]);
    // A missing or non-numeric TTL would leave the policy meaningless; a TTL
    // beyond a day would recreate the stale-worker problem `immutable` has.
    expect(Number.isFinite(maxAge)).toBe(true);
    expect(maxAge).toBeGreaterThan(0);
    expect(maxAge).toBeLessThanOrEqual(86_400);
  });

  it("does not re-cache the OCR model rewrite", () => {
    // The model is 10.4 MiB and digest-pinned; its route serves it immutable
    // for a year. A directory wildcard here matched the incoming
    // `/tesseract/eng.traineddata.gz` request and downgraded it to this
    // policy, so the sources are explicit and the model path must stay out.
    expect(OCR_MODEL_PATH).toBe("/tesseract/eng.traineddata.gz");
    expect(OCR_MODEL_CACHE_CONTROL).toContain("immutable");
    expect(STATIC_ASSET_CACHE_SOURCES).not.toContain(OCR_MODEL_PATH);
    expect(STATIC_ASSET_CACHE_SOURCES.some((source) => source.includes(":path"))).toBe(false);
  });

  it("emits the policy from next.config for Node hosts", async () => {
    const rules = await headerRules();

    for (const source of STATIC_ASSET_CACHE_SOURCES) {
      const rule = rules.find((candidate) => candidate.source === source);
      const cacheControl = rule?.headers.find((header) => header.key === "Cache-Control");
      expect(cacheControl?.value, source).toBe(STATIC_ASSET_CACHE_CONTROL);
    }

    // The blanket rule must not set a competing Cache-Control: `headers()`
    // rules merge, and a second value on the same response is undefined.
    const blanket = rules.find((rule) => rule.source === "/:path*");
    expect(blanket?.headers.some((header) => header.key === "Cache-Control")).toBe(false);
  });

  it("mirrors the policy in public/_headers for the Sites assets binding", () => {
    const rules = headersFileRules();

    for (const scope of new Set(STATIC_ASSET_CACHE_SOURCES.map(headersFileScope))) {
      const block = rules.get(scope);
      expect(block, scope).toBeDefined();
      expect(block?.get("Cache-Control"), scope).toBe(STATIC_ASSET_CACHE_CONTROL);
      // The isolation headers these files need must survive the added rule.
      expect(block?.get("Cross-Origin-Embedder-Policy"), scope).toBe("require-corp");
      expect(block?.get("Cross-Origin-Resource-Policy"), scope).toBe("same-origin");
    }

    // The framework cache rule is generated by the Sites build and replaced by
    // this file; it must keep its own (hashed, therefore immutable) policy.
    expect(rules.get("/_next/static/*")?.get("Cache-Control")).toBe(
      "public,max-age=31536000,immutable",
    );
  });

  it("leaves compression to the host on both deployment paths", () => {
    expect(nextConfig.compress).toBe(true);

    const raw = headersFile();
    // A declared encoding either suppresses host compression or describes
    // bytes that are not actually encoded. Match header lines only: the
    // comments above the rules name both headers to explain why they are
    // absent.
    expect(raw).not.toMatch(/^\s*Content-Encoding:/im);
    expect(raw).not.toMatch(/^\s*Cache-Control:.*no-transform/im);
  });

  it("covers every public worker asset and only compressible scripts", () => {
    const tesseractDir = join(process.cwd(), "public", "tesseract");
    const files = readdirSync(tesseractDir).filter((file) => !file.startsWith("."));

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(file, `${file} must be a compressible script`).toMatch(/\.(?:js|mjs)$/);
      // Enumerated coverage: a new asset fails here until it is listed, so it
      // cannot silently inherit a policy written for different bytes.
      expect(STATIC_ASSET_CACHE_SOURCES, file).toContain(`/tesseract/${file}`);
    }

    expect(readdirSync(join(process.cwd(), "public"))).toContain("pdf.worker.min.mjs");
    expect(STATIC_ASSET_CACHE_SOURCES).toContain("/pdf.worker.min.mjs");
  });
});
