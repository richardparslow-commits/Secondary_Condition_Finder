import { createRequire } from "node:module";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ISSUE-012: the Workers fallback fetch must bound the whole exchange.
 *
 * A stalled header or body exchange used to keep the isolate-wide memo pending
 * forever, and an oversized mirror body was fully buffered before the digest
 * could reject it. These tests pin the 15-second deadline and 16 MiB cap for
 * both declared and actual body sizes, plus the unchanged pinned success path.
 */

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(
    Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" }),
  ),
}));

const realFs = createRequire(import.meta.url)("node:fs") as typeof import("node:fs");
const pinned = new Uint8Array(realFs.readFileSync(".data-bundle/ocr/eng.traineddata.gz"));

const MIB = 1024 * 1024;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("OCR model route — bounded fallback download", () => {
  it("aborts stalled headers, settles every concurrent caller, and retries after failure", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_url: RequestInfo | URL, options?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    vi.stubGlobal("fetch", fetcher);

    const { GET } = await import("@/app/api/ocr-model/route");
    const pending = [GET(), GET()];

    await vi.advanceTimersByTimeAsync(15_000);
    const responses = await Promise.all(pending);

    expect(responses.map((response) => response.status)).toEqual([502, 502]);
    expect(fetcher).toHaveBeenCalledOnce();

    fetcher.mockImplementationOnce(async () => new Response(null, { status: 503 }));
    expect((await GET()).status).toBe(502);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("aborts a stalled response body", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async (_url: RequestInfo | URL, options?: RequestInit) => (
      new Response(new ReadableStream({
        start(controller) {
          options?.signal?.addEventListener("abort", () => controller.error(new Error("aborted")));
        },
      }))
    )));

    const { GET } = await import("@/app/api/ocr-model/route");
    const pending = GET();
    await vi.advanceTimersByTimeAsync(15_000);

    expect((await pending).status).toBe(502);
  });

  it("refuses an excessive declared length without reading and cancels the body", async () => {
    let cancelled = false;
    let read = false;
    const body = new ReadableStream({
      pull() {
        read = true;
      },
      cancel() {
        cancelled = true;
      },
    }, { highWaterMark: 0 });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, {
      status: 200,
      headers: { "content-length": String(17 * MIB) },
    })));

    const { GET } = await import("@/app/api/ocr-model/route");

    expect((await GET()).status).toBe(502);
    expect(cancelled).toBe(true);
    expect(read).toBe(false);
  });

  it("caps actual streamed bytes when no declared length is available", async () => {
    let sent = 0;
    let cancelled = false;
    const chunk = new Uint8Array(MIB);
    const body = new ReadableStream({
      pull(controller) {
        sent += 1;
        controller.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    }, { highWaterMark: 0 });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body)));

    const { GET } = await import("@/app/api/ocr-model/route");

    expect((await GET()).status).toBe(502);
    expect(sent).toBe(17);
    expect(cancelled).toBe(true);
  });

  it("still serves the real digest-pinned model", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(pinned, { status: 200 })));

    const { GET } = await import("@/app/api/ocr-model/route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBe(pinned.byteLength);
  });
});
