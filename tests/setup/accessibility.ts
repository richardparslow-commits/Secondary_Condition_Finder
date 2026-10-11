/**
 * Accessibility test setup (registered via `test.setupFiles` in vitest.config.ts).
 *
 * This file runs for **every** test file in the suite, and the suite is
 * overwhelmingly node-environment (319 files of data/contract assertions), so
 * nothing here may touch `window`, `document`, or load a DOM-dependent library
 * at import time. `axe-core` is therefore imported lazily inside the helper,
 * which only a jsdom-environment test ever calls.
 *
 * Why the gate is "critical or serious" and not "any violation":
 *
 *   - WCAG 2.1 AA conformance is what the Section 508 audit asks about, and axe
 *     maps its `critical`/`serious` impacts to the failures that block assistive
 *     technology (missing accessible names, broken form labels, invalid ARIA
 *     relationships). Failing CI on a `moderate` finding such as `region`
 *     (content outside a landmark) would make the gate noisy enough to be
 *     disabled, which is the failure mode that matters.
 *   - `minor` findings are recommendations, not conformance failures.
 *
 * What this gate does NOT cover, stated because overclaiming here is how an
 * accessibility report becomes worthless:
 *
 *   - **Color contrast.** The `color-contrast` rule needs computed styles from a
 *     real layout; jsdom loads no stylesheet and applies no cascade, so the rule
 *     can only ever return "incomplete". Contrast stays a manual-review item and
 *     is recorded as such in `docs/section508-manual-review-workbook.md`.
 *   - **Anything requiring a real screen reader**: announcement ordering,
 *     reading order, verbosity, and whether an announcement is actually
 *     *useful*. axe checks that a live region is well-formed, never that the
 *     text it carries is intelligible.
 *   - **Keyboard traversal order.** Focus order and skip-link behavior are
 *     checked structurally by `tests/accessibility-ux-reliability.test.ts` and
 *     remain a manual item for assistive-technology confirmation.
 *
 * The helper asserts on the *summary*, not the raw results object, so a failure
 * message names the rule, its impact, and the offending selector rather than
 * dumping the whole axe tree into CI output.
 */
import { expect } from "vitest";

/** Impacts that fail the build. Kept exported so tests can assert the intent. */
export const AXE_BLOCKING_IMPACTS = ["critical", "serious"] as const;

/**
 * Rules skipped in the jsdom environment, each for a mechanical reason rather
 * than because it is inconvenient. An exception added here without such a reason
 * is a weakening of the gate and should be rejected in review.
 */
export const AXE_JSOM_SKIPPED_RULES = {
  // Requires computed styles and layout from a real rendering engine; jsdom
  // applies neither, so this rule can only report "incomplete".
  "color-contrast": { enabled: false },
} as const;

export interface BlockingViolationSummary {
  id: string;
  impact: string;
  help: string;
  /** First offending target only — enough to locate it, bounded in size. */
  target: string;
}

/**
 * Run axe against `container` and fail on any critical/serious violation.
 *
 * Returns the passing axe summary when the gate passes, so a caller can make
 * further assertions (for example that a rule actually executed, which is what
 * keeps the gate from passing vacuously when a rule is misconfigured).
 */
export async function expectNoBlockingA11yViolations(
  container: Element,
): Promise<{ violations: number; passes: number; incomplete: number }> {
  const { default: axe } = await import("axe-core");

  const results = await axe.run(container, {
    rules: { ...AXE_JSOM_SKIPPED_RULES },
    // WCAG 2.1 A + AA, which is the standard Section 508 incorporates by
    // reference (36 CFR 1194 / Revised 508 standards → WCAG 2.0 AA, updated to
    // 2.1 AA by VA's own baseline).
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    },
  });

  const blocking: BlockingViolationSummary[] = results.violations
    .filter((violation) =>
      (AXE_BLOCKING_IMPACTS as readonly string[]).includes(violation.impact ?? ""),
    )
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact ?? "unknown",
      help: violation.help,
      target: String(violation.nodes[0]?.target?.[0] ?? "unknown"),
    }));

  expect(
    blocking,
    `Accessibility gate: ${blocking.length} critical/serious WCAG 2.1 AA violation(s). ` +
      "Fix the markup rather than adding an exception to AXE_JSOM_SKIPPED_RULES.",
  ).toEqual([]);

  return {
    violations: blocking.length,
    passes: results.passes.length,
    incomplete: results.incomplete.length,
  };
}
