import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

describe("citation verification batch 02", () => {
  const byId = new Map(loadKnowledgeBase().map((mapping) => [mapping.id, mapping]));

  it("records qualified-human verification for exactly the five reviewed Batch-2 sources", () => {
    for (const [mappingId, conditionId, pmid] of [
      ["asthma", "sleep-apnea", "40774162"],
      ["barretts-esophagus", "esophageal-cancer", "41125322"],
      ["cardiomyopathy", "congestive-heart-failure", "37622657"],
      ["cauda-equina-syndrome", "erectile-dysfunction", "40380123"],
      ["chronic-liver-disease", "cirrhosis-of-the-liver", "32108989"],
    ] as const) {
      const suggestion = byId.get(mappingId)?.suggestions.find((entry) => entry.conditionId === conditionId);
      const source = suggestion?.sourceReferences.find((entry) => entry.sourceUrl?.includes(pmid));
      expect(source?.verificationScope).toBe("clinical-evidence");
      expect(source?.verified).toBe(true);
      expect(source?.sourceCheckedOn).toBe("2026-08-18");
    }
  });

  it("preserves the narrowed uncertainty boundary for asthma to OSA", () => {
    const suggestion = byId.get("asthma")?.suggestions.find((entry) => entry.conditionId === "sleep-apnea");
    const source = suggestion?.sourceReferences[0];
    expect(suggestion?.rationale).toMatch(/pooled association.*imprecise/i);
    expect(suggestion?.rationale).toMatch(/did not clearly exclude no association/i);
    expect(suggestion?.rationale).toMatch(/moderate-to-severe asthma.*limited.*imprecise/i);
    expect(source?.sourceLocator).toMatch(/OR 1\.4.*0\.9-2\.2/i);
    expect(source?.sourceLocator).toMatch(/OR 10\.1.*1\.3-81\.7/i);
  });

  it("preserves the narrowed population and etiology boundary for CES to erectile dysfunction", () => {
    const suggestion = byId.get("cauda-equina-syndrome")?.suggestions.find((entry) => entry.conditionId === "erectile-dysfunction");
    const source = suggestion?.sourceReferences[0];
    expect(suggestion?.rationale).toMatch(/surgically treated.*lumbar disc herniation/i);
    expect(suggestion?.rationale).toMatch(/compatible CES etiology/i);
    expect(suggestion?.rationale).toMatch(/not be generalized automatically to every CES etiology/i);
    expect(source?.note).toMatch(/lumbar disc herniation\/CES populations/i);
    expect(source?.sourceLocator).toMatch(/20 eligible studies/i);
  });
});
