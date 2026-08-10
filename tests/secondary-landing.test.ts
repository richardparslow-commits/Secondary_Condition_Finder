import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import SecondaryLandingPage from "@/app/secondary/page";

describe("P0 Ticket 2: Secondary Landing Explainer & CTA Flow", () => {
  it("renders the required caused vs aggravated distinction and canonical legal references", () => {
    const html = renderToStaticMarkup(SecondaryLandingPage());

    expect(html).toContain("Caused By");
    expect(html).toContain("Aggravated By");
    expect(html).toContain("38 CFR § 3.310(a)");
    expect(html).toContain("38 CFR § 3.310(b)");
  });

  it("renders an obvious proceed CTA linking directly to Step 1", () => {
    const html = renderToStaticMarkup(SecondaryLandingPage());

    expect(html).toContain('href="/secondary/diagnosed"');
    expect(html).toContain("Click Here to Proceed to Wizard Step 1");
  });
});
