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

function viewWith(count: number): AccreditedRepresentativeView {
  return {
    lookupKey: "lookup-key",
    params: { zip: "12345", radiusMiles: 50 },
    items: Array.from({ length: count }, (_, index) => ({
      id: `rep-${index}`,
      name: `Representative ${String(index).padStart(3, "0")}`,
      accreditationType: "VSO" as const,
      zip: "12345",
      distanceMiles: index,
    })),
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

  it("keeps the empty-directory guidance when there are genuinely no matches", () => {
    render(<RepresentativeResults view={viewWith(0)} />);

    expect(screen.getByText(/No accredited representatives found within 50 miles/)).toBeTruthy();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
