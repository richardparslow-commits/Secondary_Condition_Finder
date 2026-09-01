import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

describe("citation verification batch 04", () => {
  const byId = new Map(loadKnowledgeBase().map((mapping) => [mapping.id, mapping]));

  it("records qualified-human verification for all five reviewed references, including three independent depressive-disorder findings", () => {
    for (const [mappingId, conditionId, pmid] of [
      ["depressive-disorder", "sleep-apnea", "31524318"],
      ["depressive-disorder", "sleep-apnea", "40330547"],
      ["depressive-disorder", "erectile-dysfunction", "34247952"],
      ["diabetes-mellitus-type-1", "chronic-kidney-disease", "41358881"],
      ["discoid-lupus", "scarring-alopecia", "35817588"],
    ] as const) {
      const suggestion = byId.get(mappingId)?.suggestions.find((entry) => entry.conditionId === conditionId);
      const source = suggestion?.sourceReferences.find((entry) => entry.sourceUrl?.includes(pmid));
      expect(source?.verificationScope).toBe("clinical-evidence");
      expect(source?.verified).toBe(true);
      expect(source?.sourceCheckedOn).toBe("2026-08-18");
    }
  });

  it("keeps the depressive-disorder OSA pathway as a link-by-link intermediate chain rather than one-source causation", () => {
    const osa = byId.get("depressive-disorder")?.suggestions.find((entry) => entry.conditionId === "sleep-apnea");
    expect(osa?.pathwayIntelligence?.pathways).toEqual(["medication-related", "intermediate-chain"]);
    expect(osa?.sourceReferences).toHaveLength(2);
    expect(osa?.sourceReferences.map((source) => source.sourceUrl)).toEqual([
      "https://pubmed.ncbi.nlm.nih.gov/31524318/",
      "https://pubmed.ncbi.nlm.nih.gov/40330547/",
    ]);
    expect(osa?.rationale).toMatch(/particular veteran|individual medication|weight trajectory|alternative OSA risk factors/i);
  });

  it("preserves agent-specific and competing-cause safeguards for depressive-disorder treatment to erectile dysfunction", () => {
    const ed = byId.get("depressive-disorder")?.suggestions.find((entry) => entry.conditionId === "erectile-dysfunction");
    expect(ed?.pathwayIntelligence?.pathways).toEqual(["medication-related"]);
    expect(ed?.rationale).toMatch(/drug classes|individual agents/i);
    expect(ed?.rationale).toMatch(/vascular|endocrine|neurologic|psychiatric/i);
  });

  it("preserves bounded disease-progression requirements for type-1-diabetes CKD and scalp-DLE scarring alopecia", () => {
    const ckd = byId.get("diabetes-mellitus-type-1")?.suggestions[0];
    expect(ckd?.pathwayIntelligence?.pathways).toEqual(["disease-progression"]);
    expect(ckd?.rationale).toMatch(/5 years|longstanding/i);
    expect(ckd?.rationale).toMatch(/alternative kidney disease|atypical/i);

    const alopecia = byId.get("discoid-lupus")?.suggestions[0];
    expect(alopecia?.pathwayIntelligence?.pathways).toEqual(["disease-progression"]);
    expect(alopecia?.rationale).toMatch(/scalp/i);
    expect(alopecia?.rationale).toMatch(/cicatricial|scarring/i);
    expect(alopecia?.rationale).toMatch(/nonscarring|alopecia areata/i);
  });
});
