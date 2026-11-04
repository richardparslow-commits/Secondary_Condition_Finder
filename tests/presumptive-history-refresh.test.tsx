// @vitest-environment jsdom
/**
 * Regression suite for Heal defect `s2-second-check-shows-first-results-1`.
 *
 * The results view caches the parsed service history in a module snapshot.
 * A second check writes a new record while that view is unmounted, so no
 * listener remained to invalidate the cache: the next mount replayed the first
 * check. The record now carries a revision the hook compares on every read.
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearPresumptiveLocalState,
  persistServiceHistory,
} from "@/lib/presumptive/browser-history";
import { useBrowserServiceHistory } from "@/lib/presumptive/use-browser-history";

const LOCATIONS = ["Thailand", "Guam", "Iraq"] as const;

function draft(location: string) {
  return {
    serviceBranchCodes: [],
    locations: [location],
    serviceStart: "1968-01-01",
    serviceEnd: "1969-01-01",
  };
}

function persist(location: string): void {
  const result = persistServiceHistory(window.sessionStorage, draft(location), LOCATIONS);
  expect(result.ok).toBe(true);
}

function HistoryProbe() {
  const { history, ready } = useBrowserServiceHistory();
  return (
    <p data-testid="history">
      {ready ? (history?.locations.join(",") ?? "empty") : "loading"}
    </p>
  );
}

beforeEach(() => {
  // A change, not just an empty storage, so the module snapshot is stale even
  // when a previous test left one behind.
  clearPresumptiveLocalState(window.sessionStorage);
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("presumptive history reflects same-tab changes", () => {
  it("shows the second check after the results view was unmounted", async () => {
    persist("Thailand");
    const first = render(<HistoryProbe />);
    expect(screen.getByTestId("history").textContent).toBe("Thailand");
    first.unmount();

    // The form writes while the results consumer is unmounted.
    persist("Guam");
    render(<HistoryProbe />);
    await waitFor(() => {
      expect(screen.getByTestId("history").textContent).toBe("Guam");
    });
  });

  it("does not keep an empty first read after a check, and clears live", async () => {
    const first = render(<HistoryProbe />);
    expect(screen.getByTestId("history").textContent).toBe("empty");
    first.unmount();

    persist("Iraq");
    render(<HistoryProbe />);
    await waitFor(() => {
      expect(screen.getByTestId("history").textContent).toBe("Iraq");
    });

    act(() => clearPresumptiveLocalState(window.sessionStorage));
    await waitFor(() => {
      expect(screen.getByTestId("history").textContent).toBe("empty");
    });
  });
});
