// @vitest-environment jsdom
/**
 * Regression for Heal defect `s3-dd214-duty-station-blocks-confirm-1`.
 *
 * The review seeds every raw duty station extracted from the DD-214. The
 * rendered checkboxes, however, only cover authored catalog locations, while
 * confirmation used to submit every raw string to the catalog allowlist. A
 * record containing both a catalog location and an ordinary stateside duty
 * station therefore could not continue: the unmatched value was invisible as
 * a choice and could not be removed.
 *
 * This mounts the real analyzer and drives it through the file input. The
 * fixture is the defect's shape: Thailand (catalog) plus Fort Bragg, NC (not
 * catalog). Confirming must store Thailand, exclude the unmatched station, and
 * still reach the results page. The unmatched station must be named in the
 * review with a Remove control rather than silently dropped.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Dd214LocalAnalyzer } from "@/components/presumptive/Dd214LocalAnalyzer";
import { readPresumptiveHistory } from "@/lib/presumptive/browser-history";

const h = vi.hoisted(() => ({
  push: vi.fn(),
  pageText: [
    "DEPARTMENT OF DEFENSE",
    "CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY",
    "12a. DATE ENTERED ACTIVE DUTY: 01/01/1968",
    "12b. SEPARATION DATE: 12/31/1970",
    "13. STATION / LOCATION: Fort Bragg, NC",
    "14. LOCATION: Thailand",
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
        getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
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
  const file = new File(["%PDF-1.4 fixture"], "dd214.pdf", { type: "application/pdf" });
  fireEvent.change(screen.getByLabelText("DD-214 file"), { target: { files: [file] } });
}

beforeEach(() => {
  window.sessionStorage.clear();
  h.push.mockClear();
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("DD-214 review with a non-catalog duty station", () => {
  it("names the unmatched station as removable and confirms using the catalog match", async () => {
    render(<Dd214LocalAnalyzer locations={["Thailand"]} />);
    selectFile();

    expect(await screen.findByText(/DD-214 text extracted locally/i)).toBeTruthy();

    // The unmatched station is not hidden and does not masquerade as a selectable
    // catalog match. The review names it and gives the Veteran a way to remove it.
    expect(screen.getByText("Fort Bragg, NC")).toBeTruthy();
    expect(
      screen.getByText(/Not in the presumptive catalog — these will not be matched:/),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove Fort Bragg, NC" })).toBeTruthy();

    // Only the catalog match is presented as selected.
    expect(screen.getByText(/Selected catalog locations: Thailand/)).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Thailand" })).toBeTruthy();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /I verified these dates and locations against my DD-214/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm and continue" }));

    // The old path failed here with select-location. The catalog match is
    // stored, the unmatched station is excluded, and the workflow advances.
    expect(h.push).toHaveBeenCalledWith("/presumptive/results");
    expect(screen.queryByText(/Select at least one location where you served/i)).toBeNull();
    const stored = readPresumptiveHistory(window.sessionStorage);
    expect(stored?.locations).toEqual(["Thailand"]);
    expect(stored?.locations).not.toContain("Fort Bragg, NC");
    expect(stored?.serviceStart).toBe("1968-01-01");
    expect(stored?.serviceEnd).toBe("1970-12-31");
  });
});
