// @vitest-environment jsdom
/**
 * Regression for Heal defect `s1-step-check-lost-without-storage-1`.
 *
 * The walkthrough stores progress in tab-scoped sessionStorage. When the
 * browser refused a write (quota, privacy settings), the component swallowed
 * the error and never updated React state, so a checked step stayed unchecked
 * and the counter stayed at zero with no explanation. The component now keeps
 * a view-local in-memory fallback and says the progress cannot be saved.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VaGovRecordWalkthrough } from "@/components/secondary/VaGovRecordWalkthrough";
import { vaGovRecordWalkthroughStorageKey } from "@/lib/secondary-workflow/local-state";

let setItemSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.sessionStorage.clear();
  setItemSpy = vi.spyOn(Storage.prototype, "setItem");
});

afterEach(() => {
  cleanup();
  setItemSpy.mockRestore();
  window.sessionStorage.clear();
});

describe("VA.gov walkthrough when sessionStorage refuses writes", () => {
  it("keeps the checked step visible and explains that progress cannot be saved", () => {
    setItemSpy.mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });

    render(<VaGovRecordWalkthrough />);

    const checkbox = screen.getByRole("checkbox", {
      name: "Step 1: Sign in on VA.gov",
    }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(document.body.textContent).toContain("0 of 14 steps marked complete.");
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.click(checkbox);

    // The step checks for this view even though the write was rejected.
    expect(checkbox.checked).toBe(true);
    expect(document.body.textContent).toContain("1 of 14 steps marked complete.");
    expect(window.sessionStorage.getItem(vaGovRecordWalkthroughStorageKey)).toBeNull();

    const notice = screen.getByRole("alert");
    expect(notice.textContent).toContain("progress cannot be saved");
    expect(notice.textContent).toContain("after you leave or reload");
  });
});
