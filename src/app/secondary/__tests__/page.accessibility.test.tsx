// @vitest-environment jsdom
/**
 * Page-level layout accessibility gate: the secondary-track landing page.
 *
 * A component test can prove every widget is labeled and still ship a page no
 * assistive technology can navigate — landmarks, heading order, and ID
 * uniqueness are properties of the composed tree, not of any single
 * component. The VA production review holds the shipped pages to exactly
 * these structural properties (missing <main>, duplicate IDs, skipped heading
 * levels), so this test mounts the real `SecondaryLandingPage` and asserts
 * them directly before running axe over the whole tree.
 *
 * Gate semantics are shared with the rest of the suite (see
 * `tests/setup/accessibility.ts`): wcag2a/wcag2aa/wcag21a/wcag21aa at
 * critical/serious impact. A green run blocks structural regressions; it is
 * not a Section 508 conformance certificate (manual review stays in
 * `docs/section508-manual-review-workbook.md`).
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { expectNoBlockingA11yViolations } from "../../../../tests/setup/accessibility";
import SecondaryLandingPage from "../page";

afterEach(cleanup);

describe("axe gate — secondary landing page tree", () => {
  it("mounts the shipped page with landmarks, heading order, unique IDs, and no critical or serious violation", async () => {
    // The real zero-prop page component: sync, no dynamic APIs, so `render`
    // exercises the actual shipped markup — hero, track cards, legal
    // references, footer note, and disclaimer.
    const { container } = render(<SecondaryLandingPage />);

    // Exactly one main landmark: a second <main> (or none) orphans every
    // landmark-navigation shortcut a screen-reader user relies on.
    expect(container.querySelectorAll("main")).toHaveLength(1);

    // Exactly one h1, first in heading order, with no skipped levels: heading
    // order is the table of contents for non-visual navigation.
    const headings = [...container.querySelectorAll("h1, h2, h3, h4, h5, h6")];
    expect(headings.length).toBeGreaterThan(0);
    const levels = headings.map((heading) => Number(heading.tagName.slice(1)));
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(levels[0]).toBe(1);
    for (let index = 1; index < levels.length; index += 1) {
      expect(
        levels[index] - levels[index - 1],
        `skipped heading level before "${headings[index].textContent?.slice(0, 60)}"`,
      ).toBeLessThanOrEqual(1);
    }

    // Duplicate IDs break aria-labelledby/aria-controls pairing page-wide.
    const ids = [...container.querySelectorAll("[id]")].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);

    expect(container.textContent).toContain("Secondary Service Connection Conditions");

    const summary = await expectNoBlockingA11yViolations(container);
    expect(summary.passes).toBeGreaterThan(0);
  });
});
