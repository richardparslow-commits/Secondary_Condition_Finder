// @vitest-environment jsdom
/**
 * Form-interaction and full-page accessibility gate (Section 508 / WCAG 2.1 AA).
 *
 * Companion to `tests/accessibility-automation.test.tsx` (DAG visualizer,
 * /pathways page, live regions). This file covers what that suite does not:
 * a complex multi-fieldset form in its initial state AND after an interaction
 * that reveals a validation error, plus a full shipped page tree.
 *
 * Environment and gate semantics are shared: `// @vitest-environment jsdom`
 * opts this file into a DOM (the suite default is `node`), mounting uses
 * `@testing-library/react`, and assertions go through
 * `expectNoBlockingA11yViolations` (`tests/setup/accessibility.ts`), which
 * enforces wcag2a/wcag2aa/wcag21a/wcag21aa at critical/serious impact. Read
 * that setup file for what this gate cannot cover (color contrast, keyboard
 * traversal order, screen-reader usefulness) — those stay human-verification
 * items in `docs/section508-manual-review-workbook.md`, and a green run here
 * is not a Section 508 conformance certificate.
 *
 * Fixtures are real: locations come from the shipped exposure catalog and the
 * branch reference is loaded from disk, so a catalog or reference change that
 * breaks labeling fails here instead of silently hollowing the fixture.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PresumptivePage from "@/app/presumptive/page";
import { ServiceHistoryForm } from "@/components/ServiceHistoryForm";
import { listLocations } from "@/lib/presumptive/match";
import { loadExposureCatalog } from "@/lib/presumptive/load";
import { loadServiceBranchReference } from "@/lib/va/service-branches";

import { expectNoBlockingA11yViolations } from "./setup/accessibility";

// The form and the DD-214 analyzer call `useRouter()` for the post-confirm
// redirect. Navigation never happens under test (invalid data stays on the
// form; valid data is not submitted here), so a minimal stub is exact.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

afterEach(cleanup);

async function formProps() {
  const branchReference = await loadServiceBranchReference();
  return {
    locations: listLocations(loadExposureCatalog()),
    serviceBranches: branchReference.items,
    serviceBranchSourceLabel: branchReference.sourceLabel,
    serviceBranchNotice: branchReference.notice,
  };
}

describe("axe gate — service history form", () => {
  it("renders the untouched form with no critical or serious WCAG 2.1 AA violation", async () => {
    const { container } = render(<ServiceHistoryForm {...await formProps()} />);

    // Non-vacuity: the three fieldset groups and the disabled submit must be
    // present, or axe reviewed an empty shell.
    expect(container.querySelectorAll("fieldset")).toHaveLength(3);
    expect(container.textContent).toContain("Which service branch or branches apply to you?");
    expect(container.textContent).toContain("Where did you serve?");
    expect(container.textContent).toContain("When did you serve there?");
    const submit = screen.getByRole("button", { name: /show presumptive conditions/i });
    expect(submit.hasAttribute("disabled")).toBe(true);

    const summary = await expectNoBlockingA11yViolations(container);
    expect(summary.passes).toBeGreaterThan(0);
  });

  it("stays violation-free after an interaction reveals the validation error state", async () => {
    const { container } = render(<ServiceHistoryForm {...await formProps()} />);

    // Enable submit by selecting a location (branch checkboxes do not count),
    // then enter an out-of-order date range so the form renders its
    // role="alert" error surface.
    const locationCheckbox = container.querySelector('input[name="location"]');
    expect(locationCheckbox).not.toBeNull();
    fireEvent.click(locationCheckbox!);
    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: "2021-06-01" },
    });
    fireEvent.change(screen.getByLabelText(/end date/i), {
      target: { value: "2020-01-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: /show presumptive conditions/i }));

    // The dynamic error state is what this test exists for: assert it rendered
    // before running axe, or the second run proves nothing about it.
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/on or before/i);

    await expectNoBlockingA11yViolations(container);
  });
});

describe("axe gate — full presumptive page tree", () => {
  it("mounts the shipped page with landmarks, heading order, and no critical or serious violation", async () => {
    // The real async server component, awaited into an element: this exercises
    // the shipped markup, the shipped catalog/reference data, and the composed
    // DD-214 analyzer + template library + history form — the composition
    // where missing landmarks, duplicate IDs, and skipped heading levels hide.
    // A full tree is required because Section 508 landmarks (exactly one main,
    // one h1, no skipped heading levels) are properties of the page, not of
    // any single component.
    const { container } = render(await PresumptivePage({}));

    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelectorAll("h1")).toHaveLength(1);

    const levels = [...container.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((heading) =>
      Number(heading.tagName.slice(1)),
    );
    expect(levels[0]).toBe(1);
    for (let index = 1; index < levels.length; index += 1) {
      expect(
        levels[index] - levels[index - 1],
        `skipped heading level before "${container.querySelectorAll("h1, h2, h3, h4, h5, h6")[index].textContent?.slice(0, 60)}"`,
      ).toBeLessThanOrEqual(1);
    }

    const summary = await expectNoBlockingA11yViolations(container);
    expect(summary.passes).toBeGreaterThan(0);
  });
});
