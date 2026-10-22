import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createLocalOcrWorker,
  LOCAL_OCR_WORKER_OPTIONS,
} from "@/lib/evidence/ocr-session";

/**
 * B04 regression contract: browser-local OCR worker spawning.
 *
 * Production enforces `require-trusted-types-for 'script'` with a strict
 * `default` policy that permits only same-origin http(s) script URLs. The
 * pinned tesseract.js v6 defaults `workerBlobURL` to true — it wraps
 * `workerPath` in a Blob and spawns `new Worker(URL.createObjectURL(blob))` —
 * which the policy correctly refuses, so DD-214/image OCR failed in the
 * production browser with "Trusted Types: refused non-same-origin script
 * URL". The fix is the library's direct same-origin worker mode via the
 * canonical factory; `worker-src 'self'` (no `blob:`) now also fails a
 * regression in browsers that do not enforce Trusted Types.
 *
 * These assertions execute the real factory (mocked module boundary) rather
 * than pattern-matching it, and separately pin that no OCR entry point
 * bypasses the factory with its own options object.
 */

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage?: (event: { data: object }) => void;
  onerror?: () => void;
  onmessageerror?: () => void;
  terminate = vi.fn();
  packets: { packet: { jobId: string; action: string; payload: object }; transfer: unknown[] }[] = [];
  constructor(public url: string) { FakeWorker.instances.push(this); }
  postMessage(packet: { jobId: string; action: string; payload: object }, transfer: unknown[] = []) {
    this.packets.push({ packet, transfer });
    queueMicrotask(() => this.onmessage?.({ data: { jobId: packet.jobId, status: "resolve", data: { text: "recognized locally" } } }));
  }
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const OCR_ENTRY_POINTS = [
  "src/components/presumptive/Dd214LocalAnalyzer.tsx",
  "src/components/evidence/LocalEvidenceAnalyzer.tsx",
];

describe("local OCR worker spawn contract", () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    vi.stubGlobal("Worker", FakeWorker);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("disables the blob wrapper so the worker loads as a direct same-origin script URL", () => {
    expect(LOCAL_OCR_WORKER_OPTIONS.workerBlobURL).toBe(false);
    // The guard worker installs the realm-local Trusted Types default policy
    // before importing the pinned tesseract worker (the worker realm enforces
    // TT and its importScripts(corePath) call is a TT sink with no policy).
    expect(LOCAL_OCR_WORKER_OPTIONS.workerPath).toBe("/tesseract/worker-guard.js");
    // Root-relative same-origin paths only — never a cross-origin CDN default.
    expect(LOCAL_OCR_WORKER_OPTIONS.workerPath.startsWith("/")).toBe(true);
    expect(LOCAL_OCR_WORKER_OPTIONS.corePath.startsWith("/")).toBe(true);
    expect(LOCAL_OCR_WORKER_OPTIONS.langPath.startsWith("/")).toBe(true);
  });

  it("initializes eng/LSTM-only in a direct same-origin worker", async () => {
    const client = await createLocalOcrWorker();
    const worker = FakeWorker.instances[0];
    expect(worker.url).toBe(LOCAL_OCR_WORKER_OPTIONS.workerPath);
    expect(worker.packets.map(({ packet }) => packet.action)).toEqual(["load", "loadLanguage", "initialize"]);
    expect(worker.packets[2].packet.payload).toEqual({ langs: "eng", oem: 1, config: {} });
    await client.terminate();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("transfers bitmaps without invoking main-thread canvas encoding", async () => {
    const bitmap = { close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    const canvas = { toBlob: vi.fn(), toDataURL: vi.fn() };
    const client = await createLocalOcrWorker();
    expect(await client.recognize(canvas as unknown as HTMLCanvasElement)).toEqual({ data: { text: "recognized locally" } });
    const sent = FakeWorker.instances[0].packets[3];
    expect(sent.transfer).toEqual([bitmap]);
    expect(sent.packet.payload).toMatchObject({ image: bitmap });
    expect(canvas.toBlob).not.toHaveBeenCalled();
    expect(canvas.toDataURL).not.toHaveBeenCalled();
    expect(bitmap.close).toHaveBeenCalledOnce();
    await client.terminate();
  });

  it("transfers file bytes and rejects use after termination", async () => {
    const client = await createLocalOcrWorker();
    await client.recognize(new Blob(["image bytes"]));
    expect(FakeWorker.instances[0].packets[3].transfer[0]).toBeInstanceOf(ArrayBuffer);
    await client.terminate();
    await expect(client.recognize(new Blob(["image bytes"]))).rejects.toThrow(/closed/);
  });

  it("rejects pending operations on worker error instead of hanging", async () => {
    const client = await createLocalOcrWorker();
    const worker = FakeWorker.instances[0];
    worker.postMessage = () => {};
    const result = client.recognize(new Blob(["image bytes"]));
    await new Promise((resolve) => setTimeout(resolve, 0));
    worker.onerror?.();
    await expect(result).rejects.toThrow(/worker failed/);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("terminates a worker that stalls during initialization when the caller aborts", async () => {
    // REL-05: the factory only returns after the load/loadLanguage/initialize
    // handshake, so a worker that stops answering before that leaves the caller
    // with no handle at all. Cancel, the deadline and unmount all found an empty
    // ref and the worker (and the busy tab) outlived them; the browser stress
    // run reproduced it. The signal is the teardown path for that window.
    const controller = new AbortController();
    const creation = createLocalOcrWorker({ signal: controller.signal });
    const worker = FakeWorker.instances[0];
    worker.postMessage = () => {}; // never answer: a hung WASM core
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(worker.terminate).not.toHaveBeenCalled();

    controller.abort();

    await expect(creation).rejects.toThrow(/cancelled|closed/i);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it("refuses an already-aborted creation instead of spawning an orphan worker", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(createLocalOcrWorker({ signal: controller.signal })).rejects.toThrow(/cancelled/i);
    expect(FakeWorker.instances).toHaveLength(1);
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
  });

  it("wires cancel, the deadline and unmount to the construction abort", () => {
    for (const entryPoint of OCR_ENTRY_POINTS) {
      const source = read(entryPoint);
      expect(source, entryPoint).toContain("createLocalOcrWorker({ signal:");
      // Both surfaces tear the construction window down through the same path
      // their cancel/deadline/unmount teardown already uses.
      expect(source, entryPoint).toContain("creationAbortRef.current?.abort()");
    }
  });

  it("provisions a guard worker that installs the narrow same-origin policy before importing tesseract", () => {
    // public/tesseract/ is gitignored and generated by the postinstall script;
    // that script is the single source of truth, and the provisioned file is
    // the artifact the browser actually executes.
    const generator = read("scripts/copy-pdf-worker.mjs");
    expect(generator).toContain("worker-guard.js");
    expect(generator).toContain('createPolicy("default"');
    expect(generator).toContain('importScripts("/tesseract/worker.min.js")');
    // The worker-realm policy is narrower than the document policy: only
    // self-hosted /tesseract/ script URLs, never arbitrary same-origin paths.
    expect(generator).toContain('indexOf("/tesseract/") === 0');
    expect(generator).not.toMatch(/createScript:\s*function[^}]*return/);

    const guard = read("public/tesseract/worker-guard.js");
    expect(guard).toContain('createPolicy("default"');
    expect(guard).toContain('importScripts("/tesseract/worker.min.js")');
    expect(guard).toContain("new OffscreenCanvas");
    expect(guard).toContain("canvas.convertToBlob");
    expect(guard).toContain("event.stopImmediatePropagation()");
    expect(guard).toContain("image.close()");
    // Fallback safety: if policy creation fails, the importScripts sink below
    // surfaces a clear refusal instead of hanging before onmessage registers.
    expect(guard).toContain("catch (err)");
  });

  it("never lets an OCR entry point build its own blob-capable worker", () => {
    for (const entryPoint of OCR_ENTRY_POINTS) {
      const source = read(entryPoint);
      expect(source, entryPoint).toContain("createLocalOcrWorker");
      // A local `createWorker(...)` call would default workerBlobURL to true
      // and reintroduce the production OCR failure.
      expect(source, entryPoint).not.toMatch(/createWorker\s*\(/);
      expect(source, entryPoint).not.toContain("workerPath:");
      expect(source, entryPoint).not.toContain("workerBlobURL");
    }
  });
});
