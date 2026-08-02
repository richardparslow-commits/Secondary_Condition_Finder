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

  it("prefills prior rating selections when returning to ratings", async () => {
    const html = renderToStaticMarkup(
      await RatingsStepPage({
        searchParams: Promise.resolve({
          diagnosed: ["ptsd", "tinnitus"],
          serviceConnected: ["ptsd", "tinnitus"],
          "rating-ptsd": "70",
          "rating-tinnitus": "decline",
        }),
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
        searchParams: Promise.resolve({
          diagnosed: ["ptsd"],
          serviceConnected: ["ptsd"],
          "rating-ptsd": "100",
        }),
      }),
    );

    expect(html).toMatch(/<option value="100" selected="">100% P&amp;T<\/option>/);
    expect(html).not.toContain('>100%</option>');
  });

  it("renders rating inputs only for service-connected conditions", async () => {
    const html = renderToStaticMarkup(
      await RatingsStepPage({
        searchParams: Promise.resolve({
          diagnosed: ["ptsd", "tinnitus"],
          serviceConnected: ["ptsd"],
        }),
      }),
    );

    expect(html).toContain("for each service-connected condition");
    expect(html).toContain('name="rating-ptsd"');
    expect(html).not.toContain('name="rating-tinnitus"');
    expect(html).toContain("Rating for Post-Traumatic Stress Disorder (PTSD)");
  });

  it("does not re-emit stale rating params as hidden inputs on the ratings step", async () => {
    const html = renderToStaticMarkup(
      await RatingsStepPage({
        searchParams: Promise.resolve({
          diagnosed: ["ptsd"],
          serviceConnected: ["ptsd"],
          "rating-ptsd": "40",
          documentsShared: "yes",
        }),
      }),
    );

    expect(html.match(/name="rating-ptsd"/g)).toHaveLength(1);
    expect(html).not.toContain('type="hidden" name="rating-ptsd"');
    expect(html).toContain('type="hidden" name="documentsShared" value="yes"');
  });

  it("prefills prior upload selection when returning to upload", async () => {
    const html = renderToStaticMarkup(
      await UploadStepPage({
        searchParams: Promise.resolve({
          diagnosed: ["ptsd"],
          serviceConnected: ["ptsd"],
          "rating-ptsd": "70",
          documentsShared: "yes",
        }),
      }),
    );

    expect(html).toContain('name="documentsShared" checked="" value="yes"');
    expect(html).not.toContain('name="documentsShared" checked="" value="no"');
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
