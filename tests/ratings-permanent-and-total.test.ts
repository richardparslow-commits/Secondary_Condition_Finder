/**
 * Regression suite for Heal defects 17 and 35 (2026-11-03 run):
 * "A 100% P&T rating is saved and shown as plain 100%" and "The ratings step
 * has no plain 100% choice, only 100% P&T".
 *
 * Both came from one encoding bug: `getRatingOptions` gave 100% P&T the same
 * submitted value as plain 100%, so the P&T option overwrote the plain option
 * and the designation never reached saved state. The fix gives P&T its own
 * token and carries the designation beside the numeric rating.
 */
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RatingSelect, getRatingOptions } from "@/components/secondary/steps/RatingsStep";
import type { ConditionCatalog } from "@/lib/catalog/schema";
import { applyRatingsStep } from "@/lib/secondary-workflow/client-steps";
import { ratingDisplayLabel } from "@/lib/secondary-workflow/ratings";
import { parseWorkflowState } from "@/lib/secondary-workflow/state";
import { workflowSessionToQueryParams } from "@/lib/secondary-workflow/transport";

const catalog = [{ id: "ptsd" }, { id: "tinnitus" }] as unknown as ConditionCatalog;
const PTSD = "ptsd";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("100% P&T is a distinct answer", () => {
  it("keeps plain 100% and 100% P&T as separate options", () => {
    const options = getRatingOptions();
    expect(options).toContainEqual({ value: "100", label: "100%" });
    expect(options).toContainEqual({ value: "100-pt", label: "100% P&T" });
  });

  it("selects the P&T option only when the stored rating carries the flag", () => {
    const permanentAndTotal = renderToStaticMarkup(
      RatingSelect({
        conditionId: PTSD,
        conditionName: "Post-Traumatic Stress Disorder (PTSD)",
        stored: 100,
        storedPermanentAndTotal: true,
        validationId: undefined,
      }),
    );
    expect(permanentAndTotal).toMatch(
      /<option value="100-pt" selected="">100% P&amp;T<\/option>/,
    );
    expect(permanentAndTotal).toMatch(/<option value="100">100%<\/option>/);

    const plain = renderToStaticMarkup(
      RatingSelect({
        conditionId: PTSD,
        conditionName: "Post-Traumatic Stress Disorder (PTSD)",
        stored: 100,
        validationId: undefined,
      }),
    );
    expect(plain).toMatch(/<option value="100" selected="">100%<\/option>/);
    expect(plain).not.toContain('value="100-pt" selected');
  });
});

describe("the P&T designation survives submit, transport and parse", () => {
  it("stores rating 100 with the condition flagged as P&T", () => {
    const current = {
      version: 1 as const,
      diagnosedConditionIds: [PTSD],
      serviceConnectedConditionIds: [PTSD],
      ratingsByConditionId: {},
    };
    const result = applyRatingsStep(
      current,
      form({ [`rating-${PTSD}`]: "100-pt" }),
      catalog,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.ratingsByConditionId).toEqual({ [PTSD]: 100 });
    expect(result.context.permanentAndTotalConditionIds).toEqual([PTSD]);
  });

  it("round-trips through the query transport without reverting to plain 100%", () => {
    const params = workflowSessionToQueryParams({
      diagnosedConditionIds: [PTSD],
      serviceConnectedConditionIds: [PTSD],
      ratingsByConditionId: { [PTSD]: 100 },
      permanentAndTotalConditionIds: [PTSD],
      documentsShared: true,
    });
    expect(params[`rating-${PTSD}`]).toBe("100-pt");

    const parsed = parseWorkflowState(params, catalog);
    expect(parsed.ratingsByConditionId[PTSD]).toBe(100);
    expect(parsed.permanentAndTotalConditionIds).toEqual([PTSD]);
  });

  it("labels 100% P&T everywhere the rating is displayed", () => {
    expect(ratingDisplayLabel(100, true)).toBe("100% P&T");
    expect(ratingDisplayLabel(100, false)).toBe("100%");
    expect(ratingDisplayLabel(70, true)).toBe("70%");
    expect(ratingDisplayLabel(null, true)).toBeNull();

    const upload = fs.readFileSync(
      path.join(process.cwd(), "src/components/secondary/steps/UploadStep.tsx"),
      "utf8",
    );
    expect(upload).toContain(
      "ratingDisplayLabel(rating, permanentAndTotalConditionIds.includes(id))",
    );
  });
});
