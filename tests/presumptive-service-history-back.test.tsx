// @vitest-environment jsdom
/**
 * Regression for Heal `s6-service-history-lost-on-back-1`.
 *
 * The results view links back to `/presumptive`. That remounts the form, which
 * used to start with empty controls even though the tab had already saved the
 * confirmed service history. Restore the saved record on mount.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceHistoryForm } from "@/components/ServiceHistoryForm";
import {
  clearPresumptiveLocalState,
  presumptiveHistoryStorageKey,
  writePresumptiveHistory,
} from "@/lib/presumptive/browser-history";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const LOCATIONS = ["Iraq", "Guam"];
const BRANCHES = [{ code: "ARMY", description: "Army" }];

beforeEach(() => {
  clearPresumptiveLocalState(window.sessionStorage);
  writePresumptiveHistory(window.sessionStorage, {
    serviceBranchCodes: ["ARMY"],
    locations: ["Iraq"],
    serviceStart: "2006-01-01",
    serviceEnd: "2007-01-01",
  });
});

afterEach(() => {
  cleanup();
  clearPresumptiveLocalState(window.sessionStorage);
});

describe("presumptive service history restoration", () => {
  it("restores saved locations, branch, and dates after returning", async () => {
    render(
      <ServiceHistoryForm
        locations={LOCATIONS}
        serviceBranches={BRANCHES}
        serviceBranchSourceLabel="test reference"
        serviceBranchNotice="test notice"
      />,
    );

    await waitFor(() => {
      expect(
        (screen.getByRole("checkbox", { name: "Iraq" }) as HTMLInputElement)
          .checked,
      ).toBe(true);
    });
    expect(
      (screen.getByRole("checkbox", { name: "Guam" }) as HTMLInputElement)
        .checked,
    ).toBe(false);
    expect(
      (
        screen.getByRole("checkbox", {
          name: /Army/,
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText(/Start date/) as HTMLInputElement).value,
    ).toBe("2006-01-01");
    expect(
      (screen.getByLabelText(/End date/) as HTMLInputElement).value,
    ).toBe("2007-01-01");

    // The record remains the one this tab saved, not a fresh blank draft.
    expect(window.sessionStorage.getItem(presumptiveHistoryStorageKey)).toBeTruthy();
  });
});
