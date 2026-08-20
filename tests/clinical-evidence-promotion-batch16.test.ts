import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

type RetirementLedger = {
  version: number;
  retirements: Array<{
    id: string;
    retiredFrom: { mappingId: string; conditionId: string; citation: string };
    citation: string;
    sourceUrl: string;
    sourceCheckedOn: string;
    sourceLocator: string;
    verificationScope: string;
    previouslyVerified: boolean;
    retiredOn: string;
    retirementReason: string;
    withdrawalEvidence: Array<{ sourceUrl: string; verificationStatus: string }>;
  }>;
};

describe("clinical evidence promotion batch 16", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));
  const retirements = JSON.parse(
    readFileSync(join(process.cwd(), "data/citation-retirements.json"), "utf8"),
  ) as RetirementLedger;

  it("preserves the frozen 302/302 universe", () => {
    expect(catalog).toHaveLength(302);
    expect(kb).toHaveLength(302);
  });

  it("withdraws the unsafe CHF-to-GERD NSAID pathway while retaining bounded depression research", () => {
    const mapping = byId.get("congestive-heart-failure");
    const suggestion = mapping?.suggestions[0];

    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("depressive-disorder");
    expect(suggestion?.rank).toBe(1);
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/32802590/");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(mapping?.suggestions.some((item) => item.conditionId === "gerd")).toBe(false);
  });

  it("preserves verified provenance for the Batch 16 retired NSAID source without leaving it live", () => {
    expect(retirements.version).toBe(1);

    const retirement = retirements.retirements.find(
      (item) => item.id === "batch-16-congestive-heart-failure-gerd-pmid-16918879",
    );
    expect(retirement).toBeDefined();
    expect(retirement?.retiredFrom).toMatchObject({
      mappingId: "congestive-heart-failure",
      conditionId: "gerd",
    });
    expect(retirement?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/16918879/");
    expect(retirement?.previouslyVerified).toBe(true);
    expect(retirement?.verificationScope).toBe("clinical-evidence");
    expect(retirement?.retirementReason).toMatch(/did not establish.*CHF-to-GERD|did not establish.*congestive heart failure/i);
    expect(retirement?.withdrawalEvidence[0]?.sourceUrl).toBe(
      "https://www.ahajournals.org/doi/10.1161/CIR.0000000000001063",
    );
    expect(retirement?.withdrawalEvidence[0]?.verificationStatus).toBe("source-checked-not-promoted");

    const chf = byId.get("congestive-heart-failure");
    const liveSources = (chf?.suggestions ?? []).flatMap((suggestion) => suggestion.sourceReferences);
    expect(liveSources.some((source) => source.sourceUrl === retirement?.sourceUrl)).toBe(false);
  });
});
