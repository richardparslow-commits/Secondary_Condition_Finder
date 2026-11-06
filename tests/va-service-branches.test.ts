import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadServiceBranchReference } from "@/lib/va/service-branches";

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("service branch reference pagination", () => {
  it("keeps a partial list visible and marks it incomplete", async () => {
    const view = await loadServiceBranchReference(async () => ({
      success: true,
      source: "va-sandbox-api",
      incomplete: true,
      data: {
        items: [{ code: "ARMY", description: "Army" }],
        totalItems: 12,
        totalPages: 2,
      },
    }));

    expect(view.items).toEqual([{ code: "ARMY", description: "Army" }]);
    expect(view.incomplete).toBe(true);
  });

  it("discloses an incomplete list on the service-branch page", () => {
    const page = readSource("src/app/va-reference/service-branches/page.tsx");

    expect(page).toContain("reference.incomplete === true");
    expect(page).toContain("could not be fully loaded");
    expect(page).toContain("partial list");
  });
});
