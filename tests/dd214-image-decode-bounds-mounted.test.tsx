// @vitest-environment jsdom
/**
 * Mounted behaviour for the browser-local DD-214 analyzer (audit A06).
 *
 * The primitive suite (`tests/dd214-image-decode-bounds.test.ts`) proves
 * `planImageDecode`, `startOcrJobDeadline`, and `assemblePageOrderedText` are
 * correct in isolation; the structure suite
 * (`tests/dd214-local-analyzer-resource-controls.test.ts`) proves the component
 * calls them. Neither proves the component *behaves*: that a bomb-shaped image
 * is refused without spawning a worker, that a `recognize()` which never
 * settles is actually stopped by the elapsed-work budget, that Cancel tears a
 * live job down, or that a mixed PDF's retained text follows page order.
 *
 * These cases mount the real component and drive it through the file input —
 * the interface the Veteran uses — with pdf.js and the Tesseract factory
 * replaced by deterministic fakes. Every case asserts its own precondition
 * (the worker was/was not reached) so none can pass vacuously.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Dd214LocalAnalyzer } from "@/components/presumptive/Dd214LocalAnalyzer";
import { OCR_MAX_CANVAS_AREA_PX } from "@/lib/evidence/ocr-session";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const h = vi.hoisted(() => ({
  workerCreations: 0,
  terminateCalls: 0,
  recognizeInputs: [] as unknown[],
  /** Text the fake worker returns for a rendered page. */
  ocrText: "OCR PAGE TWO",
  /** When set, `recognize` never settles until `terminate` rejects it. */
  hangRecognize: false,
  pendingRejects: [] as Array<(error: Error) => void>,
  /** Page number → text-layer text (`null` = page has no text layer). */
  pageText: {} as Record<number, string | null>,
  numPages: 3,
  /** REL-05: a PDF whose load itself rejects (malformed structure). */
  pdfLoadRejects: false,
  pdfDestroys: 0,
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: { workerSrc: "about:blank" },
  getDocument: () => ({
    promise: h.pdfLoadRejects
      ? Promise.reject(new Error("Invalid PDF structure"))
      : Promise.resolve({
          numPages: h.numPages,
          getPage: async (page: number) => ({
            getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
            getTextContent: async () => {
              const text = h.pageText[page] ?? null;
              return { items: text ? text.split(" ").map((str) => ({ str })) : [] };
            },
            render: () => ({ promise: Promise.resolve() }),
            cleanup: () => {},
          }),
        }),
    destroy: async () => {
      h.pdfDestroys += 1;
    },
  }),
}));

vi.mock("@/lib/evidence/ocr-session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/evidence/ocr-session")>();
  return {
    ...actual,
    // Shortened budget, real implementation: the timer, the teardown call, the
    // disclosure, and the busy-state reset are all the production code paths;
    // only the five-minute duration is test-scaled so the case stays fast.
    OCR_JOB_DEADLINE_MS: 1_500,
    createLocalOcrWorker: async () => {
      h.workerCreations += 1;
      return {
        recognize: (input: unknown) => {
          h.recognizeInputs.push(input);
          if (h.hangRecognize) {
            // A WASM pass that never returns, as observed when the worker dies
            // mid-recognition: only terminate() settles the await.
            return new Promise((_resolve, reject) => {
              h.pendingRejects.push(reject);
            });
          }
          return Promise.resolve({ data: { text: h.ocrText } });
        },
        terminate: async () => {
          h.terminateCalls += 1;
          const pending = h.pendingRejects.splice(0);
          for (const reject of pending) reject(new Error("Worker was terminated"));
        },
      };
    },
  };
});

/* ─── Fixtures ────────────────────────────────────────────────────────────── */

/** PNG header (signature + IHDR) declaring the given dimensions, no pixel data. */
function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  bytes.set([(width >>> 24) & 0xff, (width >>> 16) & 0xff, (width >>> 8) & 0xff, width & 0xff], 16);
  bytes.set([(height >>> 24) & 0xff, (height >>> 16) & 0xff, (height >>> 8) & 0xff, height & 0xff], 20);
  return bytes;
}

function imageFile(bytes: Uint8Array, name = "dd214.png"): File {
  // `Uint8Array` is not a BlobPart in this TS lib, but a File accepts one at
  // runtime; the component reads it back through `file.arrayBuffer()`.
  return new File([bytes as unknown as BlobPart], name, { type: "image/png" });
}

function pdfFile(): File {
  return new File(["%PDF-1.4 fixture"], "scanned-records.pdf", { type: "application/pdf" });
}

function selectFile(file: File): void {
  fireEvent.change(screen.getByLabelText("DD-214 file"), { target: { files: [file] } });
}

/** Lets queued microtasks and timers drain inside React's act() scope. */
async function drain(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

let setItemSpy: ReturnType<typeof vi.spyOn>;
let getContextSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.sessionStorage.clear();
  h.workerCreations = 0;
  h.terminateCalls = 0;
  h.recognizeInputs = [];
  h.ocrText = "OCR PAGE TWO";
  h.hangRecognize = false;
  h.pendingRejects = [];
  h.pageText = { 1: "TEXT PAGE ONE", 2: null, 3: "TEXT PAGE THREE" };
  h.numPages = 3;
  h.pdfLoadRejects = false;
  h.pdfDestroys = 0;
  setItemSpy = vi.spyOn(Storage.prototype, "setItem");
  // jsdom has no 2D context; the component must still be driven through its
  // real render path, so the context is stubbed rather than the path skipped.
  getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue({ fillStyle: "", fillRect: () => {}, drawImage: () => {} } as never);
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async (_file: Blob, options?: { resizeWidth?: number; resizeHeight?: number }) => ({
      width: options?.resizeWidth ?? 100,
      height: options?.resizeHeight ?? 100,
      close: () => {},
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  getContextSpy.mockRestore();
  setItemSpy.mockRestore();
  window.sessionStorage.clear();
});

/* ─── Cases ───────────────────────────────────────────────────────────────── */

describe("DD-214 direct-image decode is bounded before decode (A06)", () => {
  it("refuses a bomb-shaped image from its header without spawning an OCR worker", async () => {
    render(<Dd214LocalAnalyzer locations={[]} />);
    selectFile(imageFile(pngHeader(10_000, 10_000)));

    // The refusal names the measured size so the Veteran can act on it.
    expect(
      await screen.findByText(/too large to analyze safely in this browser \(10000×10000\)/i),
    ).toBeTruthy();
    // Nothing was decoded and nothing was recognized.
    expect(h.workerCreations).toBe(0);
    expect(h.recognizeInputs).toHaveLength(0);
    expect(createImageBitmap).not.toHaveBeenCalled();
    // No state left behind, and no persistence on a refusal path.
    expect(screen.queryByText("Verify your service history")).toBeNull();
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it("refuses a container it cannot measure instead of guessing", async () => {
    render(<Dd214LocalAnalyzer locations={[]} />);
    selectFile(imageFile(new Uint8Array([1, 2, 3, 4])));

    expect(
      await screen.findByText(/could not be read in this browser\. Try a PNG or JPEG copy/i),
    ).toBeTruthy();
    expect(h.workerCreations).toBe(0);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it("hands the worker a bounded canvas, never the raw file, and discloses the downscale", async () => {
    render(<Dd214LocalAnalyzer locations={[]} />);
    selectFile(imageFile(pngHeader(4000, 3000)));

    expect(await screen.findByText(/DD-214 text extracted locally/i)).toBeTruthy();

    // The file itself was never given to OCR.
    expect(h.recognizeInputs).toHaveLength(1);
    const input = h.recognizeInputs[0];
    expect(input).not.toBeInstanceOf(File);
    expect(input).toBeInstanceOf(HTMLCanvasElement);
    const canvas = input as HTMLCanvasElement;
    // 12 MP at the scale-2 base would be 48 MP of canvas; the shared cap holds.
    expect(canvas.width * canvas.height).toBeLessThanOrEqual(OCR_MAX_CANVAS_AREA_PX);
    expect(
      screen.getByText(/downscaled to \d+×\d+ to stay within the browser memory budget/i),
    ).toBeTruthy();

    // The bounded canvas is released when the run ends, not left for GC.
    await waitFor(() => expect(canvas.width).toBe(0));
    expect(canvas.height).toBe(0);
    expect(h.terminateCalls).toBe(1);
  });
});

describe("DD-214 elapsed-work budget and cancellation (A06)", () => {
  it("stops a recognition that never settles and hands the tab back", async () => {
    // Slower than the shortened budget so the run is still parked when it fires.
    h.hangRecognize = true;
    render(<Dd214LocalAnalyzer locations={[]} />);
    selectFile(imageFile(pngHeader(1200, 900)));

    // The run is genuinely parked inside `recognize()` — a per-page boundary
    // check could never reach it, so only the elapsed-work budget can end it.
    await waitFor(() => expect(h.recognizeInputs).toHaveLength(1));
    expect(h.terminateCalls).toBe(0);
    const cancelButton = screen.getByRole("button", { name: "Cancel extraction" });

    expect(
      await screen.findByText(
        /reached the .* limit and was stopped/i,
        {},
        { timeout: 8_000 },
      ),
    ).toBeTruthy();
    await drain();

    // The budget terminated the live worker rather than waiting forever, and
    // released the tab instead of leaving the surface stuck busy.
    expect(h.terminateCalls).toBe(1);
    expect(cancelButton.isConnected).toBe(false);
    expect(screen.queryByText("Verify your service history")).toBeNull();
  });

  it("tears the live worker down on Cancel and reports the cancellation", async () => {
    h.hangRecognize = true;
    render(<Dd214LocalAnalyzer locations={[]} />);
    selectFile(imageFile(pngHeader(1200, 900)));

    await waitFor(() => expect(h.recognizeInputs).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Cancel extraction" }));
    await drain();


    expect(h.terminateCalls).toBe(1);
    expect(screen.getByText(/Extraction cancelled\. No fields were saved/i)).toBeTruthy();
    expect(screen.queryByText("Verify your service history")).toBeNull();
    // A cancelled run must not report a deadline stop on top of the cancel.
    expect(screen.queryByText(/reached the .*-minute limit/i)).toBeNull();
    expect(setItemSpy).not.toHaveBeenCalled();
  });
});

describe("a rejected PDF load still tears its task down (REL-05)", () => {
  it("destroys the loading task when the load itself rejects", async () => {
    h.pdfLoadRejects = true;
    render(<Dd214LocalAnalyzer locations={[]} />);
    selectFile(pdfFile());

    // The load really failed, and the surface said so instead of going quiet.
    expect(await screen.findByText(/Invalid PDF structure/)).toBeTruthy();
    await drain();

    // pdf.js allocates its worker when the task is created, so the task a
    // failed load created must still be destroyed. Awaiting the load outside
    // the teardown try skipped this and left it for the tab's lifetime.
    expect(h.pdfDestroys).toBe(1);
    // Nothing was decoded or recognized, and the tab was handed back.
    expect(h.workerCreations).toBe(0);
    expect(h.recognizeInputs).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Cancel extraction" })).toBeNull();
    expect(screen.queryByText("Verify your service history")).toBeNull();
  });

  it("does not carry a failed task into the next upload", async () => {
    h.pdfLoadRejects = true;
    render(<Dd214LocalAnalyzer locations={[]} />);
    selectFile(pdfFile());
    await screen.findByText(/Invalid PDF structure/);
    await drain();
    expect(h.pdfDestroys).toBe(1);

    // A second upload replaces the task handle with its own, so anything not
    // destroyed before that point is unreachable for the rest of the visit.
    h.pdfLoadRejects = false;
    selectFile(pdfFile());
    expect(await screen.findByText(/DD-214 text extracted locally/i)).toBeTruthy();
    await drain();
    expect(h.pdfDestroys).toBe(2);
  });
});

describe("mixed-PDF review keeps page order (A06)", () => {
  it("retains text pages and OCR'd pages in page order, in one pass of the budget", async () => {
    render(<Dd214LocalAnalyzer locations={[]} />);
    selectFile(pdfFile());

    expect(await screen.findByText(/DD-214 text extracted locally/i)).toBeTruthy();
    // Only the text-less page was OCR'd, and its text arrived.
    expect(h.recognizeInputs).toHaveLength(1);
    expect(
      screen.getByText(/1 of 3 pages had no extractable text; those pages were read with browser-local OCR\./),
    ).toBeTruthy();

    const preview = document.querySelector("pre");
    expect(preview).not.toBeNull();
    const raw = preview!.textContent ?? "";
    // Page order, not pass order: the OCR'd page 2 sits between 1 and 3.
    expect(raw.indexOf("TEXT PAGE ONE")).toBeGreaterThanOrEqual(0);
    expect(raw.indexOf("OCR PAGE TWO")).toBeGreaterThan(raw.indexOf("TEXT PAGE ONE"));
    expect(raw.indexOf("TEXT PAGE THREE")).toBeGreaterThan(raw.indexOf("OCR PAGE TWO"));
  });
});
