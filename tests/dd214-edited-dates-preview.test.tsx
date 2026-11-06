// @vitest-environment jsdom
/**
 * Regression for Heal defect `s7-dd214-edited-dates-unchecked-1`.
 *
 * The review preview passed edited locations to the adapter but kept the
 * extraction's original dates. Reversing the dates therefore left the
 * `Check:` line empty until Confirm refused the save. The preview must use the
 * same edited values Confirm validates.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Dd214LocalAnalyzer } from "@/components/presumptive/Dd214LocalAnalyzer";

const h = vi.hoisted(() => ({
  push: vi.fn(),
  pageText: [
    "DEPARTMENT OF DEFENSE",
    "CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY",
    "12a. DATE ENTERED ACTIVE DUTY: 01/15/1968",
    "12b. SEPARATION DATE: 01/15/1970",
    "13. STATION / LOCATION: Republic of Vietnam",
  ].join("\n"),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, replace: vi.fn(), back: vi.fn() }),
}));

// The fixture is a text-layer PDF, so the analyzer never needs OCR or canvas.
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: { workerSrc: "about:blank" },
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({
        getViewport: ({ scale }: { scale: number }) => ({
          width: 600 * scale,
          height: 800 * scale,
        }),
        getTextContent: async () => ({
          items: h.pageText.split(" ").map((str) => ({ str })),
        }),
        render: () => ({ promise: Promise.resolve() }),
        cleanup: () => {},
      }),
    }),
    destroy: async () => {},
  }),
}));

function selectFile(): void {
  const file = new File(["%PDF-1.4 fixture"], "dd214.pdf", {
    type: "application/pdf",
  });
  fireEvent.change(screen.getByLabelText("DD-214 file"), {
    target: { files: [file] },
  });
}

beforeEach(() => {
  window.sessionStorage.clear();
  h.push.mockClear();
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("DD-214 review date validation", () => {
  it("flags edited dates as out of order before confirmation", async () => {
    render(<Dd214LocalAnalyzer locations={["Republic of Vietnam"]} />);
    selectFile();

    expect(await screen.findByText(/DD-214 text extracted locally/i)).toBeTruthy();
    expect(screen.queryByText("Check: date-order")).toBeNull();

    fireEvent.change(screen.getByLabelText("Service start"), {
      target: { value: "1970-01-15" },
    });
    fireEvent.change(screen.getByLabelText("Service end"), {
      target: { value: "1968-01-15" },
    });

    expect(await screen.findByText("Check: date-order")).toBeTruthy();
    expect(h.push).not.toHaveBeenCalled();
  });
});
