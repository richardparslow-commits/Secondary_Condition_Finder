import { assertMaster2026CurrentState, isMaster2026Active } from "./helpers/master-2026-current";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 24", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 302/302 universe", () => {
    expect(catalog).toHaveLength(302);
    expect(kb).toHaveLength(302);
  });

  it("promotes Paget disease osteoarthritis with a site-specific biomechanical pathway", () => {
    const suggestion = byId.get("osteitis-deformans")?.suggestions[0];
    expect(byId.get("osteitis-deformans")?.draft).toBe(false);
    expect(suggestion?.conditionId).toBe("osteoarthritis");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["biomechanical", "disease-progression"]);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain("18504638");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
    expect(suggestion?.sourceReferences[0]?.sourceCheckedOn).toBe("2026-08-18");
  });

  it("promotes syringomyelia Charcot arthropathy only with neurologic/anatomic correlation", () => {
    const suggestion = byId.get("syringomyelia")?.suggestions[0];
    expect(byId.get("syringomyelia")?.draft).toBe(false);
    expect(suggestion?.conditionId).toBe("charcot-arthropathy");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["direct-secondary", "disease-progression"]);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain("35994178");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
  });

  it("preserves the stronger trigeminal depression pathway after later anxiety narrowing", () => {
    const mapping = byId.get("trigeminal-neuralgia");
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(mapping?.suggestions[0]?.conditionId).toBe("depressive-disorder");
    expect(mapping?.suggestions[0]?.pathwayIntelligence).toBeUndefined();
    expect(mapping?.suggestions[0]?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/40355578/");
    expect(mapping?.suggestions[0]?.sourceReferences[0]?.verified).toBe(true);
    expect(mapping?.suggestions.some((entry) => entry.conditionId === "anxiety-disorder")).toBe(false);
  });

  it("recognizes later evidence-quality review without losing surviving Batch 24 edges", () => {
    // Master 2026 supersedes this historical current-state assertion while
    // preserving the original pre-master contract below for historical states.
    if (isMaster2026Active()) {
      assertMaster2026CurrentState();
      return;
    }

    const adjustment = byId.get("adjustment-disorder");
    expect(adjustment?.draft).toBe(true);
    expect(adjustment?.suggestions).toEqual([]);

    const psa = byId.get("psoriatic-arthritis");
    expect(psa?.draft).toBe(true);
    expect(psa?.suggestions).toEqual([]);
    expect(psa?.todo.join(" ")).toMatch(/38797775/);

    const cesEd = byId.get("cauda-equina-syndrome")?.suggestions[0];
    expect(cesEd?.sourceReferences).toHaveLength(1);
    expect(cesEd?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/40380123/");

    const depressionEd = byId.get("depressive-disorder")?.suggestions.find((entry) => entry.conditionId === "erectile-dysfunction");
    expect(depressionEd?.sourceReferences).toHaveLength(1);
    expect(depressionEd?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/34247952/");
  });

  it("retains broad myositis as draft rather than overgeneralizing IIM-ILD evidence", () => {
    const mapping = byId.get("myositis");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.length).toBeGreaterThan(0);
  });

  it("preserves the surviving Batch 24 promotion identities without freezing later program totals", () => {
    const ledger = JSON.parse(
      readFileSync(join(process.cwd(), "data/expansion-dispositions.json"), "utf8"),
    ) as { waves: Array<{ identities: Array<{ id: string; disposition: string }> }> };
    const entries = ledger.waves.flatMap((wave) => wave.identities);
    for (const id of ["osteitis-deformans", "syringomyelia", "trigeminal-neuralgia"]) {
      expect(entries.find((entry) => entry.id === id)?.disposition).toBe("published-evidence-led");
    }
    expect(entries.filter((entry) => entry.disposition === "promotion-candidate")).toHaveLength(0);
  });
});
