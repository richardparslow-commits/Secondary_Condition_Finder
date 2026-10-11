// @vitest-environment jsdom
/**
 * Component-level accessibility gate: the WAI-ARIA tabs pattern
 * (`SecondarySuggestionsTabs`, Step 5 list/timeline switcher).
 *
 * Tabs are one of the highest-risk accessible components to author by hand —
 * `aria-selected`, `aria-controls`/`aria-labelledby` pairing, and roving
 * `tabIndex` must all agree, and they must keep agreeing after the user
 * switches panels. So this file asserts the pattern twice: once on initial
 * render and once after a tab switch re-renders the dynamic DOM.
 *
 * Environment and gate semantics are shared with the rest of the suite (see
 * `tests/setup/accessibility.ts`): `wcag2a/wcag2aa/wcag21a/wcag21aa` at
 * critical/serious impact, `color-contrast` skipped because jsdom applies no
 * cascade. A green run here blocks markup regressions; it is not a Section
 * 508 conformance certificate (manual review stays in
 * `docs/section508-manual-review-workbook.md`).
 *
 * Fixtures use the real `TimelineConditionInput`/`TimelineConnectionInput`
 * view types, so a field rename breaks this file at compile time instead of
 * silently hollowing the fixture.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { expectNoBlockingA11yViolations } from "../../../tests/setup/accessibility";
import { SecondarySuggestionsTabs } from "../secondary/SecondarySuggestionsTabs";
import type {
  TimelineConditionInput,
  TimelineConnectionInput,
} from "../secondary/ConditionTimelineVisualization";

afterEach(cleanup);

const CONDITIONS: TimelineConditionInput[] = [
  {
    id: "ptsd",
    name: "Post-traumatic stress disorder",
    bodySystem: "Mental health",
    isServiceConnected: true,
    onsetYear: 2019,
    diagnosisYear: 2020,
  },
  {
    id: "sleep-apnea",
    name: "Sleep apnea",
    bodySystem: "Respiratory",
    isServiceConnected: false,
    onsetYear: 2021,
    diagnosisYear: 2022,
  },
];

const CONNECTIONS: TimelineConnectionInput[] = [
  {
    primaryId: "ptsd",
    primaryName: "Post-traumatic stress disorder",
    secondaryId: "sleep-apnea",
    secondaryName: "Sleep apnea",
    hasChronologyWarning: false,
  },
];

function renderTabs() {
  return render(
    <SecondarySuggestionsTabs conditions={CONDITIONS} connections={CONNECTIONS} datedCount={2}>
      <p>List-panel content.</p>
    </SecondarySuggestionsTabs>,
  );
}

describe("axe gate — connection review tabs", () => {
  it("renders the tablist with no critical or serious WCAG 2.1 AA violation", async () => {
    const { container } = renderTabs();

    // Non-vacuity: the tab/tabpanel wiring the gate exists to protect.
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(screen.getByRole("tabpanel", { name: /list view/i })).not.toBeNull();
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs[1].getAttribute("aria-selected")).toBe("false");
    expect(tabs[1].getAttribute("tabindex")).toBe("-1");

    const summary = await expectNoBlockingA11yViolations(container);
    expect(summary.passes).toBeGreaterThan(0);
  });

  it("stays violation-free after switching panels, by click and by keyboard", async () => {
    const { container } = renderTabs();

    // Click activation: selection, visibility, and roving tabIndex follow.
    fireEvent.click(screen.getByRole("tab", { name: /timeline/i }));
    const timelineTab = screen.getByRole("tab", { name: /timeline/i });
    expect(timelineTab.getAttribute("aria-selected")).toBe("true");
    expect(timelineTab.getAttribute("tabindex")).toBe("0");
    expect(container.querySelector("#panel-timeline")?.hasAttribute("hidden")).toBe(false);
    expect(container.querySelector("#panel-list")?.hasAttribute("hidden")).toBe(true);

    // Keyboard contract: ArrowLeft wraps back and moves focus with selection.
    fireEvent.keyDown(timelineTab, { key: "ArrowLeft" });
    const listTab = screen.getByRole("tab", { name: /list view/i });
    expect(listTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(listTab);

    // The second axe run covers the post-interaction DOM: the state this test
    // exists for. Assert the switched state is still on screen first, or the
    // run proves nothing about it.
    expect(container.querySelector("#panel-list")?.hasAttribute("hidden")).toBe(false);

    await expectNoBlockingA11yViolations(container);
  });
});
