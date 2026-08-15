import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 23", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("removes two lower-value review-debt rows without weakening clinical support", () => {
    const adjustment = byId.get("adjustment-disorder");
    expect(adjustment?.draft).toBe(false);
    expect(adjustment?.suggestions.map((entry) => entry.conditionId)).toEqual(["sleep-apnea", "gerd"]);
    expect(adjustment?.suggestions.every((entry) =>
      entry.sourceReferences.some((source) => source.verificationScope === "clinical-evidence"),
    )).toBe(true);

    const depression = byId.get("depressive-disorder");
    const ed = depression?.suggestions.find((entry) => entry.conditionId === "erectile-dysfunction");
    expect(ed?.sourceReferences.filter((source) => source.verificationScope === "clinical-evidence")).toHaveLength(2);
    expect(ed?.sourceReferences.some((source) => source.verificationScope === "legal-framework")).toBe(false);
  });

  it("promotes gout depression only as association/comorbidity research", () => {
    const mapping = byId.get("gout");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("depressive-disorder");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/association|population/i);
    expect(suggestion?.rationale).toMatch(/1\.29/);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain("32115430");
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
  });

  it("promotes myasthenia-gravis depression only as association/comorbidity research", () => {
    const mapping = byId.get("myasthenia-gravis");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("depressive-disorder");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/comorbidity|prevalence/i);
    expect(suggestion?.rationale).toMatch(/36%/);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain("36495116");
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
  });

  it("closes the final promotion-candidate queue while retaining 87 safe drafts", () => {
    const ledger = JSON.parse(
      readFileSync(join(process.cwd(), "data/expansion-dispositions.json"), "utf8"),
    ) as { waves: Array<{ identities: Array<{ disposition: string }> }> };
    const entries = ledger.waves.flatMap((wave) => wave.identities);
    expect(entries.filter((entry) => entry.disposition === "published-evidence-led")).toHaveLength(20);
    expect(entries.filter((entry) => entry.disposition === "promotion-candidate")).toHaveLength(0);
    expect(entries.filter((entry) => entry.disposition === "safe-draft")).toHaveLength(87);
  });
});
