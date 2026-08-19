import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

describe("citation verification batch 05", () => {
  const byId = new Map(loadKnowledgeBase().map((mapping) => [mapping.id, mapping]));

  it("records qualified-human verification for all five reviewed Batch-5 references", () => {
    for (const [mappingId, conditionId, sourceNeedle] of [
      ["erectile-dysfunction", "depressive-disorder", "29960891"],
      ["femoroacetabular-impingement", "osteoarthritis", "26524551"],
      ["heart-valve-replacement-residuals", "anemia", "31039274"],
      ["hyperaldosteronism", "hypertension", "academic.oup.com/jcem/article/110/9/2453"],
      ["hyperparathyroidism", "kidney-stones", "36245251"],
    ] as const) {
      const suggestion = byId.get(mappingId)?.suggestions.find((entry) => entry.conditionId === conditionId);
      const source = suggestion?.sourceReferences.find((entry) =>
        `${entry.sourceUrl ?? ""} ${entry.citation ?? ""} ${entry.sourceLocator ?? ""}`.includes(sourceNeedle),
      );
      expect(source?.verificationScope).toBe("clinical-evidence");
      expect(source?.verified).toBe(true);
      expect(source?.sourceCheckedOn).toBe("2026-08-18");
    }
  });

  it("narrows ED-to-depression to association evidence without a directional pathway object", () => {
    const suggestion = byId.get("erectile-dysfunction")?.suggestions[0];
    expect(suggestion?.conditionId).toBe("depressive-disorder");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/bidirectional/i);
    expect(suggestion?.rationale).toMatch(/does not establish|causal direction/i);
    expect(suggestion?.rationale).toMatch(/chronology|treatment history|medication effects/i);
  });

  it("uses PMID 31039274 as the sole live valve-residuals anemia source", () => {
    const suggestion = byId.get("heart-valve-replacement-residuals")?.suggestions[0];
    expect(suggestion?.conditionId).toBe("anemia");
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/31039274/");
    expect(suggestion?.sourceReferences[0]?.citation).toMatch(/Alkhouli|31039274/i);
    expect(suggestion?.sourceReferences[0]?.sourceLocator).toMatch(/PMC6605004|paravalvular/i);
    expect(suggestion?.rationale).toMatch(/paravalvular/i);
    expect(suggestion?.rationale).toMatch(/hemol/i);
  });

  it("preserves the phenotype safeguards for the three verify-as-written relationships", () => {
    const fai = byId.get("femoroacetabular-impingement")?.suggestions[0];
    expect(fai?.pathwayIntelligence?.pathways).toEqual(["biomechanical", "disease-progression"]);
    expect(fai?.rationale).toMatch(/cam-type/i);
    expect(fai?.rationale).toMatch(/pincer/i);
    expect(fai?.rationale).toMatch(/same hip|same-hip/i);

    const aldosterone = byId.get("hyperaldosteronism")?.suggestions[0];
    expect(aldosterone?.pathwayIntelligence?.pathways).toEqual(["direct-secondary"]);
    expect(aldosterone?.rationale).toMatch(/confirmed primary aldosteronism/i);
    expect(aldosterone?.rationale).toMatch(/broader catalog label|unspecified/i);

    const parathyroid = byId.get("hyperparathyroidism")?.suggestions[0];
    expect(parathyroid?.pathwayIntelligence?.pathways).toEqual(["disease-progression"]);
    expect(parathyroid?.rationale).toMatch(/primary hyperparathyroidism/i);
    expect(parathyroid?.rationale).toMatch(/secondary and tertiary|secondary or tertiary/i);
  });
});
