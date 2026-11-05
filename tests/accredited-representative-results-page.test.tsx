// @vitest-environment jsdom
/**
 * Regression suite for the large-lookup result list (Heal
 * s1-many-reps-shown-as-none-found-1). The loader now keeps the nearest
 * representatives up to the cache DTO bound; this surface shows a short first
 * page and lets the visitor reveal the rest instead of rendering everything at
 * once.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RepresentativeResults } from "@/components/va/AccreditedRepresentativeFinder";
import type { AccreditedRepresentativeView } from "@/lib/va/accredited-representatives";

afterEach(cleanup);

function viewWith(count: number, totalAvailable = count): AccreditedRepresentativeView {
  return {
    lookupKey: "lookup-key",
    live: true,
    params: { zip: "12345", radiusMiles: 50 },
    items: Array.from({ length: count }, (_, index) => ({
      id: `rep-${index}`,
      name: `Representative ${String(index).padStart(3, "0")}`,
      accreditationType: "VSO" as const,
      zip: "12345",
      distanceMiles: index,
    })),
    totalAvailable,
  } as unknown as AccreditedRepresentativeView;
}

describe("the representative result list pages through a large lookup", () => {
  it("renders the nearest page and reveals more on request", () => {
    render(<RepresentativeResults view={viewWith(30)} />);

    expect(screen.getByText(/Showing 25 of 30 accredited representatives/)).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(25);
    expect(screen.queryByText("Representative 029")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show more representatives" }));

    expect(screen.getAllByRole("listitem")).toHaveLength(30);
    expect(screen.getByText("Representative 029")).toBeTruthy();
    expect(screen.getByText(/Showing 30 of 30/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show more representatives" })).toBeNull();
  });

  it("discloses when the loader only carries the nearest 200 of a larger match set", () => {
    // Heal s7-rep-list-cut-at-200-silently-1: the loader keeps the nearest 200
    // for its cache bound, but the finder used items.length as the total, so a
    // 250-match search said "Showing 200 of 200" and hid the last 50.
    render(<RepresentativeResults view={viewWith(200, 250)} />);

    expect(screen.getByText(/Showing 25 of 250 accredited representatives/)).toBeTruthy();
    expect(
      screen.getByText(/Only the nearest 200 of 250 matching representatives are shown/),
    ).toBeTruthy();

    for (let click = 0; click < 7; click += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Show more representatives" }));
    }

    expect(screen.getAllByRole("listitem")).toHaveLength(200);
    expect(screen.getByText(/Showing 200 of 250/)).toBeTruthy();
    expect(
      screen.getByText(/Only the nearest 200 of 250 matching representatives are shown/),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show more representatives" })).toBeNull();
  });

  it("keeps the empty-directory guidance when a live lookup has no matches", () => {
    render(<RepresentativeResults view={viewWith(0)} />);

    expect(screen.getByText(/No accredited representatives found within 50 miles/)).toBeTruthy();
    expect(screen.queryByText(/could not be loaded just now/)).toBeNull();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("reports an unavailable directory as an outage, not as no nearby representatives", () => {
    render(
      <RepresentativeResults
        view={{
          ...viewWith(0),
          live: false,
          source: "local-fallback",
          sourceLabel: "Local directory fallback",
          notice:
            "Accredited-representative directory is unavailable or disabled. Search VA's OGC directory on va.gov/ogc/apps/accreditation.",
          environment: null,
          retrievedAt: null,
        }}
      />,
    );

    expect(screen.getByText(/could not be loaded just now/)).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
    // The app must not assert that no representative is nearby when it could
    // not read the directory at all.
    expect(screen.queryByText(/No accredited representatives found within/)).toBeNull();
  });
});
