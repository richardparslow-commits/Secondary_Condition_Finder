// @vitest-environment jsdom
/**
 * Regression for Heal `s11-paused-ocr-loses-resume-point-1`.
 *
 * A paused scan writes a resume checkpoint. Another document's OCR or its
 * removal must not clear that checkpoint: resuming A.pdf has to start after
 * page 8, not recognize pages 1-8 again. The checkpoint store keeps one entry
 * per source, and completion/removal clears only that source's entry.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocalEvidenceAnalyzer } from "@/components/evidence/LocalEvidenceAnalyzer";
import { OCR_CHECKPOINT_STORAGE_KEY } from "@/lib/evidence/ocr-session";

const h = vi.hoisted(() => ({
  pagesBySource: { A: 10, B: 1 } as Record<string, number>,
  recognizeCalls: 0,
  hangOnCall: 9,
  pendingRejects: [] as Array<(error: Error) => void>,
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: { workerSrc: "about:blank" },
  getDocument: ({ data }: { data: Uint8Array }) => {
    const source = new TextDecoder().decode(data);
    const numPages = h.pagesBySource[source] ?? 1;
    return {
      promise: Promise.resolve({
        numPages,
        getPage: async () => ({
          getViewport: ({ scale }: { scale: number }) => ({
            width: 612 * scale,
            height: 792 * scale,
          }),
          render: () => ({ promise: Promise.resolve() }),
          cleanup: () => {},
        }),
      }),
      destroy: async () => {},
    };
  },
}));

vi.mock("@/lib/evidence/ocr-session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/evidence/ocr-session")>();
  return {
    ...actual,
    // Shortened budget, real deadline implementation: the pause, checkpoint,
    // and resume paths are all production code; only the duration is scaled.
    OCR_JOB_DEADLINE_MS: 400,
    createLocalOcrWorker: async () => ({
      recognize: () => {
        h.recognizeCalls += 1;
        if (h.recognizeCalls === h.hangOnCall) {
          return new Promise((_resolve, reject) => {
            h.pendingRejects.push(reject);
          });
        }
        return Promise.resolve({
          data: { text: `recognized page ${h.recognizeCalls}` },
        });
      },
      terminate: async () => {
        for (const reject of h.pendingRejects.splice(0)) {
          reject(new Error("Browser-local OCR was terminated."));
        }
      },
    }),
  };
});

function pdfFile(name: string, content: string): File {
  return new File([content], name, {
    type: "application/pdf",
    lastModified: 1_700_000_000_000,
  });
}

async function stageBoth(): Promise<void> {
  fireEvent.change(screen.getByLabelText("Select evidence files"), {
    target: { files: [pdfFile("A.pdf", "A"), pdfFile("B.pdf", "B")] },
  });
  await screen.findByText("A.pdf");
  await screen.findByText("B.pdf");
}

function ocrButton(index: number): HTMLElement {
  return screen.getAllByRole("button", { name: "Local OCR" })[index]!;
}

async function drain(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

async function pauseA(): Promise<void> {
  fireEvent.click(ocrButton(0));
  expect(
    await screen.findByText(/Local OCR paused for A\.pdf after 8 page/i, {}, { timeout: 8_000 }),
  ).toBeTruthy();
  await drain();
  expect(window.sessionStorage.getItem(OCR_CHECKPOINT_STORAGE_KEY)).not.toBeNull();
  h.hangOnCall = Number.POSITIVE_INFINITY;
}

let getContextSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.sessionStorage.clear();
  h.recognizeCalls = 0;
  h.hangOnCall = 9;
  h.pendingRejects = [];
  getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue({ fillStyle: "", fillRect: () => {} } as never);
});

afterEach(() => {
  cleanup();
  getContextSpy.mockRestore();
  window.sessionStorage.clear();
});

describe("a paused OCR run keeps its resume point across other documents", () => {
  it("resumes A after page 8 when B completes in between", async () => {
    render(<LocalEvidenceAnalyzer conditionTerms={[]} />);
    await stageBoth();
    await pauseA();

    fireEvent.click(ocrButton(1));
    expect(
      await screen.findByText(/Local OCR completed for B\.pdf/i, {}, { timeout: 8_000 }),
    ).toBeTruthy();
    await drain();

    fireEvent.click(ocrButton(0));
    expect(
      await screen.findByText(/Local OCR completed for A\.pdf: 10 page/i, {}, { timeout: 8_000 }),
    ).toBeTruthy();
    await drain();

    // 9 calls before the pause + B's single page + A's pages 9 and 10.
    expect(h.recognizeCalls).toBe(12);
  });

  it("resumes A after page 8 when B is removed in between", async () => {
    render(<LocalEvidenceAnalyzer conditionTerms={[]} />);
    await stageBoth();
    await pauseA();

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[1]!);
    await drain();
    expect(screen.queryByText("B.pdf")).toBeNull();

    fireEvent.click(ocrButton(0));
    expect(
      await screen.findByText(/Local OCR completed for A\.pdf: 10 page/i, {}, { timeout: 8_000 }),
    ).toBeTruthy();
    await drain();

    // 9 calls before the pause + A's pages 9 and 10. A restart from page 1
    // would add ten more calls.
    expect(h.recognizeCalls).toBe(11);
  });
});
