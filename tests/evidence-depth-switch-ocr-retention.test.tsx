// @vitest-environment jsdom
/**
 * Regression suite for Heal defect 2 (2026-11-03 run):
 * "Analyzed sources silently vanish when a scan finishes reading after
 * switching to Extended".
 *
 * `runLocalOcr` commits through the closure of the render it started in, so
 * `commitAnalysis` sliced the store to the *starting* depth's retention window.
 * A scan started in Standard and left running while the Analyst switches to
 * Extended therefore trimmed the review to Standard's 10 sources the moment it
 * finished, dropping the oldest two without a warning — even though the screen
 * said Extended keeps 200.
 *
 * The case below drives the real component through the interface the Veteran
 * uses (file input, Local OCR, depth select, paste) with pdf.js and the
 * Tesseract factory replaced by a recognizer the test releases by hand, so the
 * scan is genuinely still reading when the depth changes.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocalEvidenceAnalyzer } from "@/components/evidence/LocalEvidenceAnalyzer";
import { evidenceAnalysisStorageKey } from "@/lib/evidence/extract";
import { EXTENDED_LIMITS } from "@/lib/evidence/limits";

const h = vi.hoisted(() => ({
  recognizeCalls: 0,
  /** One resolver per `recognize()` call, released by the case below. */
  releases: [] as Array<() => void>,
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: { workerSrc: "about:blank" },
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
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
  }),
}));

vi.mock("@/lib/evidence/ocr-session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/evidence/ocr-session")>();
  return {
    ...actual,
    createLocalOcrWorker: async () => ({
      recognize: () => {
        h.recognizeCalls += 1;
        return new Promise((resolve) => {
          h.releases.push(() => resolve({ data: { text: "recognized scanned page" } }));
        });
      },
      terminate: async () => {},
    }),
  };
});

async function stageScannedPdf(): Promise<void> {
  fireEvent.change(screen.getByLabelText("Select evidence files"), {
    target: {
      files: [new File(["%PDF-1.4 fixture"], "scanned-records.pdf", { type: "application/pdf" })],
    },
  });
  await screen.findByText("scanned-records.pdf");
}

async function analyzePastedSource(name: string): Promise<void> {
  fireEvent.change(screen.getByLabelText(/Source name/), {
    target: { value: name },
  });
  fireEvent.change(screen.getByLabelText(/Paste exact extracted text/), {
    target: { value: `Record for ${name} describing the condition.` },
  });
  fireEvent.click(screen.getByRole("button", { name: "Analyze pasted text locally" }));
}

/** Lets the released recognition settle through its commit and the reload timer. */
async function finishRecognition(): Promise<void> {
  await act(async () => {
    for (const release of h.releases.splice(0)) release();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

let getContextSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.sessionStorage.clear();
  h.recognizeCalls = 0;
  h.releases = [];
  getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue({ fillStyle: "", fillRect: () => {} } as never);
});

afterEach(() => {
  cleanup();
  getContextSpy.mockRestore();
  window.sessionStorage.clear();
});

describe("a scan that finishes after switching depth commits into the active window", () => {
  it("keeps every source when Extended is chosen while the scan is still reading", async () => {
    const { container } = render(<LocalEvidenceAnalyzer conditionTerms={[]} />);
    await stageScannedPdf();
    fireEvent.click(screen.getByRole("button", { name: "Local OCR" }));

    // The scan is genuinely parked inside `recognize()` before the switch.
    await waitFor(() => expect(h.recognizeCalls).toBe(1));

    fireEvent.change(screen.getByLabelText("Active depth"), {
      target: { value: "extended" },
    });
    expect(screen.getByText(/Active limits \(Extended\)/)).toBeTruthy();

    // Eleven pasted sources is already more than Standard's 10-source window.
    for (let index = 1; index <= 11; index += 1) {
      await analyzePastedSource(`source-${String(index).padStart(2, "0")}`);
    }
    expect(container.querySelectorAll("article")).toHaveLength(11);

    await finishRecognition();
    expect(await screen.findByText(/Local OCR completed for scanned-records\.pdf/i)).toBeTruthy();

    // The scan's commit must count toward Extended, not trim the review back to
    // Standard's window: twelve sources are listed and twelve are retained.
    expect(container.querySelectorAll("article")).toHaveLength(12);
    const stored = JSON.parse(
      window.sessionStorage.getItem(evidenceAnalysisStorageKey) ?? "[]",
    ) as Array<{ sourceName: string }>;
    expect(stored).toHaveLength(12);
    expect(stored.map((analysis) => analysis.sourceName)).toContain("source-01");
    expect(stored.map((analysis) => analysis.sourceName)).toContain("source-02");
    expect(EXTENDED_LIMITS.storedSources).toBeGreaterThan(10);
  });
});
