import { describe, expect, it } from "vitest";

import { indexById } from "@/lib/catalog/lookup";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { buildEvidenceConditionTerms } from "@/lib/evidence/condition-terms";

describe("browser-local evidence condition terms", () => {
  const byId = indexById(loadConditionCatalog());

  function termsFor(...ids: string[]): string[] {
    const conditions = ids.flatMap((id) => {
      const condition = byId.get(id);
      return condition ? [condition] : [];
    });
    return buildEvidenceConditionTerms(conditions);
  }

  it("includes canonical names and common clinical aliases for selected conditions", () => {
    const terms = termsFor("sleep-apnea", "ptsd", "gerd");

    expect(terms).toContain("Sleep Apnea (Obstructive, Central, Mixed)");
    expect(terms).toContain("obstructive sleep apnea");
    expect(terms).toContain("osa");
    expect(terms).toContain("Post-Traumatic Stress Disorder (PTSD)");
    expect(terms).toContain("ptsd");
    expect(terms).toContain("Gastroesophageal Reflux Disease (GERD)");
    expect(terms).toContain("gerd");
  });

  it("does not use generic sleep-apnea modifiers as standalone evidence terms", () => {
    const terms = termsFor("sleep-apnea");

    expect(terms).not.toContain("obstructive");
    expect(terms).not.toContain("central");
    expect(terms).not.toContain("mixed");
    expect(terms).toContain("obstructive sleep apnea");
    expect(terms).toContain("central sleep apnea");
    expect(terms).toContain("mixed sleep apnea");
  });

  it("deduplicates aliases case-insensitively while preserving authored spelling", () => {
    const terms = buildEvidenceConditionTerms([
      {
        id: "example",
        name: "Example Condition",
        aliases: ["example condition", "EXAMPLE", "example"],
        bodySystem: "Test",
        ratingSchedule: [],
        reviewNotes: [],
      },
    ]);

    expect(terms).toEqual(["Example Condition", "EXAMPLE"]);
  });
});
