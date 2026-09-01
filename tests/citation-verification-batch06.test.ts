import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

describe("citation verification batch 06", () => {
  const byId = new Map(loadKnowledgeBase().map((mapping) => [mapping.id, mapping]));

  it("records qualified-human verification for all five reviewed Batch-6 references", () => {
    const hyperpituitarism = byId.get("hyperpituitarism")?.suggestions.find(
      (entry) => entry.conditionId === "hypogonadism",
    );
    expect(hyperpituitarism?.sourceReferences[0]?.sourceUrl).toBe(
      "https://pubmed.ncbi.nlm.nih.gov/40812946/",
    );
    expect(hyperpituitarism?.sourceReferences[0]?.verified).toBe(true);
    expect(hyperpituitarism?.sourceReferences[0]?.sourceCheckedOn).toBe("2026-08-18");

    const hypertension = byId.get("hypertension");
    for (const conditionId of [
      "chronic-kidney-disease",
      "ischemic-heart-disease",
      "congestive-heart-failure",
      "erectile-dysfunction",
    ]) {
      const suggestion = hypertension?.suggestions.find((entry) => entry.conditionId === conditionId);
      expect(suggestion?.sourceReferences).toHaveLength(1);
      expect(suggestion?.sourceReferences[0]?.sourceUrl).toBe(
        "https://pubmed.ncbi.nlm.nih.gov/40811497/",
      );
      expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
      expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
      expect(suggestion?.sourceReferences[0]?.sourceCheckedOn).toBe("2026-08-18");
    }
  });

  it("preserves the bounded prolactinoma and hypertension disease-progression safeguards", () => {
    const prolactinoma = byId.get("hyperpituitarism")?.suggestions[0];
    expect(prolactinoma?.pathwayIntelligence?.pathways).toEqual([
      "direct-secondary",
      "intermediate-chain",
    ]);
    expect(prolactinoma?.rationale).toMatch(/prolactin/i);
    expect(prolactinoma?.rationale).toMatch(/unrelated forms|generaliz/i);

    const hypertension = byId.get("hypertension");
    for (const conditionId of [
      "chronic-kidney-disease",
      "ischemic-heart-disease",
      "congestive-heart-failure",
    ]) {
      const suggestion = hypertension?.suggestions.find((entry) => entry.conditionId === conditionId);
      expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["disease-progression"]);
      expect(suggestion?.pathwayIntelligence?.issuesToResolve.length).toBeGreaterThan(0);
      expect(suggestion?.rationale).toMatch(/individual|multifactorial|etiolog|risk factor/i);
    }
  });

  it("replaces the hypertension-ED source one-for-one without adding directional causation", () => {
    const suggestion = byId.get("hypertension")?.suggestions.find(
      (entry) => entry.conditionId === "erectile-dysfunction",
    );
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.citation).toMatch(/2025 AHA\/ACC|40811497/i);
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toBe(
      "https://pubmed.ncbi.nlm.nih.gov/40811497/",
    );
    expect(suggestion?.sourceReferences[0]?.sourceLocator).toMatch(/section 6\.3|Sexual Dysfunction/i);
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.rationale).toMatch(/association/i);
    expect(suggestion?.rationale).toMatch(/vascular|atheroscl/i);
    expect(suggestion?.rationale).not.toMatch(/40-study|121,641|27491642/i);
  });

  it("does not turn the guideline medication discussion into a medication-specific nexus", () => {
    const suggestion = byId.get("hypertension")?.suggestions.find(
      (entry) => entry.conditionId === "erectile-dysfunction",
    );
    expect(suggestion?.rationale).toMatch(/medication-specific.*separate|drug-class.*chronology/i);
    expect(suggestion?.evidenceGaps.join(" ")).toMatch(/Medication history/i);
    expect(suggestion?.sourceReferences[0]?.note).toMatch(/not automatic individual causation|not.*medication-specific nexus/i);
  });
});
