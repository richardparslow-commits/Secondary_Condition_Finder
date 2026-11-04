// @vitest-environment jsdom
/**
 * Regression suite for Heal defect 38 (2026-11-03 run): "Step 3's Current
 * Summary stays blank after a rating is chosen".
 *
 * The rating selects are uncontrolled and the summary read saved context, which
 * only changes on submit — so the summary stayed stale while the veteran was
 * choosing. The step now keeps the chosen values in draft state, and the
 * summary prefers a draft over the saved value.
 */
import fs from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CurrentRatingSummary,
  RatingSelect,
} from "@/components/secondary/steps/RatingsStep";
import { ratingSelectionLabel } from "@/lib/secondary-workflow/ratings";

afterEach(cleanup);

describe("the Current Summary follows the selection in place", () => {
  it("labels every select value the step can hold", () => {
    expect(ratingSelectionLabel("30")).toBe("30%");
    expect(ratingSelectionLabel("100-pt")).toBe("100% P&T");
    expect(ratingSelectionLabel("decline")).toBe("Not provided");
    expect(ratingSelectionLabel("")).toBe("—");
  });

  it("reports a chosen value through the select callback", () => {
    const onValueChange = vi.fn();
    render(
      <RatingSelect
        conditionId="ptsd"
        conditionName="PTSD"
        stored={undefined}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Rating for PTSD/), {
      target: { value: "100-pt" },
    });

    expect(onValueChange).toHaveBeenCalledWith("100-pt");
  });

  it("shows a draft selection instead of the saved context", () => {
    render(
      <CurrentRatingSummary
        conditions={[
          { id: "ptsd", name: "PTSD" },
          { id: "tinnitus", name: "Tinnitus" },
        ]}
        ratingsByConditionId={{ ptsd: 30, tinnitus: null }}
        permanentAndTotalConditionIds={[]}
        draftRatings={{ ptsd: "100-pt" }}
      />,
    );

    // The draft wins for PTSD; the untouched condition still reads its saved
    // "prefer not to answer" value.
    expect(screen.getByText("100% P&T")).toBeTruthy();
    expect(screen.queryByText("30%")).toBeNull();
    expect(screen.getByText("Not provided")).toBeTruthy();
  });

  it("wires the selects and the summary to the same draft state", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/secondary/steps/RatingsStep.tsx"),
      "utf8",
    );
    expect(source).toContain(
      "setDraftRatings((prev) => ({ ...prev, [conditionId]: value }))",
    );
    expect(source).toContain("draftRatings={draftRatings}");
    expect(source).toContain("onChange={(event) => onValueChange?.(event.target.value)}");
  });
});
