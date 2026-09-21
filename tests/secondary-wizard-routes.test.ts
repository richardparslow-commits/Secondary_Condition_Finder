import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import DiagnosedConditionsPage from "@/app/secondary/diagnosed/page";
import RatingsStepPage from "@/app/secondary/ratings/page";
import SuggestionsStepPage from "@/app/secondary/suggestions/page";
import UploadStepPage from "@/app/secondary/upload/page";

vi.mock("next/headers", () => ({
  cookies: async () => new Map(),
}));

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

describe("secondary wizard route progression", () => {
  it("flags toxic-exposure-related conditions on the diagnosed step", async () => {
    const html = renderToStaticMarkup(
      await DiagnosedConditionsPage({
        searchParams: Promise.resolve({}),
      }),
    );

    const labels = html.match(/<label[\s\S]*?<\/label>/g) ?? [];
    const asthmaLabel = labels.find((label) => label.includes(">Asthma<")) ?? "";
    expect(asthmaLabel).toContain("toxic exposure related");

    const tinnitusLabel =
      labels.find((label) => label.includes(">Tinnitus<")) ?? "";
    expect(tinnitusLabel).not.toContain("toxic exposure related");
  });

  it("keeps ratings back navigation free of workflow query state", async () => {
    const html = renderToStaticMarkup(
      await RatingsStepPage({
        workflowState: {
          diagnosedConditionIds: ["ptsd", "tinnitus"],
          serviceConnectedConditionIds: ["ptsd"],
          ratingsByConditionId: {},
        },
      }),
    );

    expect(html).toContain('href="/secondary/service-connected"');
    expect(html).not.toContain("?diagnosed=");
    expect(html).not.toContain("serviceConnected=");
  });

  it("keeps upload back navigation free of workflow query state", async () => {
    const html = renderToStaticMarkup(
      await UploadStepPage({
        workflowState: {
          diagnosedConditionIds: ["ptsd", "tinnitus"],
          serviceConnectedConditionIds: ["ptsd", "tinnitus"],
          ratingsByConditionId: { ptsd: 70, tinnitus: null },
        },
      }),
    );

    expect(html).toContain('href="/secondary/ratings"');
    expect(html).not.toContain("?diagnosed=");
    expect(html).not.toContain("rating-ptsd=70");
  });

  it("prefills prior rating selections from private workflow state", async () => {
    const html = renderToStaticMarkup(
      await RatingsStepPage({
        workflowState: {
          diagnosedConditionIds: ["ptsd", "tinnitus"],
          serviceConnectedConditionIds: ["ptsd", "tinnitus"],
          ratingsByConditionId: { ptsd: 70, tinnitus: null },
        },
      }),
    );

    expect(html).toMatch(
      /name="rating-ptsd"[\s\S]*<option value="70" selected="">70%<\/option>/,
    );
    expect(html).toMatch(
      /name="rating-tinnitus"[\s\S]*<option value="decline" selected="">I prefer not to answer<\/option>/,
    );
  });

  it("renders 100% P&T with a numeric submitted value", async () => {
    const html = renderToStaticMarkup(
      await RatingsStepPage({
        workflowState: {
          diagnosedConditionIds: ["ptsd"],
          serviceConnectedConditionIds: ["ptsd"],
          ratingsByConditionId: { ptsd: 100 },
        },
      }),
    );

    expect(html).toMatch(/<option value="100" selected="">100% P&amp;T<\/option>/);
    expect(html).not.toContain('>100%</option>');
  });

  it("renders rating inputs only for service-connected conditions", async () => {
    const html = renderToStaticMarkup(
      await RatingsStepPage({
        workflowState: {
          diagnosedConditionIds: ["ptsd", "tinnitus"],
          serviceConnectedConditionIds: ["ptsd"],
          ratingsByConditionId: {},
        },
      }),
    );

    expect(html).toContain("for each service-connected condition");
    expect(html).toContain('name="rating-ptsd"');
    expect(html).not.toContain('name="rating-tinnitus"');
    expect(html).toContain("Rating for Post-Traumatic Stress Disorder (PTSD)");
  });

  it("does not emit workflow state as hidden inputs on the ratings step", async () => {
    const html = renderToStaticMarkup(
      await RatingsStepPage({
        workflowState: {
          diagnosedConditionIds: ["ptsd"],
          serviceConnectedConditionIds: ["ptsd"],
          ratingsByConditionId: { ptsd: 40 },
          documentsShared: true,
        },
      }),
    );

    expect(html.match(/name="rating-ptsd"/g)).toHaveLength(1);
    expect(html).not.toContain('type="hidden" name="rating-ptsd"');
    expect(html).not.toContain('type="hidden" name="documentsShared"');
    expect(html).not.toContain('type="hidden" name="diagnosed"');
    expect(html).not.toContain('type="hidden" name="serviceConnected"');
  });

  it("prefills prior upload selection from private workflow state", async () => {
    const html = renderToStaticMarkup(
      await UploadStepPage({
        workflowState: {
          diagnosedConditionIds: ["ptsd"],
          serviceConnectedConditionIds: ["ptsd"],
          ratingsByConditionId: { ptsd: 70 },
          documentsShared: true,
        },
      }),
    );

    expect(html).toContain('name="documentsShared" checked="" value="yes"');
    expect(html).not.toContain('name="documentsShared" checked="" value="no"');
  });

  it("blocks suggestions step when upload selection is missing", async () => {
    const html = renderToStaticMarkup(
      await SuggestionsStepPage({
        workflowState: {
          diagnosedConditionIds: ["ptsd"],
          serviceConnectedConditionIds: ["ptsd"],
          ratingsByConditionId: { ptsd: 70 },
        },
      }),
    );

    expect(html).toContain("Complete prior steps first");
    expect(html).toContain("Back to optional document upload");
    expect(html).toContain('href="/secondary/upload"');
    expect(html).not.toContain("?diagnosed=");
    expect(html).not.toContain("rating-ptsd=70");
  });
});
