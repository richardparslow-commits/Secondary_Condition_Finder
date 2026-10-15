// @vitest-environment jsdom
/**
 * Mounted behaviour for the browser-local evidence OCR job budget (audit
 * HARD-01 / A06 parity).
 *
 * `tests/local-ocr-cleanup-contract.test.ts` and
 * `tests/local-ocr-cancellation-fence.test.ts` pin the structure of
 * `runLocalOcr`; neither can show that a `recognize()` which never settles is
 * actually stopped. That is the whole point of the elapsed-work budget: a
 * per-page check only runs at a page boundary, and a hung await never returns
 * to one, so the tab would stay busy with a live worker behind it forever.
 *
 * These cases mount the real component and drive it through the file input and
 * the Local OCR action — the interface the Veteran uses — with pdf.js and the
 * Tesseract factory replaced by deterministic fakes. Each case asserts its own
 * precondition (the run really was parked inside `recognize()`, or really did
 * complete pages first) so none can pass vacuously.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocalEvidenceAnalyzer } from "@/components/evidence/LocalEvidenceAnalyzer";
import {
  OCR_CHECKPOINT_STORAGE_KEY,
  OCR_PAGES_PER_CHUNK,
} from "@/lib/evidence/ocr-session";

const h = vi.hoisted(() => ({
  numPages: 10,
  workerCreations: 0,
  terminateCalls: 0,
  destroyCalls: 0,
  recognizeCalls: 0,
  /** Page at which `recognize()` stops settling: the production hang shape. */
  hangFromPage: 1,
  pendingRejects: [] as Array<(error: Error) => void>,
  /** REL-05: a PDF whose load itself rejects (malformed structure). */
  pdfLoadRejects: false,
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: { workerSrc: "about:blank" },
  getDocument: () => ({
    promise: h.pdfLoadRejects
      ? Promise.reject(new Error("Invalid PDF structure"))
      : Promise.resolve({
          numPages: h.numPages,
          getPage: async () => ({
            getViewport: ({ scale }: { scale: number }) => ({
              width: 612 * scale,
              height: 792 * scale,
            }),
            render: () => ({ promise: Promise.resolve() }),
            cleanup: () => {},
          }),
        }),
    destroy: async () => {
      h.destroyCalls += 1;
    },
  }),
}));

vi.mock("@/lib/evidence/ocr-session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/evidence/ocr-session")>();
  return {
    ...actual,
    // Shortened budget, real implementation: the timer, the teardown call, the
    // disclosure, and the busy reset are all production code paths; only the
    // five-minute duration is test-scaled so the cases stay fast.
    OCR_JOB_DEADLINE_MS: 400,
    createLocalOcrWorker: async () => {
      h.workerCreations += 1;
      return {
        recognize: () => {
          h.recognizeCalls += 1;
          if (h.recognizeCalls >= h.hangFromPage) {
            // A WASM pass that never returns: only terminate() settles it.
            return new Promise((_resolve, reject) => {
              h.pendingRejects.push(reject);
            });
          }
          return Promise.resolve({ data: { text: `recognized page ${h.recognizeCalls}` } });
        },
        terminate: async () => {
          h.terminateCalls += 1;
          for (const reject of h.pendingRejects.splice(0)) {
            reject(new Error("Browser-local OCR was terminated."));
          }
        },
      };
    },
  };
});

/* ─── Fixtures ────────────────────────────────────────────────────────────── */

function pdfFile(): File {
  return new File(["%PDF-1.4 fixture"], "scanned-records.pdf", {
    type: "application/pdf",
  });
}

async function stageFile(file: File): Promise<void> {
  fireEvent.change(screen.getByLabelText("Select evidence files"), {
    target: { files: [file] },
  });
  await screen.findByText(file.name);
}

/** Lets queued microtasks and timers drain inside React's act() scope. */
async function drain(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

let getContextSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.sessionStorage.clear();
  h.numPages = 10;
  h.workerCreations = 0;
  h.terminateCalls = 0;
  h.destroyCalls = 0;
  h.recognizeCalls = 0;
  h.hangFromPage = 1;
  h.pendingRejects = [];
  h.pdfLoadRejects = false;
  // jsdom has no 2D context; the component must still be driven through its
  // real render path, so the context is stubbed rather than the path skipped.
  getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue({ fillStyle: "", fillRect: () => {} } as never);
});

afterEach(() => {
  cleanup();
  getContextSpy.mockRestore();
  window.sessionStorage.clear();
});

/* ─── Cases ───────────────────────────────────────────────────────────────── */

describe("evidence OCR elapsed-work budget (HARD-01 / A06 parity)", () => {
  it("stops a recognition that never settles, keeps the partial result, and hands the tab back", async () => {
    // The first chunk of pages completes (and checkpoints); recognition hangs
    // on the page after it, which is the shape only the timer can reach.
    h.hangFromPage = OCR_PAGES_PER_CHUNK + 1;

    const { container } = render(<LocalEvidenceAnalyzer conditionTerms={[]} />);
    await stageFile(pdfFile());
    fireEvent.click(screen.getByRole("button", { name: "Local OCR" }));

    // Parked inside `recognize()`: no deadline has fired yet, and the tab is
    // still busy — without the budget it would stay exactly like this.
    await waitFor(() => expect(h.recognizeCalls).toBe(OCR_PAGES_PER_CHUNK + 1));
    expect(h.terminateCalls).toBe(0);
    expect(window.sessionStorage.getItem(OCR_CHECKPOINT_STORAGE_KEY)).not.toBeNull();

    // Both the notice list and the tab message carry this stop; the notice is
    // the one that has to name how far the job got.
    expect(
      await screen.findByText(
        /job limit was reached after page 8/,
        {},
        { timeout: 8_000 },
      ),
    ).toBeTruthy();
    await drain();

    // The budget terminated the live worker — the hung await was the only way
    // out — and released the tab instead of leaving the surface stuck busy.
    expect(h.terminateCalls).toBe(1);
    expect(screen.queryByText("Reading selected documents locally…")).toBeNull();
    expect(screen.getByRole("button", { name: "Local OCR" })).toHaveProperty(
      "disabled",
      false,
    );

    // The resume checkpoint survives a budget stop: the pages the tab already
    // paid for are not thrown away, so the next run continues from there.
    expect(window.sessionStorage.getItem(OCR_CHECKPOINT_STORAGE_KEY)).not.toBeNull();
    // ...and what was recognized before the stop is still reviewed: the source
    // is committed to the analysis list (its own <article>, not just the
    // selected-document row that was already on screen).
    expect(container.querySelector("article h4")?.textContent).toBe(
      "scanned-records.pdf",
    );
    expect(screen.getByText(/Run Local OCR again on this document to resume/)).toBeTruthy();
  });

  it("reports a budget stop that landed before any page completed, and keeps no checkpoint", async () => {
    // Parked on the first page this time: there is no partial text to keep, so
    // the notice must not promise "pages through N are kept".
    render(<LocalEvidenceAnalyzer conditionTerms={[]} />);
    await stageFile(pdfFile());
    fireEvent.click(screen.getByRole("button", { name: "Local OCR" }));

    await waitFor(() => expect(h.recognizeCalls).toBe(1));
    expect(h.terminateCalls).toBe(0);

    expect(
      await screen.findByText(/before any page completed/i, {}, { timeout: 8_000 }),
    ).toBeTruthy();
    await drain();

    expect(h.terminateCalls).toBe(1);
    expect(
      screen.getByText(/stopped at the .* job limit before any page produced text/),
    ).toBeTruthy();
    expect(screen.getByText(/No evidence excerpts have been analyzed/)).toBeTruthy();
    expect(window.sessionStorage.getItem(OCR_CHECKPOINT_STORAGE_KEY)).toBeNull();
  });

  it("destroys the loading task when the PDF load itself rejects", async () => {
    // pdf.js starts its worker when the task is created, so a load that
    // rejects (malformed file) is exactly the case whose teardown must still
    // run. `local-ocr-cleanup-contract` pins the finally blocks; neither it
    // nor the budget cases could show the load reaching one.
    h.pdfLoadRejects = true;

    render(<LocalEvidenceAnalyzer conditionTerms={[]} />);
    await stageFile(pdfFile());
    fireEvent.click(screen.getByRole("button", { name: "Local OCR" }));

    expect(await screen.findByText(/could not be OCR'd locally/i)).toBeTruthy();
    await drain();

    expect(h.destroyCalls).toBe(1);
    // The OCR worker was still torn down, no page was ever recognized, and
    // the tab is handed back rather than left busy behind a dead document.
    expect(h.terminateCalls).toBe(1);
    expect(h.recognizeCalls).toBe(0);
    expect(screen.getByRole("button", { name: "Local OCR" })).toHaveProperty(
      "disabled",
      false,
    );
    expect(window.sessionStorage.getItem(OCR_CHECKPOINT_STORAGE_KEY)).toBeNull();
  });

  it("does not spend the budget on a run that finishes inside it", async () => {
    h.hangFromPage = Number.POSITIVE_INFINITY;
    h.numPages = 3;

    render(<LocalEvidenceAnalyzer conditionTerms={[]} />);
    await stageFile(pdfFile());
    fireEvent.click(screen.getByRole("button", { name: "Local OCR" }));

    expect(
      await screen.findByText(/Local OCR completed for scanned-records.pdf/i),
    ).toBeTruthy();
    expect(h.recognizeCalls).toBe(3);
    expect(h.terminateCalls).toBe(1);
    // A completed job clears its checkpoint: nothing is left to resume.
    expect(window.sessionStorage.getItem(OCR_CHECKPOINT_STORAGE_KEY)).toBeNull();
    expect(screen.queryByText(/job limit was reached/i)).toBeNull();
  });
});
