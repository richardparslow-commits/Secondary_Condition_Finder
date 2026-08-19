import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

describe("citation verification batch 03", () => {
  const byId = new Map(loadKnowledgeBase().map((mapping) => [mapping.id, mapping]));

  it("records qualified-human verification for the five reviewed Batch-3 sources", () => {
    for (const [mappingId, conditionId, pmid] of [
      ["chronic-pyelonephritis", "chronic-kidney-disease", "11110586"],
      ["chronic-rhinitis", "sleep-apnea", "40774162"],
      ["chronic-sinusitis", "sleep-apnea", "41969980"],
      ["copd", "sleep-apnea", "36672523"],
      ["cushings-syndrome", "hypertension", "35950979"],
    ] as const) {
      const suggestion = byId.get(mappingId)?.suggestions.find((entry) => entry.conditionId === conditionId);
      const source = suggestion?.sourceReferences.find((entry) => entry.sourceUrl?.includes(pmid));
      expect(source?.verificationScope).toBe("clinical-evidence");
      expect(source?.verified).toBe(true);
      expect(source?.sourceCheckedOn).toBe("2026-08-18");
    }
  });

  it("keeps chronic-rhinitis evidence limited to a documented allergic-rhinitis phenotype", () => {
    const suggestion = byId.get("chronic-rhinitis")?.suggestions[0];
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/allergic-rhinitis phenotype|allergic rhinitis/i);
    expect(suggestion?.rationale).toMatch(/association/i);
  });

  it("keeps chronic-rhinosinusitis evidence association-focused despite the MR signal", () => {
    const suggestion = byId.get("chronic-sinusitis")?.suggestions[0];
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/association/i);
    expect(suggestion?.rationale).toMatch(/Mendelian|genetic/i);
  });

  it("removes unsupported directional COPD-to-OSA pathway labels while preserving overlap evidence", () => {
    const suggestion = byId.get("copd")?.suggestions.find((entry) => entry.conditionId === "sleep-apnea");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/coexist|overlap/i);
    expect(suggestion?.rationale).toMatch(/does not by itself establish.*caused or aggravated/i);
    expect(suggestion?.sourceReferences[0]?.note).toMatch(/38 observational studies.*27,064/i);
  });
});
