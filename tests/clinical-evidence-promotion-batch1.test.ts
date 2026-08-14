import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

function readJson(path: string) {
  return JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as {
    bodySystem?: string;
    conditions?: Array<{ id: string }>;
  };
}

describe("clinical evidence promotion batch 1", () => {
  const catalog = loadConditionCatalog();
  const knowledgeBase = loadKnowledgeBase();
  const catalogById = new Map(catalog.map((condition) => [condition.id, condition]));
  const mappingById = new Map(knowledgeBase.map((mapping) => [mapping.id, mapping]));

  it("preserves the target-v2 300/300 identity contract", () => {
    expect(catalog).toHaveLength(300);
    expect(knowledgeBase).toHaveLength(300);
  });

  it("publishes only the reviewed cardiomyopathy heart-failure relationship", () => {
    const mapping = mappingById.get("cardiomyopathy");

    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(mapping?.suggestions[0]?.conditionId).toBe("congestive-heart-failure");
    expect(mapping?.suggestions[0]?.pathwayIntelligence?.pathways).toContain("disease-progression");
    expect(mapping?.suggestions[0]?.rationale).toMatch(/does not by itself establish an individual nexus/i);

    const reference = mapping?.suggestions[0]?.sourceReferences[0];
    expect(reference?.verificationScope).toBe("clinical-evidence");
    expect(reference?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/37622657/");
    expect(reference?.sourceCheckedOn).toBe("2026-08-14");
    expect(reference?.sourceLocator).toMatch(/37622657|6\.10\.2|7\.2\.3/i);
    expect(reference?.verified).toBe(false);
  });

  it("publishes only the reviewed urethral-stricture hydronephrosis relationship", () => {
    const mapping = mappingById.get("urethral-stricture");

    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(mapping?.suggestions[0]?.conditionId).toBe("hydronephrosis");
    expect(mapping?.suggestions[0]?.prevalence).toBe("occasionally-explored");
    expect(mapping?.suggestions[0]?.pathwayIntelligence?.pathways).toContain("intermediate-chain");
    expect(mapping?.suggestions[0]?.rationale).toMatch(/other causes of hydronephrosis/i);

    const reference = mapping?.suggestions[0]?.sourceReferences[0];
    expect(reference?.verificationScope).toBe("clinical-evidence");
    expect(reference?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/8571802/");
    expect(reference?.sourceCheckedOn).toBe("2026-08-14");
    expect(reference?.sourceLocator).toMatch(/8571802|ureterohydronephrosis/i);
    expect(reference?.verified).toBe(false);
  });

  it("withdraws unsupported ankle-strain suggestions back to draft", () => {
    const mapping = mappingById.get("ankle-strain");

    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/altered lower-extremity biomechanics/i);
    expect(mapping?.todo.join(" ")).toMatch(/contralateral-knee.*placeholder/i);
  });

  it("preserves fibromyalgia in musculoskeletal catalog maintenance as later maintenance expands", () => {
    const hemic = readJson("data/conditions/hemic-lymphatic-immune.json");
    const maintenance = readJson("data/conditions/musculoskeletal-quality-maintenance.json");
    const fibromyalgia = catalogById.get("fibromyalgia");
    const maintenanceIds = maintenance.conditions?.map((condition) => condition.id) ?? [];

    expect(hemic.conditions?.some((condition) => condition.id === "fibromyalgia")).toBe(false);
    expect(maintenance.bodySystem).toBe("Musculoskeletal System");
    expect(maintenanceIds).toContain("fibromyalgia");
    expect(new Set(maintenanceIds).size).toBe(maintenanceIds.length);
    expect(fibromyalgia?.bodySystem).toBe("Musculoskeletal System");
    expect(fibromyalgia?.ratingSchedule[0]?.citation).toBe("38 CFR 4.71a");
    expect(fibromyalgia?.ratingSchedule[0]?.note).toMatch(/5025/i);
  });

  it("does not automate qualified-human citation verification", () => {
    for (const id of ["cardiomyopathy", "urethral-stricture"] as const) {
      const mapping = mappingById.get(id);
      for (const suggestion of mapping?.suggestions ?? []) {
        expect(suggestion.sourceReferences.every((reference) => reference.verified === false)).toBe(true);
        expect(suggestion.sourceReferences.every((reference) => reference.sourceCheckedOn === "2026-08-14")).toBe(true);
      }
    }
  });
});
