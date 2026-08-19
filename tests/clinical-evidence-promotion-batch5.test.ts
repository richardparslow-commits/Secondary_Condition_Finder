import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

function ids(path: string) {
  return (JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as { conditions: Array<{ id: string }> }).conditions.map((condition) => condition.id);
}

describe("clinical evidence promotion batch 5", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves 300/300", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("promotes Barrett's esophagus only as an adenocarcinoma-specific cancer progression pathway", () => {
    const mapping = byId.get("barretts-esophagus");
    const suggestion = mapping?.suggestions[0];
    const source = suggestion?.sourceReferences[0];

    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("esophageal-cancer");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["disease-progression"]);
    expect(suggestion?.rationale).toMatch(/adenocarcinoma/i);
    expect(suggestion?.rationale).toMatch(/squamous-cell|histolog/i);
    expect(source?.verificationScope).toBe("clinical-evidence");
    expect(source?.sourceUrl).toContain("41125322");
    expect(source?.citation).toMatch(/169\(6\):1184-1231/);
    expect(source?.verified).toBe(false);
  });

  it("promotes achalasia as a histology-aware esophageal-cancer risk pathway", () => {
    const mapping = byId.get("achalasia");
    const suggestion = mapping?.suggestions[0];
    const source = suggestion?.sourceReferences[0];

    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("esophageal-cancer");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["disease-progression"]);
    expect(suggestion?.rationale).toMatch(/squamous-cell/i);
    expect(suggestion?.rationale).toMatch(/not an automatic individual relationship/i);
    expect(source?.verificationScope).toBe("clinical-evidence");
    expect(source?.sourceUrl).toContain("37975607");
    expect(source?.citation).toMatch(/Am J Gastroenterol\. 2024;119\(4\):635-645/);
    expect(source?.sourceLocator).toMatch(/1,863.*7,452.*4\.6/i);
    expect(source?.verified).toBe(true);
    expect(source?.sourceCheckedOn).toBe("2026-08-18");
  });

  it("withdraws AL amyloidosis legal-only generic relationships", () => {
    const mapping = byId.get("al-amyloidosis");

    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/withdrawn|legal framework/i);
  });

  it("normalizes substance-use-disorder into mental-disorders maintenance", () => {
    const mental = ids("data/conditions/mental-disorders.json");
    const carry = ids("data/conditions/carried-over.json");

    expect(mental).toContain("substance-use-disorder");
    expect(carry).not.toContain("substance-use-disorder");
    expect(carry).toEqual(["contralateral-knee-condition"]);
  });

  it("distinguishes later qualified-human achalasia verification from the still-unverified Barrett source", () => {
    const barrett = byId.get("barretts-esophagus")?.suggestions[0]?.sourceReferences[0];
    expect(barrett?.verified).toBe(false);
    expect(barrett?.sourceCheckedOn).toBe("2026-08-14");
    const achalasia = byId.get("achalasia")?.suggestions[0]?.sourceReferences[0];
    expect(achalasia?.verified).toBe(true);
    expect(achalasia?.sourceCheckedOn).toBe("2026-08-18");
  });
});
