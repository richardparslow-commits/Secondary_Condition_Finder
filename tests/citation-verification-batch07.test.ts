import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

describe("citation verification batch 07", () => {
  const byId = new Map(loadKnowledgeBase().map((mapping) => [mapping.id, mapping]));

  it("records qualified-human verification for all five Batch-7 sources", () => {
    const cases = [
      ["hypertensive-heart-disease", "congestive-heart-failure", "36082670"],
      ["hypogonadism", "osteoporosis", "29499097"],
      ["hypoparathyroidism", "kidney-stones", "36375810"],
      ["implantable-cardiac-pacemaker", "heart-valve-disorders", "34389210"],
      ["insomnia", "depressive-disorder", "38833937"],
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

  it("preserves the four verify-as-written pathway boundaries", () => {
    expect(
      byId.get("hypertensive-heart-disease")?.suggestions[0]?.pathwayIntelligence?.pathways,
    ).toEqual(["disease-progression"]);
    expect(
      byId.get("hypogonadism")?.suggestions[0]?.pathwayIntelligence?.pathways,
    ).toEqual(["disease-progression"]);
    expect(
      byId.get("hypoparathyroidism")?.suggestions[0]?.pathwayIntelligence,
    ).toBeUndefined();
    expect(
      byId.get("implantable-cardiac-pacemaker")?.suggestions[0]?.pathwayIntelligence?.pathways,
    ).toEqual(["treatment-complication"]);
  });

  it("narrows insomnia-to-depression to temporal association before verification", () => {
    const suggestion = byId.get("insomnia")?.suggestions.find(
      (entry) => entry.conditionId === "depressive-disorder",
    );
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/temporal-association research/i);
    expect(suggestion?.rationale).toMatch(/does not establish individual causation/i);
    expect(suggestion?.rationale).not.toMatch(/direct-secondary research/i);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain("38833937");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
  });

  it("retains insomnia chronology, competing-cause, and clinician-review safeguards", () => {
    const suggestion = byId.get("insomnia")?.suggestions[0];
    const gaps = suggestion?.evidenceGaps.join(" ") ?? "";
    expect(gaps).toMatch(/independent insomnia diagnosis|insomnia diagnosis/i);
    expect(gaps).toMatch(/chronology/i);
    expect(gaps).toMatch(/psychiatric|sleep apnea|pain|medications|substance/i);
    expect(gaps).toMatch(/Qualified medical|mental-health opinion|causation or aggravation/i);
  });
});
