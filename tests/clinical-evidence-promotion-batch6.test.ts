import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("clinical evidence promotion batch 6", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));
  const catalogById = new Map(catalog.map((condition) => [condition.id, condition]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("promotes confirmed primary aldosteronism to a direct hypertension pathway", () => {
    const mapping = byId.get("hyperaldosteronism");
    const suggestion = mapping?.suggestions[0];
    const source = suggestion?.sourceReferences[0];

    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(suggestion?.conditionId).toBe("hypertension");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["direct-secondary"]);
    expect(suggestion?.rationale).toMatch(/primary aldosteronism/i);
    expect(suggestion?.rationale).toMatch(/sodium-retention|sodium retention/i);
    expect(suggestion?.rationale).toMatch(/broader catalog label|unspecified/i);
    expect(source?.verificationScope).toBe("clinical-evidence");
    expect(source?.sourceUrl).toContain("academic.oup.com/jcem/article/110/9/2453");
    expect(source?.citation).toMatch(/110\(9\):2453-2495/);
    expect(source?.verified).toBe(true);
    expect(source?.sourceCheckedOn).toBe("2026-08-18");
  });

  it("withdraws Addison disease's rating-only generic relationships", () => {
    const mapping = byId.get("addisons-disease");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/withdrawn|rating-schedule/i);
    expect(mapping?.todo.join(" ")).toMatch(/Addison/i);
  });

  it("narrows the hyperpituitarism display identity without changing its stable id or rating verification", () => {
    const condition = catalogById.get("hyperpituitarism");
    expect(condition?.id).toBe("hyperpituitarism");
    expect(condition?.name).toBe("Hyperpituitarism (Prolactin-Secreting Pituitary Dysfunction)");
    expect(condition?.aliases).toContain("prolactin-secreting pituitary dysfunction");
    expect(condition?.ratingSchedule[0]?.citation).toBe("38 CFR 4.119");
    expect(condition?.ratingSchedule[0]?.verified).toBe(false);
    expect(condition?.reviewNotes.join(" ")).toMatch(/DC 7916|diagnostic code 7916/i);
  });

  it("reflects later qualified-human verification of the bounded primary-aldosteronism source", () => {
    const source = byId.get("hyperaldosteronism")?.suggestions[0]?.sourceReferences[0];
    expect(source?.verified).toBe(true);
    expect(source?.sourceCheckedOn).toBe("2026-08-18");
    expect(source?.sourceLocator).toMatch(/common cause of hypertension/i);
  });
});
