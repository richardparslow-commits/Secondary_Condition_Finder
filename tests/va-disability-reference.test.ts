import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { loadDisabilityReference } from "@/lib/va/disability-reference";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("VA Benefits Reference Data explorer", () => {
  it("uses current, non-ended sandbox disability reference values", async () => {
    const result = await loadDisabilityReference(async () => ({
      success: true,
      source: "va-sandbox-api",
      data: {
        items: [
          { id: 2, name: "Migraine", endDateTime: null },
          { id: 1, name: "Asthma", endDateTime: null },
          { id: 3, name: "Retired term", endDateTime: "2020-01-01T00:00:00Z" },
        ],
      },
    }));

    expect(result.source).toBe("va-sandbox-api");
    expect(result.sourceLabel).toBe("VA sandbox reference");
    expect(result.items).toEqual([
      { id: "1", name: "Asthma" },
      { id: "2", name: "Migraine" },
    ]);
    expect(result.notice).toContain("not a diagnosis");
  });

  it("falls back to the local catalog when sandbox data is unavailable", async () => {
    const result = await loadDisabilityReference(async () => ({
      success: false,
      source: "local-fallback",
      data: null,
      error: "disabled",
    }));

    expect(result.source).toBe("local-fallback");
    expect(result.sourceLabel).toBe("Local catalog fallback");
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.notice).toContain("not from VA Benefits Reference Data");
  });

  it("falls back rather than showing an empty VA sandbox list", async () => {
    const result = await loadDisabilityReference(async () => ({
      success: true,
      source: "va-sandbox-api",
      data: { items: [] },
    }));

    expect(result.source).toBe("local-fallback");
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("keeps user filtering out of URLs and VA requests by contract", () => {
    const page = read("src/app/va-reference/page.tsx");
    const client = read("src/components/va/DisabilityReferenceExplorer.tsx");
    const adapter = read("src/lib/va/sandbox.ts");

    expect(page).not.toContain("searchParams");
    expect(page).not.toContain("URLSearchParams");
    expect(client).toContain('useState("")');
    expect(client).not.toContain("fetch(");
    expect(client).not.toContain("router.push");
    expect(adapter).toContain('path: "/disabilities"');
  });
});
