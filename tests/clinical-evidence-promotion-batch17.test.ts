import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

type RetirementLedger = {
  retirements: Array<{
    id: string;
    retiredFrom: { mappingId: string; conditionId: string };
    sourceUrl: string;
    verificationScope: string;
    previouslyVerified: boolean;
  }>;
};

describe("clinical evidence promotion batch 17", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));
  const retirements = JSON.parse(
    readFileSync(join(process.cwd(), "data/citation-retirements.json"), "utf8"),
  ) as RetirementLedger;

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("withdraws unsupported GERD edges from stomach cancer and abdominal hernia", () => {
    for (const id of ["stomach-cancer", "abdominal-hernia"]) {
      const mapping = byId.get(id);
      expect(mapping?.draft).toBe(false);
      expect(mapping?.todo).toEqual([]);
      expect(mapping?.suggestions).toHaveLength(1);
      expect(mapping?.suggestions[0]?.conditionId).toBe("depressive-disorder");
      expect(mapping?.suggestions.some((suggestion) => suggestion.conditionId === "gerd")).toBe(false);
    }
  });

  it("repairs rheumatoid-arthritis GERD with RA-treatment, RA-GERD, and NSAID-GERD evidence", () => {
    const mapping = byId.get("rheumatoid-arthritis");
    const gerd = mapping?.suggestions.find((suggestion) => suggestion.conditionId === "gerd");
    const clinical = (gerd?.sourceReferences ?? []).filter(
      (source) => source.verificationScope === "clinical-evidence",
    );

    expect(mapping?.suggestions.map((suggestion) => suggestion.conditionId)).toEqual([
      "depressive-disorder",
      "gerd",
    ]);
    expect(gerd?.pathwayIntelligence?.pathways).toEqual(["medication-related"]);
    expect(clinical).toHaveLength(3);
    expect(clinical.every((source) => source.verified === false)).toBe(true);
    expect(clinical.map((source) => source.sourceUrl)).toEqual([
      "https://pubmed.ncbi.nlm.nih.gov/33674957/",
      "https://pubmed.ncbi.nlm.nih.gov/24252041/",
      "https://pubmed.ncbi.nlm.nih.gov/18671778/",
    ]);
    expect(gerd?.sourceReferences.some((source) => source.sourceUrl === "https://pubmed.ncbi.nlm.nih.gov/16918879/")).toBe(false);
    expect(gerd?.sourceReferences.some((source) => source.verificationScope === "legal-framework" && source.verified === true)).toBe(true);
  });

  it("records all Batch-17 verified-source retirements explicitly", () => {
    const ids = new Set(retirements.retirements.map((retirement) => retirement.id));
    for (const id of [
      "batch-17-stomach-cancer-gerd-pmid-16918879",
      "batch-17-stomach-cancer-gerd-38-cfr-3-310",
      "batch-17-abdominal-hernia-gerd-pmid-16918879",
      "batch-17-abdominal-hernia-gerd-38-cfr-3-310",
      "batch-17-rheumatoid-arthritis-gerd-pmid-16918879",
    ]) {
      expect(ids.has(id), `missing retirement ${id}`).toBe(true);
    }

    expect(retirements.retirements.every((retirement) => retirement.previouslyVerified === true)).toBe(true);
    expect(
      retirements.retirements.filter((retirement) => retirement.verificationScope === "clinical-evidence"),
    ).toHaveLength(4);
  });

  it("keeps the unverified review-debt exchange clinical-only on the targeted published relationships", () => {
    const adjustment = byId.get("adjustment-disorder");
    for (const conditionId of ["sleep-apnea", "gerd"]) {
      const suggestion = adjustment?.suggestions.find((item) => item.conditionId === conditionId);
      expect(suggestion?.sourceReferences.some((source) => source.verificationScope === "legal-framework")).toBe(false);
      expect(suggestion?.sourceReferences.some((source) => source.verificationScope === "clinical-evidence")).toBe(true);
    }

    const depressive = byId.get("depressive-disorder");
    const osa = depressive?.suggestions.find((item) => item.conditionId === "sleep-apnea");
    expect(osa?.sourceReferences.some((source) => source.verificationScope === "legal-framework")).toBe(false);
    expect(osa?.sourceReferences.filter((source) => source.verificationScope === "clinical-evidence")).toHaveLength(2);
  });
});
