import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OCR_MODEL_SHA256, sha256Hex } from "@/lib/evidence/ocr-model";

/**
 * Workers has no filesystem, so `/api/ocr-model` falls back to the pinned
 * package URL. This suite removes the bundled copy (the same ENOENT a Worker
 * sees) and proves the fallback is digest-verified: unreachable source and
 * substituted bytes both answer 502, and only the pinned bytes are served —
 * with the immutable cache header that keeps subsequent OCR loads cheap.
 *
 * It also pins the two failure modes the deployed preview actually produced:
 * the route must not touch the Workers Cache API (a Sites Worker is refused
 * with "This Worker is not permitted to access the default cache", which made
 * every OCR load a 500) and it must serve repeat requests from its per-isolate
 * memo instead of re-downloading 10.4 MiB.
 */

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(
    Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" }),
  ),
}));

const realFs = createRequire(import.meta.url)("node:fs") as typeof import("node:fs");
const pinned = new Uint8Array(realFs.readFileSync(".data-bundle/ocr/eng.traineddata.gz"));

beforeEach(() => {
  // A fresh module registry per test: the route memoizes the verified bytes in
  // module scope, and one test's success must not leak into another's.
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OCR model route — pinned download fallback", () => {
  it("fails closed when the pinned source is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const { GET } = await import("@/app/api/ocr-model/route");
    const response = await GET();

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("OCR language data is unavailable.");
  });

  it("refuses a 200 response whose bytes do not match the pinned digest", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new TextEncoder().encode('{"not":"the model"}'), { status: 200 }),
      ),
    );

    const { GET } = await import("@/app/api/ocr-model/route");
    const response = await GET();

    expect(response.status).toBe(502);
    expect(await response.text()).toBe("OCR language data is unavailable.");
  });

  it("serves the verified download once and reuses it within the isolate", async () => {
    expect(await sha256Hex(pinned)).toBe(OCR_MODEL_SHA256);
    const fetchMock = vi.fn().mockResolvedValue(new Response(pinned, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("@/app/api/ocr-model/route");
    const response = await GET();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/gzip");
    expect(response.headers.get("cache-control")).toContain("immutable");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes.byteLength).toBe(pinned.byteLength);
    expect(await sha256Hex(bytes)).toBe(OCR_MODEL_SHA256);

    // Second load: same verified bytes, no second download.
    const again = await GET();
    expect(again.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("serves the model even where the Workers Cache API is refused", async () => {
    // Reproduces the deployed Sites failure verbatim: touching `caches.default`
    // throws, so the route must never depend on it.
    vi.stubGlobal("caches", {
      get default(): never {
        throw new Error("This Worker is not permitted to access the default cache.");
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(pinned, { status: 200 })));

    const { GET } = await import("@/app/api/ocr-model/route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await sha256Hex(new Uint8Array(await response.arrayBuffer()))).toBe(OCR_MODEL_SHA256);
  });
});
