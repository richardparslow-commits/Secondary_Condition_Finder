import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TermsPage from "@/app/terms/page";

describe("public Terms VA runtime boundary", () => {
  it("describes the environment-aware adapter and separate connectivity gates", async () => {
    const html = renderToStaticMarkup(await TermsPage());

    expect(html).toContain("environment-aware VA public-reference adapter is disabled by default");
    expect(html).toContain("credentialed sandbox connectivity and future production connectivity remain separate external gates");
    expect(html).toContain("must not be treated as live VA connectivity until objectively verified");
    expect(html).not.toContain("VA sandbox integration is disabled by default and must not be treated as live VA production connectivity");
  });
});
