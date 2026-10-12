// @vitest-environment jsdom
/**
 * Mounted lifecycle fence for browser-local evidence extraction (audit A07).
 *
 * The source-structure suite (`tests/local-ocr-cancellation-fence.test.ts`)
 * pins statement order. This suite exists because the defect it closes lived
 * *between* two of those statements: a generation check ran before an `await`,
 * and the persistence that followed it was written after the boundary with no
 * re-check. Statement order alone cannot fail for that, so each case here
 * mounts the real component, suspends the run at the real boundary, clears
 * browser-local state through the real cleanup entry point, unmounts the
 * component (what Finish, Restart, or leaving the step does), and only then
 * lets the detached run resume — asserting it persisted nothing.
 *
 * Suspension is controlled by a gate on `yieldToBrowser` (the chunk boundary)
 * and on the document extractor (the pre-commit boundary). A run that never
 * reached the gate would pass vacuously, so each case asserts the gate was
 * actually entered first.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocalEvidenceAnalyzer } from "@/components/evidence/LocalEvidenceAnalyzer";
import { evidenceAnalysisStorageKey } from "@/lib/evidence/extract";
import {
  OCR_CHECKPOINT_STORAGE_KEY,
  OCR_PAGES_PER_CHUNK,
} from "@/lib/evidence/ocr-session";
import { clearSecondaryWorkflowLocalState } from "@/lib/secondary-workflow/local-state";

const h = vi.hoisted(() => ({
  numPages: 8,
  yieldCalls: 0,
  yieldResolvers: [] as Array<() => void>,
  terminateCalls: 0,
  destroyCalls: 0,
  extractionCalls: 0,
  /** Resolved on demand so a case can suspend the run inside the extractor. */
  extractionGate: Promise.resolve() as Promise<unknown>,
  resolveExtraction: null as null | (() => void),
}));

/* ─── Library mocks ───────────────────────────────────────────────────────
   pdf.js and the OCR worker are replaced with deterministic fakes so the
   component's own orchestration — not a real PDF or WASM pass — is under
   test. The mock specifier for pdf.js must stay the legacy build, matching
   document-extract.ts and LocalEvidenceAnalyzer.tsx. */
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: { workerSrc: "about:blank" },
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: h.numPages,
      getPage: async () => ({
        getViewport: ({ scale }: { scale: number }) => ({
          width: 100 * scale,
          height: 100 * scale,
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
    // The gate is the point: the loop parks here, mid-run.
    yieldToBrowser: () =>
      new Promise<void>((resolve) => {
        h.yieldCalls += 1;
        h.yieldResolvers.push(resolve);
      }),
    createLocalOcrWorker: async () => ({
      recognize: async () => ({ data: { text: "recognized page text" } }),
      terminate: async () => {
        h.terminateCalls += 1;
      },
    }),
  };
});

vi.mock("@/lib/evidence/document-extract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/evidence/document-extract")>();
  return {
    ...actual,
    extractLocalEvidenceDocument: () => {
      h.extractionCalls += 1;
      return h.extractionGate;
    },
  };
});

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const EXTRACTABLE = {
  kind: "text" as const,
  sourceName: "notes.txt",
  segments: [
    {
      text: "Nexus opinion: the condition is at least as likely as not caused by service.",
      locatorPrefix: "pasted text",
    },
  ],
  warnings: [],
};

function deferred(): { promise: Promise<unknown>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<unknown>((res) => {
    resolve = () => res(EXTRACTABLE);
  });
  return { promise, resolve };
}

function pdfFile(): File {
  return new File(["%PDF-1.4 fixture"], "scanned-records.pdf", {
    type: "application/pdf",
  });
}

function textFile(): File {
  return new File(["Nexus opinion text"], "notes.txt", { type: "text/plain" });
}

async function stageFile(file: File): Promise<void> {
  const input = screen.getByLabelText("Select evidence files");
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByText(file.name);
}

/** Lets every queued microtask and timer callback in the detached run drain. */
async function drain(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

function evidenceWrites(spy: ReturnType<typeof vi.spyOn>): number {
  return spy.mock.calls.filter(
    (call: unknown[]) => call[0] === evidenceAnalysisStorageKey,
  ).length;
}

let setItemSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.sessionStorage.clear();
  h.numPages = OCR_PAGES_PER_CHUNK;
  h.yieldCalls = 0;
  h.yieldResolvers = [];
  h.terminateCalls = 0;
  h.destroyCalls = 0;
  h.extractionCalls = 0;
  h.extractionGate = Promise.resolve(EXTRACTABLE);
  h.resolveExtraction = null;
  setItemSpy = vi.spyOn(Storage.prototype, "setItem");
});

afterEach(() => {
  cleanup();
  setItemSpy.mockRestore();
  window.sessionStorage.clear();
});

describe("browser-local extraction lifecycle fence (audit A07)", () => {
  it("does not recreate the OCR checkpoint when a suspended run resumes after cleanup", async () => {
    const { unmount } = render(<LocalEvidenceAnalyzer conditionTerms={[]} />);
    await stageFile(pdfFile());
    fireEvent.click(screen.getByRole("button", { name: "Local OCR" }));

    // The run must actually reach the chunk-boundary yield, or the case below
    // would pass without exercising the boundary it claims to test.
    await waitFor(() => expect(h.yieldCalls).toBe(1));

    // Finish/Restart: remove every browser-local key through the real cleanup
    // entry point, then navigate away (unmount).
    act(() => {
      clearSecondaryWorkflowLocalState(window.sessionStorage);
      unmount();
    });

    // The detached run resumes past the yield — and must persist nothing.
    await act(async () => {
      h.yieldResolvers.forEach((resolve) => resolve());
    });
    await drain();

    expect(window.sessionStorage.getItem(OCR_CHECKPOINT_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(evidenceAnalysisStorageKey)).toBeNull();
  });

  it("cancels the in-flight OCR worker and PDF task on unmount", async () => {
    const { unmount } = render(<LocalEvidenceAnalyzer conditionTerms={[]} />);
    await stageFile(pdfFile());
    fireEvent.click(screen.getByRole("button", { name: "Local OCR" }));
    await waitFor(() => expect(h.yieldCalls).toBe(1));

    act(() => unmount());
    await drain();

    expect(h.terminateCalls).toBe(1);
    expect(h.destroyCalls).toBe(1);
  });

  it("does not commit an excerpt when the extraction finishes after cleanup", async () => {
    const gate = deferred();
    h.extractionGate = gate.promise;
    h.resolveExtraction = gate.resolve;

    const { unmount } = render(
      <LocalEvidenceAnalyzer conditionTerms={["ptsd"]} />,
    );
    await stageFile(textFile());
    fireEvent.click(screen.getByRole("button", { name: "Analyze 1 document" }));

    // Suspended inside the extractor — the pre-commit async boundary.
    await waitFor(() => expect(h.extractionCalls).toBe(1));
    expect(window.sessionStorage.getItem(evidenceAnalysisStorageKey)).toBeNull();

    act(() => {
      clearSecondaryWorkflowLocalState(window.sessionStorage);
      unmount();
    });
    await act(async () => {
      gate.resolve();
    });
    await drain();

    expect(window.sessionStorage.getItem(evidenceAnalysisStorageKey)).toBeNull();
    expect(evidenceWrites(setItemSpy)).toBe(0);
  });

  it("keeps analyzing in memory and warns when session storage throws", async () => {
    setItemSpy.mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    render(<LocalEvidenceAnalyzer conditionTerms={[]} />);
    await stageFile(pdfFile());
    fireEvent.click(screen.getByRole("button", { name: "Local OCR" }));
    await waitFor(() => expect(h.yieldCalls).toBe(1));
    await act(async () => {
      h.yieldResolvers.forEach((resolve) => resolve());
    });
    await drain();

    // The checkpoint could not be written, so the run says so instead of
    // silently promising a resume that does not exist...
    expect(
      screen.getByText(/resume checkpoint unavailable/i),
    ).toBeTruthy();
    // ...and the analysis still lands in memory: storage failure is reported,
    // never fatal.
    expect(screen.getByText(/nexus-relevant excerpt/i)).toBeTruthy();
    expect(window.sessionStorage.getItem(OCR_CHECKPOINT_STORAGE_KEY)).toBeNull();
  });

  it("persists a commit once even though StrictMode double-invokes the updater", async () => {
    render(
      <StrictMode>
        <LocalEvidenceAnalyzer conditionTerms={[]} />
      </StrictMode>,
    );

    fireEvent.change(screen.getByLabelText(/Paste exact extracted text/i), {
      target: { value: "Nexus opinion: the condition is at least as likely as not." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Analyze pasted text locally" }),
    );
    await drain();

    // A storage write inside the React state updater runs once per invocation
    // of that updater, and React may invoke it more than once. One analysis is
    // one write.
    expect(evidenceWrites(setItemSpy)).toBe(1);
  });
});
