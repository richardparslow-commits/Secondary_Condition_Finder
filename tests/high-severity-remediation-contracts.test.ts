import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("high-severity remediation contracts", () => {
  it("keeps partial presumptive dates visible and explicitly unconfirmed", () => {
    const resultsPage = read("src/app/presumptive/results/page.tsx");
    // PRIV-01 follow-on (2026-10-08): the results page no longer reads the
    // session, so the partial-date copy moved into the browser-local view that
    // renders the confirmed history. The contract tracks whichever layer
    // actually renders the strings — the page must still reach that view.
    const resultsView = read("src/components/presumptive/PresumptiveResults.tsx");
    const matcher = read("src/lib/presumptive/match.ts");

    expect(resultsPage).toContain("PresumptiveResults");
    expect(resultsView).toContain("start date");
    expect(resultsView).toContain("end date not provided");
    expect(resultsView).toContain("start date not provided");
    expect(resultsView).toContain("Service date range incomplete");
    expect(resultsView).toContain("date range unconfirmed");
    expect(matcher).toContain("partialRangeMayOverlap");
    expect(matcher).toContain("history.serviceStart && history.serviceEnd");
    expect(matcher).not.toContain("history.serviceStart ?? history.serviceEnd!");
    expect(matcher).not.toContain("history.serviceEnd ?? history.serviceStart!");
  });

  it("gates main-push CI on exact merged-PR lineage", () => {
    const workflow = read(".github/workflows/ci.yml");

    expect(workflow).toContain("pull-requests: read");
    expect(workflow).toContain("Verify main commit came through a merged PR");
    expect(workflow).toContain("/commits/${sha}/pulls");
    expect(workflow).toContain('pull?.base?.ref === "main"');
    expect(workflow).toContain("pull?.merge_commit_sha === sha");
    expect(workflow).toContain("steps.governance.outcome");
    expect(workflow).toContain("Direct pushes to main do not satisfy");
  });
});
