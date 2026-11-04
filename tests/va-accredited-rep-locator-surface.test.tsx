// @vitest-environment jsdom
/**
 * Audit A01 — mounted proof that the accredited-representative locator keeps the
 * lookup ZIP out of the URL.
 *
 * The source pin in tests/va-accredited-rep-no-url-exposure.test.ts can tell that
 * no `router.push` and no redirect exist. This suite mounts the real surface,
 * drives a real submit through the real `useActionState` wiring, and checks the
 * two things a reader actually cares about:
 *
 *   1. the submitted ZIP arrives in the action's FormData (the request body);
 *   2. after a submit — including on the refusal path — the browser URL still
 *      carries no trace of it.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccreditedRepresentativeFinder } from "@/components/va/AccreditedRepresentativeFinder";
import type { AccreditedRepresentativeView } from "@/lib/va/accredited-representatives";
import { ACCREDITED_REP_REFUSAL_MESSAGE } from "@/lib/va/accredited-rep-search";

const ZIP = "22101";

const { actionMock } = vi.hoisted(() => ({ actionMock: vi.fn() }));

vi.mock("@/lib/actions/accredited-representatives", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/actions/accredited-representatives")>()),
  searchAccreditedRepresentatives: actionMock,
}));

function view(overrides: Partial<AccreditedRepresentativeView> = {}): AccreditedRepresentativeView {
  return {
    params: { zip: ZIP, radiusMiles: 50 },
    items: [
      {
        id: "rep-1",
        name: "Jane Representative",
        accreditationType: "VSO",
        zip: ZIP,
        distanceMiles: 1.2,
      },
    ],
    source: "local-fallback",
    sourceLabel: "Local reference",
    notice: "Local reference data is shown because live VA access is unavailable or disabled.",
    live: false,
    environment: null,
    retrievedAt: null,
    cacheStatus: "miss",
    ...overrides,
  } as AccreditedRepresentativeView;
}

async function submitSearch(zip: string): Promise<void> {
  const input = screen.getByLabelText(/ZIP code/i);
  fireEvent.change(input, { target: { value: zip } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /search directory/i }));
  });
}

beforeEach(() => {
  actionMock.mockReset();
  actionMock.mockResolvedValue({ view: view(), error: null });
  window.history.replaceState(null, "", "/secondary/suggestions");
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("locator submission (A01)", () => {
  it("renders the form and no results before any interaction", () => {
    render(<AccreditedRepresentativeFinder returnTo="/secondary/suggestions" />);

    expect(screen.getByText("Find an accredited representative near you")).toBeTruthy();
    // The search control is an action-driven POST form, not a GET form.
    const form = document.querySelector("form");
    expect(form).not.toBeNull();
    expect(form!.getAttribute("method")?.toLowerCase() ?? "post").not.toBe("get");
    // `returnTo` is an audit label carried in the body, never a URL.
    expect(form!.querySelector('input[name="returnTo"]')).not.toBeNull();
    expect(screen.queryByText(/^Source:/)).toBeNull();
  });

  it("sends the ZIP in the request body and leaves the URL untouched", async () => {
    render(<AccreditedRepresentativeFinder returnTo="/secondary/suggestions" />);

    const urlBefore = window.location.href;
    await submitSearch(ZIP);

    // 1. The ZIP reached the action — in the FormData, i.e. the POST body.
    expect(actionMock).toHaveBeenCalledTimes(1);
    const submitted = actionMock.mock.calls[0][1] as FormData;
    expect(submitted.get("zip")).toBe(ZIP);
    expect(submitted.get("returnTo")).toBe("/secondary/suggestions");

    // 2. The browser URL never carried it, before or after the submit.
    expect(urlBefore).not.toContain(ZIP);
    expect(window.location.href).not.toContain(ZIP);
    expect(window.location.search).toBe("");
    expect(document.URL).not.toContain(`zip=${ZIP}`);

    // 3. The returned view is what renders, provenance line included.
    expect(screen.getByText(/Source:/)).toBeTruthy();
    expect(screen.getByText("Jane Representative")).toBeTruthy();
  });

  it("keeps the radius and type chosen for the search after results render", async () => {
    // Heal s6-rep-search-filters-snap-back-1: React 19's implicit reset after a
    // function action restored the selects' first options while their state
    // stayed at the searched values, so the boxes read 25 miles/Any beside a
    // 100-mile/VSO result and the next search used the wrong filters.
    render(<AccreditedRepresentativeFinder returnTo="/secondary/suggestions" />);

    fireEvent.change(screen.getByLabelText(/Radius/i), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText(/^Type/i), { target: { value: "VSO" } });
    await submitSearch(ZIP);

    expect((screen.getByLabelText(/Radius/i) as HTMLSelectElement).value).toBe("100");
    expect((screen.getByLabelText(/^Type/i) as HTMLSelectElement).value).toBe("VSO");
    // The submitted body carried those values, so the rendered list matches them.
    const submitted = actionMock.mock.calls[0][1] as FormData;
    expect(submitted.get("radiusMiles")).toBe("100");
    expect(submitted.get("type")).toBe("VSO");
  });

  it("keeps the URL clean on a refusal and echoes nothing but fixed copy", async () => {
    actionMock.mockResolvedValue({ view: null, error: "invalid-zip" });
    render(<AccreditedRepresentativeFinder returnTo="/secondary/evidence" />);

    await submitSearch(ZIP);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Enter a 5-digit US zip code.");
    expect(alert.textContent).not.toContain(ZIP);
    expect(window.location.href).not.toContain(ZIP);
    expect(window.location.search).toBe("");
    // A refusal must not leave a previous result on screen as if it answered
    // the refused request.
    expect(screen.queryByText(/^Source:/)).toBeNull();
  });

  it("shows the generic refusal copy for a PHI-free-contract refusal", async () => {
    actionMock.mockResolvedValue({ view: null, error: "refused" });
    render(<AccreditedRepresentativeFinder returnTo="/presumptive/results" />);

    await submitSearch("22101");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(ACCREDITED_REP_REFUSAL_MESSAGE);
    expect(window.location.search).toBe("");
  });
});
