import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import RatingsStepPage from "@/app/secondary/ratings/page";
import SuggestionsStepPage from "@/app/secondary/suggestions/page";
import UploadStepPage from "@/app/secondary/upload/page";

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
  it("keeps prior query state in ratings back navigation", async () => {
    const html = renderToStaticMarkup(
      await RatingsStepPage({
        searchParams: Promise.resolve({
          diagnosed: ["ptsd", "tinnitus"],
          serviceConnected: ["ptsd"],
        }),
      }),
    );

    expect(html).toContain(
      'href="/secondary/service-connected?diagnosed=ptsd&amp;diagnosed=tinnitus&amp;serviceConnected=ptsd"',
    );
  });

  it("keeps prior query state in upload back navigation", async () => {
    const html = renderToStaticMarkup(
      await UploadStepPage({
        searchParams: Promise.resolve({
          diagnosed: ["ptsd", "tinnitus"],
          serviceConnected: ["ptsd", "tinnitus"],
          "rating-ptsd": "70",
          "rating-tinnitus": "decline",
        }),
      }),
    );

    expect(html).toContain(
      "href=\"/secondary/ratings?diagnosed=ptsd&amp;diagnosed=tinnitus&amp;serviceConnected=ptsd&amp;serviceConnected=tinnitus&amp;rating-ptsd=70&amp;rating-tinnitus=decline\"",
    );
  });

  it("blocks suggestions step when upload selection is missing", async () => {
    const html = renderToStaticMarkup(
      await SuggestionsStepPage({
        searchParams: Promise.resolve({
          diagnosed: ["ptsd"],
          serviceConnected: ["ptsd"],
          "rating-ptsd": "70",
        }),
      }),
    );

    expect(html).toContain("Complete prior steps first");
    expect(html).toContain("Back to optional document upload");
    expect(html).toContain(
      'href="/secondary/upload?diagnosed=ptsd&amp;serviceConnected=ptsd&amp;rating-ptsd=70"',
    );
  });
});
