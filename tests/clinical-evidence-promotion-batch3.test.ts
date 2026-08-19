import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

function conditionIds(path: string): string[] {
  const parsed = JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as {
    conditions: Array<{ id: string }>;
  };
  return parsed.conditions.map((condition) => condition.id);
}

describe("clinical evidence promotion batch 3", () => {
  const catalog = loadConditionCatalog();
  const knowledgeBase = loadKnowledgeBase();
  const mappingById = new Map(knowledgeBase.map((mapping) => [mapping.id, mapping]));
  const catalogById = new Map(catalog.map((condition) => [condition.id, condition]));

  it("preserves the target-v2 300/300 identity contract", () => {
    expect(catalog).toHaveLength(300);
    expect(knowledgeBase).toHaveLength(300);
  });

  it("publishes chronic liver disease to cirrhosis only as documented fibrosis progression", () => {
    const mapping = mappingById.get("chronic-liver-disease");
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    const suggestion = mapping?.suggestions[0];
    expect(suggestion?.conditionId).toBe("cirrhosis-of-the-liver");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["disease-progression"]);
    expect(suggestion?.rationale).toMatch(/fibrosis/i);
    expect(suggestion?.rationale).toMatch(/umbrella|etiology/i);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/32108989/");
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
    expect(suggestion?.sourceReferences[0]?.sourceCheckedOn).toBe("2026-08-18");
  });

  it("repairs the amputation depression relationship with clinical evidence", () => {
    const mapping = mappingById.get("amputation-or-loss-of-use");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(suggestion?.conditionId).toBe("depressive-disorder");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["somatopsychic"]);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/25294119/");
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(suggestion?.sourceReferences.some((reference) => reference.citation === "38 CFR 3.310")).toBe(false);
  });

  it("withdraws ageusia relationships that had only legal-framework support", () => {
    const mapping = mappingById.get("ageusia");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/withdrawn|clinical evidence|legal framework/i);
  });

  it("physically relocates insomnia into the mental-disorders catalog", () => {
    expect(conditionIds("data/conditions/carried-over.json")).not.toContain("insomnia");
    expect(conditionIds("data/conditions/mental-disorders.json")).toContain("insomnia");
    const insomnia = catalogById.get("insomnia");
    expect(insomnia?.bodySystem).toBe("Mental Disorders");
    expect(insomnia?.ratingSchedule[0]?.citation).toBe("38 CFR 4.130");
    expect(insomnia?.ratingSchedule[0]?.verified).toBe(false);
  });

  it("preserves source-check provenance after later qualified-human verification batches", () => {
    const chronicLiver = mappingById.get("chronic-liver-disease")?.suggestions[0]?.sourceReferences[0];
    expect(chronicLiver?.verified).toBe(true);
    expect(chronicLiver?.sourceCheckedOn).toBe("2026-08-18");
    expect(chronicLiver?.verificationScope).toBe("clinical-evidence");

    const amputation = mappingById.get("amputation-or-loss-of-use")?.suggestions[0]?.sourceReferences[0];
    expect(amputation?.verified).toBe(true);
    expect(amputation?.sourceCheckedOn).toBe("2026-08-18");
    expect(amputation?.verificationScope).toBe("clinical-evidence");
  });
});
