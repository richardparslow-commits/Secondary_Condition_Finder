import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { loadDisabilityReference } from "@/lib/va/disability-reference";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("VA Benefits Reference Data explorer", () => {
  it("keeps terms whose end date has not passed and drops retired ones", async () => {
    const result = await loadDisabilityReference(async () => ({
      success: true,
      source: "va-sandbox-api",
      data: {
        items: [
          { id: 2, name: "Migraine", endDateTime: null },
          { id: 1, name: "Asthma", endDateTime: null },
          { id: 3, name: "Retired term", endDateTime: "2020-01-01T00:00:00Z" },
          { id: 4, name: "Future term", endDateTime: "2999-01-01T00:00:00Z" },
        ],
      },
    }));

    expect(result.source).toBe("va-sandbox-api");
    expect(result.sourceLabel).toBe("VA sandbox reference");
    expect(result.items).toEqual([
      { id: "1", name: "Asthma" },
      { id: "4", name: "Future term" },
      { id: "2", name: "Migraine" },
    ]);
    expect(result.totalAvailable).toBe(3);
    expect(result.notice).toContain("not a diagnosis");
  });

  it("does not count retired terms in the current total", async () => {
    const result = await loadDisabilityReference(async () => ({
      success: true,
      source: "va-sandbox-api",
      data: {
        items: [
          { id: 1, name: "Asthma", endDateTime: null },
          { id: 2, name: "Retired term", endDateTime: "2020-01-01T00:00:00Z" },
        ],
        totalItems: 2,
        totalPages: 1,
      },
    }));

    expect(result.items).toEqual([{ id: "1", name: "Asthma" }]);
    expect(result.totalAvailable).toBe(1);
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
    expect(result.totalAvailable).toBe(result.items.length);
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

  it("keeps a long live list bounded instead of discarding it for the local fallback", async () => {
    const items = Array.from({ length: 250 }, (_, index) => ({
      id: index + 1,
      name: `Term ${String(index + 1).padStart(3, "0")}`,
      endDateTime: null,
    }));
    const result = await loadDisabilityReference(async () => ({
      success: true,
      source: "va-sandbox-api",
      data: { items, totalItems: 500, totalPages: 3 },
    }));

    expect(result.source).toBe("va-sandbox-api");
    expect(result.items).toHaveLength(200);
    expect(result.items[0]).toEqual({ id: "1", name: "Term 001" });
    expect(result.totalAvailable).toBe(500);
  });

  it("carries VA's total when only part of the reference list was read", async () => {
    const result = await loadDisabilityReference(async () => ({
      success: true,
      source: "va-sandbox-api",
      data: {
        items: [{ id: 1, name: "Asthma", endDateTime: null }],
        totalItems: 450,
        totalPages: 45,
      },
    }));

    expect(result.source).toBe("va-sandbox-api");
    expect(result.items).toHaveLength(1);
    expect(result.totalAvailable).toBe(450);
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
    // A bounded prefix must say so; the count of the full VA list is the only
    // way a reader can tell the loaded prefix is not the whole reference list.
    expect(client).toContain("totalAvailable");
    expect(client).toContain("VA publishes {totalAvailable}");
    expect(adapter).toContain('path: "/disabilities"');
  });
});
