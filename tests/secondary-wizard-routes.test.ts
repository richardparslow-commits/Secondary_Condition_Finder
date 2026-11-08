import fs from "node:fs";
import path from "node:path";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ConditionBadges } from "@/components/secondary/steps/DiagnosedStep";
import { DocumentsSharedChoice } from "@/components/secondary/steps/UploadStep";
import { RatingSelect, getRatingOptions } from "@/components/secondary/steps/RatingsStep";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { parseWorkflowState } from "@/lib/secondary-workflow/state";
import { workflowSessionToQueryParams } from "@/lib/secondary-workflow/transport";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => React.createElement("a", { href, className }, children),
}));

/**
 * PRIV-01 stage 2: the wizard routes no longer render workflow state server
 * side. These tests pin the same user-visible contracts on the extracted
 * presentation units and on the browser-local state contract the client steps
 * consume.
 */
describe("secondary wizard client-step routes", () => {
  const catalog = loadConditionCatalog();

  it("flags toxic-exposure-related conditions on the diagnosed step", () => {
    const asthma = renderToStaticMarkup(
      ConditionBadges({ conditionId: "asthma", mapped: true }),
    );
    expect(asthma).toContain("toxic exposure related");

    const tinnitus = renderToStaticMarkup(
      ConditionBadges({ conditionId: "tinnitus", mapped: true }),
    );
    expect(tinnitus).not.toContain("toxic exposure related");
  });

  it("renders plain 100% and 100% P&T as distinct known options", () => {
    const options = getRatingOptions();
    expect(options).toContainEqual({ label: "100%", value: "100" });
    expect(options).toContainEqual({ label: "100% P&T", value: "100-pt" });
    expect(
      options.every(
        (option) => /^\d+$/.test(option.value) || option.value === "100-pt",
      ),
    ).toBe(true);
    // A shared value is what dropped the designation and hid plain 100%.
    expect(new Set(options.map((option) => option.value)).size).toBe(options.length);
  });

  it("prefills prior rating selections from browser-local state", () => {
    const ptsd = catalog.find((condition) => condition.id === "ptsd");
    expect(ptsd).toBeTruthy();

    const stored = renderToStaticMarkup(
      RatingSelect({
        conditionId: "ptsd",
        conditionName: ptsd?.name ?? "ptsd",
        stored: 70,
        validationId: undefined,
      }),
    );
    expect(stored).toMatch(
      /name="rating-ptsd"[\s\S]*<option value="70" selected="">70%<\/option>/,
    );

    const declined = renderToStaticMarkup(
      RatingSelect({
        conditionId: "tinnitus",
        conditionName: "Tinnitus",
        stored: null,
        validationId: undefined,
      }),
    );
    expect(declined).toMatch(
      /name="rating-tinnitus"[\s\S]*<option value="decline" selected="">I prefer not to answer<\/option>/,
    );
  });

  it("renders 100% P&T and plain 100% as distinct, correctly selected choices", () => {
    const permanentAndTotal = renderToStaticMarkup(
      RatingSelect({
        conditionId: "ptsd",
        conditionName: "Post-Traumatic Stress Disorder (PTSD)",
        stored: 100,
        storedPermanentAndTotal: true,
        validationId: undefined,
      }),
    );

    expect(permanentAndTotal).toMatch(/<option value="100-pt" selected="">100% P&amp;T<\/option>/);
    expect(permanentAndTotal).toMatch(/<option value="100">100%<\/option>/);

    const plain = renderToStaticMarkup(
      RatingSelect({
        conditionId: "ptsd",
        conditionName: "Post-Traumatic Stress Disorder (PTSD)",
        stored: 100,
        validationId: undefined,
      }),
    );

    expect(plain).toMatch(/<option value="100" selected="">100%<\/option>/);
    expect(plain).not.toContain('value="100-pt" selected');
  });

  it("keeps rating inputs free of hidden workflow state", () => {
    const html = renderToStaticMarkup(
      RatingSelect({
        conditionId: "ptsd",
        conditionName: "Post-Traumatic Stress Disorder (PTSD)",
        stored: 40,
        validationId: undefined,
      }),
    );

    expect(html.match(/name="rating-ptsd"/g)).toHaveLength(1);
    expect(html).not.toContain('type="hidden" name="rating-ptsd"');
    expect(html).not.toContain('type="hidden" name="documentsShared"');
    expect(html).not.toContain('type="hidden" name="diagnosed"');
    expect(html).not.toContain('type="hidden" name="serviceConnected"');
  });

  it("prefills the upload documents choice from browser-local state", () => {
    const shared = renderToStaticMarkup(DocumentsSharedChoice({ documentsShared: true }));
    expect(shared).toContain('name="documentsShared" checked="" value="yes"');
    expect(shared).not.toContain('name="documentsShared" checked="" value="no"');

    const notShared = renderToStaticMarkup(DocumentsSharedChoice({ documentsShared: false }));
    expect(notShared).toContain('name="documentsShared" checked="" value="no"');

    // No stored answer must remain unanswered so the submit handler's
    // `select-documents` validation is reachable from the live step (Heal
    // defect: the old `?? false` default silently answered "No").
    const unset = renderToStaticMarkup(DocumentsSharedChoice({}));
    expect(unset).not.toContain('name="documentsShared" checked="" value="yes"');
    expect(unset).not.toContain('name="documentsShared" checked="" value="no"');

    const upload = fs.readFileSync(
      path.join(process.cwd(), "src/components/secondary/steps/UploadStep.tsx"),
      "utf8",
    );
    expect(upload).toContain("const documentsShared = context?.documentsShared;");
  });

  it("keeps back navigation free of workflow query state", () => {
    const diagnosed = fs.readFileSync(
      path.join(process.cwd(), "src/components/secondary/steps/DiagnosedStep.tsx"),
      "utf8",
    );
    const ratings = fs.readFileSync(
      path.join(process.cwd(), "src/components/secondary/steps/RatingsStep.tsx"),
      "utf8",
    );

    expect(diagnosed).toContain('href="/secondary"');
    expect(ratings).toContain('href="/secondary/service-connected"');
    for (const source of [diagnosed, ratings]) {
      expect(source).not.toContain("?diagnosed=");
      expect(source).not.toContain("rating-ptsd=70");
    }
  });

  it("still requires the full prior context before the suggestions step runs", () => {
    // Missing documentsShared is exactly the "Complete prior steps first"
    // guard on Step 5: parseWorkflowState throws, and the client step renders
    // the guard with a link back to the upload step.
    expect(() =>
      parseWorkflowState(
        workflowSessionToQueryParams({
          diagnosedConditionIds: ["ptsd"],
          serviceConnectedConditionIds: ["ptsd"],
          ratingsByConditionId: { ptsd: 70 },
        }),
        catalog,
      ),
    ).toThrow();

    const suggestions = fs.readFileSync(
      path.join(process.cwd(), "src/components/secondary/steps/SuggestionsStep.tsx"),
      "utf8",
    );
    expect(suggestions).toContain("Complete prior steps first");
    expect(suggestions).toContain("Back to optional document upload");
    expect(suggestions).toContain('href="/secondary/upload"');
  });
});
