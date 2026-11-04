// @vitest-environment jsdom
/**
 * Audit A01 — mounted proof that the Forms Finder keeps search text out of the
 * URL.
 *
 * The source pin in tests/va-forms-finder-no-url-exposure.test.ts can tell that
 * no `method="get"` and no `router.push` exist. This suite mounts the real
 * surface, drives a real submit through the real `useActionState` wiring, and
 * checks the two things a reader actually cares about:
 *
 *   1. the submitted text arrives in the action's FormData (the request body);
 *   2. after a submit — including on the refusal path — the browser URL still
 *      carries no trace of it.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VaFormsFinder } from "@/components/va/VaFormsFinder";
import type { VaFormsFinderView } from "@/lib/va/forms-finder";
import {
  FORMS_FINDER_REFUSAL_MESSAGE,
  FORMS_FINDER_UNAVAILABLE_MESSAGE,
  type VaFormsFinderSearchState,
} from "@/lib/va/forms-finder-search";

const CANARY = "CANARY-QUERY-90210";

const { actionMock } = vi.hoisted(() => ({ actionMock: vi.fn() }));

vi.mock("@/lib/actions/va-forms-finder", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/actions/va-forms-finder")>()),
  searchVaFormsFinder: actionMock,
}));

function view(overrides: Partial<VaFormsFinderView> = {}): VaFormsFinderView {
  return {
    query: "21-526EZ",
    items: [
      {
        formName: "21-526EZ",
        title: "Application for Disability Compensation and Related Compensation Benefits",
        url: "https://www.va.gov/find-forms/about-form-21-526ez/",
        lastRevisionOn: "2024-05-01",
        pages: 12,
        validPdf: true,
      },
    ],
    source: "local-fallback",
    sourceLabel: "Local reference",
    live: false,
    environment: null,
    retrievedAt: null,
    cacheStatus: "miss",
    notice: "Local reference data is shown because live VA access is unavailable or disabled.",
    ...overrides,
  } as VaFormsFinderView;
}

function state(next: Partial<VaFormsFinderSearchState>): VaFormsFinderSearchState {
  return { view: view(), refusal: null, ...next };
}

async function submitSearch(text: string): Promise<void> {
  const input = screen.getByLabelText("Search VA forms");
  fireEvent.change(input, { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
  });
}

beforeEach(() => {
  actionMock.mockReset();
  actionMock.mockResolvedValue(state({}));
  window.history.replaceState(null, "", "/va-forms/finder");
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("Forms Finder search submission (A01)", () => {
  it("renders the server-resolved default view before any interaction", () => {
    render(<VaFormsFinder initialView={view()} />);

    expect(screen.getByText(/1 result shown for 21-526EZ/)).toBeTruthy();
    expect(screen.getByText("Local reference")).toBeTruthy();
    expect(
      screen.getByText(/live VA access is unavailable or disabled/),
    ).toBeTruthy();
    // The search control is an action-driven POST form, not a GET form.
    const form = document.querySelector("form");
    expect(form).not.toBeNull();
    expect(form!.getAttribute("method")?.toLowerCase() ?? "post").not.toBe("get");
  });

  it("sends the search text in the request body and leaves the URL untouched", async () => {
    actionMock.mockResolvedValue(state({ view: view({ query: CANARY, items: [] }) }));
    render(<VaFormsFinder initialView={view()} />);

    const urlBefore = window.location.href;
    await submitSearch(CANARY);

    // 1. The text reached the action — in the FormData, i.e. the POST body.
    expect(actionMock).toHaveBeenCalledTimes(1);
    const submitted = actionMock.mock.calls[0][1] as FormData;
    expect(submitted.get("q")).toBe(CANARY);

    // 2. The browser URL never carried it, before or after the submit.
    expect(urlBefore).not.toContain(CANARY);
    expect(window.location.href).not.toContain(CANARY);
    expect(window.location.search).toBe("");
    expect(document.URL).not.toContain(CANARY);

    // 3. The returned view is what renders.
    expect(screen.getByText(new RegExp(`0 results shown for ${CANARY}`))).toBeTruthy();
  });

  it("keeps the finder, its results and the typed query when the server cannot be reached", async () => {
    // The offline defect: a rejected server-action call escaped useActionState,
    // the route error boundary replaced the page, and the typed query was gone.
    actionMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<VaFormsFinder initialView={view()} />);

    await submitSearch(CANARY);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(FORMS_FINDER_UNAVAILABLE_MESSAGE);
    expect(alert.textContent).not.toContain(CANARY);
    // Still mounted, prior results intact, and the query survived the implicit
    // action reset so the visitor can retry without retyping.
    expect(screen.getByText("VA Form Finder")).toBeTruthy();
    expect(screen.getByText(/1 result shown for 21-526EZ/)).toBeTruthy();
    expect((screen.getByLabelText("Search VA forms") as HTMLInputElement).value).toBe(CANARY);
    expect(window.location.href).not.toContain(CANARY);
    expect(window.location.search).toBe("");
  });

  it("discloses the item bound when a broad search fills it", () => {
    const items = Array.from({ length: 200 }, (_, index) => ({
      formName: `21-${String(index).padStart(4, "0")}`,
      title: `Matching form ${index}`,
      url: `https://www.va.gov/find-forms/about-form-${index}/`,
      lastRevisionOn: null,
      pages: null,
      validPdf: null,
    }));

    render(<VaFormsFinder initialView={view({ items })} />);

    expect(screen.getByText(/200 results shown for 21-526EZ/)).toBeTruthy();
    expect(screen.getByText(/Showing the first 200 matches/)).toBeTruthy();
  });

  it("keeps the URL clean on an oversized-input refusal and echoes nothing", async () => {
    actionMock.mockResolvedValue(state({ refusal: "oversized-value" }));
    render(<VaFormsFinder initialView={view()} />);

    await submitSearch(`${CANARY}${"x".repeat(200)}`);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(FORMS_FINDER_REFUSAL_MESSAGE);
    expect(alert.textContent).not.toContain(CANARY);
    expect(window.location.href).not.toContain(CANARY);
    expect(window.location.search).toBe("");
  });
});
