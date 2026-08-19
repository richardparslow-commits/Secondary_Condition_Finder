import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("targeted clinical mapping batch 31", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it.each([
    ["insomnia", "depressive-disorder", "direct-secondary", "38833937"],
    ["migraine-headaches", "depressive-disorder", "somatopsychic", "23588795"],
  ])("publishes %s to %s with one bounded unverified prospective source", (primaryId, secondaryId, pathway, pmid) => {
    const mapping = byId.get(primaryId);
    const suggestion = mapping?.suggestions[0];

    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe(secondaryId);
    expect(suggestion?.pathwayIntelligence?.pathways).toContain(pathway);
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain(pmid);
    expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
    expect(suggestion?.rationale).toMatch(/population|prospective|individual/i);
  });

  it("preserves the existing bounded mild-TBI to migraine mapping", () => {
    const mapping = byId.get("mild-tbi");
    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(mapping?.suggestions[0]?.conditionId).toBe("migraine-headaches");
    expect(mapping?.suggestions[0]?.sourceReferences[0]?.sourceUrl).toContain("38568491");
    expect(mapping?.suggestions[0]?.sourceReferences[0]?.verified).toBe(false);
  });

  it("keeps micro-TBI a separate nonstandardized safe draft", () => {
    const mapping = byId.get("micro-tbi");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/separately|distinct standardized clinical diagnosis|mild TBI/i);
  });

  it("keeps the remaining targeted identities safe-draft after exact-target review", () => {
    for (const id of [
      "carpal-tunnel-syndrome",
      "chronic-fatigue-syndrome",
      "hypothyroidism",
      "illness-anxiety-disorder",
      "median-neuropathy",
      "narcolepsy",
      "peripheral-neuropathy",
      "radial-neuropathy",
      "rem-sleep-disorder",
      "social-anxiety-disorder",
    ] as const) {
      const mapping = byId.get(id);
      expect(mapping?.draft, `${id} should remain draft`).toBe(true);
      expect(mapping?.suggestions, `${id} should not publish a suggestion`).toEqual([]);
      expect(mapping?.todo.length, `${id} should state the hold reason`).toBeGreaterThan(0);
    }
  });

  it("guards the key negative modeling dispositions", () => {
    expect(byId.get("carpal-tunnel-syndrome")?.todo.join(" ")).toMatch(/taxonomy|diagnostic overlap|median/i);
    expect(byId.get("median-neuropathy")?.todo.join(" ")).toMatch(/carpal tunnel|overlap/i);
    expect(byId.get("hypothyroidism")?.todo.join(" ")).toMatch(/41002938|not statistically significant|adjust/i);
    expect(byId.get("rem-sleep-disorder")?.todo.join(" ")).toMatch(/prodromal|does not.*cause|Parkinson/i);
    expect(byId.get("social-anxiety-disorder")?.todo.join(" ")).toMatch(/11231832|prospective|population-level/i);
  });

  it("reflects the current citation debt after qualified-human Batches 1 through 5", () => {
    const liveReferences = kb.flatMap((mapping) =>
      mapping.suggestions.flatMap((suggestion) => suggestion.sourceReferences ?? []),
    );
    const liveUnverified = liveReferences.filter((reference) => reference.verified !== true);
    const publishedUnverified = kb.flatMap((mapping) =>
      mapping.draft
        ? []
        : mapping.suggestions.flatMap((suggestion) =>
            (suggestion.sourceReferences ?? []).filter((reference) => reference.verified !== true),
          ),
    );
    const clinicalWithUrls = liveReferences.filter(
      (reference) => reference.verificationScope === "clinical-evidence" && Boolean(reference.sourceUrl),
    );

    expect(liveReferences).toHaveLength(69);
    expect(liveUnverified).toHaveLength(36);
    expect(publishedUnverified).toHaveLength(34);
    expect(clinicalWithUrls).toHaveLength(64);
  });

  it("leaves the Wave 1-7 disposition ledger unchanged", () => {
    const ledger = JSON.parse(
      readFileSync(join(process.cwd(), "data/expansion-dispositions.json"), "utf8"),
    ) as { waves: Array<{ identities: Array<{ disposition: string }> }> };
    const entries = ledger.waves.flatMap((wave) => wave.identities);

    expect(entries.filter((entry) => entry.disposition === "published-evidence-led")).toHaveLength(30);
    expect(entries.filter((entry) => entry.disposition === "safe-draft")).toHaveLength(77);
    expect(entries.filter((entry) => entry.disposition === "promotion-candidate")).toHaveLength(0);
  });
});
