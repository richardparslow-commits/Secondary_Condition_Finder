// @vitest-environment jsdom
/**
 * Regression for Heal defect `s1-guide-points-at-missing-analyzer-1`.
 *
 * The standalone records guide reuses the walkthrough but has no evidence
 * analyzer. Its copy must point into the secondary workflow's document step;
 * the workflow copy may still refer to the analyzer beside it.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { VaGovRecordWalkthrough } from "@/components/secondary/VaGovRecordWalkthrough";

afterEach(cleanup);

describe("records walkthrough page context", () => {
  it("does not point to an analyzer on the standalone page", () => {
    render(<VaGovRecordWalkthrough evidenceAnalyzerOnPage={false} />);

    expect(
      screen.queryAllByText(/evidence analyzer on this page/i),
    ).toHaveLength(0);
    expect(
      screen.getAllByText(/secondary workflow's document step/i).length,
    ).toBeGreaterThan(0);
  });

  it("keeps the on-page analyzer instruction beside the workflow analyzer", () => {
    render(<VaGovRecordWalkthrough />);

    expect(
      screen.getAllByText(/evidence analyzer on this page/i).length,
    ).toBeGreaterThan(0);
  });
});
