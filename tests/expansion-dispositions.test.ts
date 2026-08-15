import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

type Disposition = "published-evidence-led" | "promotion-candidate" | "safe-draft";
type Ledger = {
  totalIdentities: number;
  waves: Array<{ wave: number; identities: Array<{ id: string; disposition: Disposition }> }>;
};

describe("target-v2 expansion disposition ledger", () => {
  const ledger = JSON.parse(
    readFileSync(join(process.cwd(), "data/expansion-dispositions.json"), "utf8"),
  ) as Ledger;
  const kb = new Map(loadKnowledgeBase().map((mapping) => [mapping.id, mapping]));
  const entries = ledger.waves.flatMap((wave) => wave.identities.map((entry) => ({ ...entry, wave: wave.wave })));

  it("accounts for exactly 107 unique Wave 1-7 identities", () => {
    expect(ledger.totalIdentities).toBe(107);
    expect(entries).toHaveLength(107);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(107);
    expect(new Set(entries.map((entry) => entry.wave))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7]));
  });

  it("does not count Type 1 diabetes as a Wave 1-7 expansion identity", () => {
    expect(entries.some((entry) => entry.id === "diabetes-mellitus-type-1")).toBe(false);
  });

  it("matches every disposition to the current KB publication state", () => {
    for (const entry of entries) {
      const mapping = kb.get(entry.id);
      expect(mapping, `missing KB mapping for ${entry.id}`).toBeDefined();
      if (entry.disposition === "published-evidence-led") {
        expect(mapping?.draft, `${entry.id} should be published`).toBe(false);
        expect(mapping?.suggestions.length).toBeGreaterThan(0);
      } else {
        expect(mapping?.draft, `${entry.id} should remain draft`).toBe(true);
        expect(mapping?.suggestions).toEqual([]);
        expect(mapping?.todo.length).toBeGreaterThan(0);
      }
    }
  });

  it("records the current roadmap-backed program totals", () => {
    const published = entries.filter((entry) => entry.disposition === "published-evidence-led");
    const candidates = entries.filter((entry) => entry.disposition === "promotion-candidate");
    const safeDrafts = entries.filter((entry) => entry.disposition === "safe-draft");

    expect(published).toHaveLength(18);
    expect(candidates.map((entry) => entry.id).sort()).toEqual([
      "gout",
      "myasthenia-gravis",
      "trigeminal-neuralgia",
    ]);
    expect(candidates).toHaveLength(3);
    expect(safeDrafts).toHaveLength(86);
    expect(published.length + candidates.length + safeDrafts.length).toBe(107);
  });
});
