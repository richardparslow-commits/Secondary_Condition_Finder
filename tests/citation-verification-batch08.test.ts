import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

describe("citation verification batch 08", () => {
  const byId = new Map(loadKnowledgeBase().map((mapping) => [mapping.id, mapping]));

  it("records qualified-human verification for the four approved Batch-8 verification sources", () => {
    const cases = [
      ["interstitial-lung-disease", "sleep-apnea", "33403599"],
      ["migraine-headaches", "depressive-disorder", "23588795"],
      ["osteitis-deformans", "osteoarthritis", "18504638"],
      ["ovarian-cancer", "peripheral-neuropathy", "24582486"],
    ] as const;

    for (const [primaryId, secondaryId, pmid] of cases) {
      const suggestion = byId.get(primaryId)?.suggestions.find(
        (entry) => entry.conditionId === secondaryId,
      );
      const source = suggestion?.sourceReferences[0];
      expect(source?.sourceUrl).toContain(pmid);
      expect(source?.verificationScope).toBe("clinical-evidence");
      expect(source?.verified).toBe(true);
      expect(source?.sourceCheckedOn).toBe("2026-08-18");
    }
  });

  it("narrows migraine-to-depression to temporal association before verification", () => {
    const suggestion = byId.get("migraine-headaches")?.suggestions[0];
    expect(suggestion?.conditionId).toBe("depressive-disorder");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/temporal-association research/i);
    expect(suggestion?.rationale).toMatch(/does not establish individual causation/i);
    expect(suggestion?.rationale).not.toMatch(/somatopsychic research/i);
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
  });

  it("holds the mTBI migraine-target source unverified after taxonomy narrowing", () => {
    const suggestion = byId.get("mild-tbi")?.suggestions[0];
    const source = suggestion?.sourceReferences[0];
    expect(suggestion?.conditionId).toBe("migraine-headaches");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/phenotype-oriented research flag/i);
    expect(suggestion?.rationale).toMatch(/post-traumatic headache/i);
    expect(suggestion?.rationale).toMatch(/does not by itself establish.*migraine diagnosis/i);
    expect(suggestion?.rationale).toMatch(/verification.*remains on hold/i);
    expect(source?.sourceUrl).toContain("38568491");
    expect(source?.sourceCheckedOn).toBe("2026-08-18");
    expect(source?.verified).toBe(false);
  });

  it("preserves the approved bounded pathways for Paget and ovarian-cancer treatment", () => {
    expect(
      byId.get("osteitis-deformans")?.suggestions[0]?.pathwayIntelligence?.pathways,
    ).toEqual(["biomechanical", "disease-progression"]);
    expect(
      byId.get("ovarian-cancer")?.suggestions[0]?.pathwayIntelligence?.pathways,
    ).toEqual(["treatment-complication"]);
    expect(
      byId.get("interstitial-lung-disease")?.suggestions[0]?.pathwayIntelligence,
    ).toBeUndefined();
  });
});
