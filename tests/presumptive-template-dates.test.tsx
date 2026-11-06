// @vitest-environment jsdom
/**
 * Regression for Heal defect `s1-template-dates-not-applied-1`.
 *
 * The quick-start library applies a template by writing directly to the date
 * inputs. Because those inputs were React-controlled, the writes never reached
 * form state and the next render reset them. The form now leaves the date
 * fields uncontrolled and reads their submitted FormData values, so the
 * template's full date window survives and is what the veteran confirms.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceHistoryForm } from "@/components/ServiceHistoryForm";
import { ServiceHistoryTemplateLibrary } from "@/components/presumptive/ServiceHistoryTemplateLibrary";
import {
  clearPresumptiveLocalState,
  readPresumptiveHistory,
} from "@/lib/presumptive/browser-history";
import { PRESUMPTIVE_TEMPLATES } from "@/lib/presumptive/templates";

const h = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, replace: vi.fn(), back: vi.fn() }),
}));

const TEMPLATE = PRESUMPTIVE_TEMPLATES.find(
  (template) => template.id === "agent-orange-vietnam",
);
const BURN_PIT_TEMPLATE = PRESUMPTIVE_TEMPLATES.find(
  (template) => template.id === "pact-burn-pit-southwest-asia",
);

beforeEach(() => {
  clearPresumptiveLocalState(window.sessionStorage);
  h.push.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  clearPresumptiveLocalState(window.sessionStorage);
});

describe("quick-start templates apply their service dates", () => {
  it("fills both dates, keeps them through the rerender, and submits them", () => {
    if (!TEMPLATE) throw new Error("Agent Orange template fixture is missing");

    render(
      <>
        <ServiceHistoryTemplateLibrary templates={PRESUMPTIVE_TEMPLATES} />
        <ServiceHistoryForm
          locations={["Republic of Vietnam"]}
          serviceBranches={[]}
          serviceBranchSourceLabel="test reference"
          serviceBranchNotice="test notice"
        />
      </>,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: `Apply template ${TEMPLATE.label}`,
      }),
    );

    expect(
      (screen.getByRole("checkbox", { name: "Republic of Vietnam" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    const start = screen.getByLabelText(/Start date/) as HTMLInputElement;
    const end = screen.getByLabelText(/End date/) as HTMLInputElement;
    expect(start.value).toBe(TEMPLATE.serviceStart);
    expect(end.value).toBe(TEMPLATE.serviceEnd);

    fireEvent.click(
      screen.getByRole("button", { name: /Show presumptive conditions/i }),
    );

    expect(h.push).toHaveBeenCalledWith("/presumptive/results");
    expect(readPresumptiveHistory(window.sessionStorage)).toMatchObject({
      locations: ["Republic of Vietnam"],
      serviceStart: TEMPLATE.serviceStart,
      serviceEnd: TEMPLATE.serviceEnd,
    });
  });

  it("clears a previous end date when the next template runs to present", () => {
    if (!TEMPLATE || !BURN_PIT_TEMPLATE) {
      throw new Error("Template fixtures are missing");
    }

    render(
      <>
        <ServiceHistoryTemplateLibrary templates={PRESUMPTIVE_TEMPLATES} />
        <ServiceHistoryForm
          locations={["Republic of Vietnam", "Iraq"]}
          serviceBranches={[]}
          serviceBranchSourceLabel="test reference"
          serviceBranchNotice="test notice"
        />
      </>
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: `Apply template ${TEMPLATE.label}`,
      }),
    );
    const start = screen.getByLabelText(/Start date/) as HTMLInputElement;
    const end = screen.getByLabelText(/End date/) as HTMLInputElement;
    expect(end.value).toBe(TEMPLATE.serviceEnd);

    fireEvent.click(
      screen.getByRole("button", {
        name: `Apply template ${BURN_PIT_TEMPLATE.label}`,
      }),
    );

    expect(start.value).toBe(BURN_PIT_TEMPLATE.serviceStart);
    expect(end.value).toBe("");

    fireEvent.click(
      screen.getByRole("button", { name: /Show presumptive conditions/i }),
    );

    expect(h.push).toHaveBeenCalledWith("/presumptive/results");
    expect(readPresumptiveHistory(window.sessionStorage)).toMatchObject({
      locations: ["Iraq"],
      serviceStart: BURN_PIT_TEMPLATE.serviceStart,
      serviceEnd: null,
    });
  });
});
