import { assertMaster2026CurrentState, isMaster2026Active } from "./helpers/master-2026-current";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("targeted clinical mapping batch 31", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 301/301 universe", () => {
    expect(catalog).toHaveLength(301);
    expect(kb).toHaveLength(301);
  });

  it("recognizes Batch-7 insomnia-to-depression temporal-association narrowing", () => {
    const mapping = byId.get("insomnia");
    const suggestion = mapping?.suggestions[0];

    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("depressive-disorder");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain("38833937");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
    expect(suggestion?.sourceReferences[0]?.sourceCheckedOn).toBe("2026-08-18");
    expect(suggestion?.rationale).toMatch(/temporal-association|prospective/i);
    expect(suggestion?.rationale).toMatch(/does not establish individual causation/i);
    expect(suggestion?.rationale).not.toMatch(/direct-secondary research/i);
  });

  it("recognizes Batch-8 migraine-to-depression temporal-association narrowing and verification", () => {
    const mapping = byId.get("migraine-headaches");
    const suggestion = mapping?.suggestions[0];

    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("depressive-disorder");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.sourceReferences).toHaveLength(1);
    expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
    expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain("23588795");
    expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
    expect(suggestion?.sourceReferences[0]?.sourceCheckedOn).toBe("2026-08-18");
    expect(suggestion?.rationale).toMatch(/temporal-association research/i);
    expect(suggestion?.rationale).toMatch(/does not establish individual causation/i);
    expect(suggestion?.rationale).not.toMatch(/somatopsychic research/i);
  });

  it("preserves the corrected bounded mild-TBI to post-traumatic-headache mapping", () => {
    const mapping = byId.get("mild-tbi");
    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(mapping?.suggestions[0]?.conditionId).toBe("post-traumatic-headache");
    expect(mapping?.suggestions[0]?.sourceReferences[0]?.sourceUrl).toContain("38568491");
    expect(mapping?.suggestions[0]?.sourceReferences[0]?.sourceCheckedOn).toBe("2026-08-19");
    expect(mapping?.suggestions[0]?.sourceReferences[0]?.verified).toBe(true);
    expect(mapping?.suggestions[0]?.rationale).toMatch(/mild traumatic brain injury/i);
    expect(mapping?.suggestions[0]?.rationale).toMatch(/within 7 days/i);
    expect(mapping?.suggestions[0]?.rationale).toMatch(/greater than 3 months/i);
  });

  it("keeps micro-TBI a separate nonstandardized safe draft", () => {
    const mapping = byId.get("micro-tbi");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/separately|distinct standardized clinical diagnosis|mild TBI/i);
  });

  it("keeps the remaining unpromoted targeted identities safe-draft after exact-target review", () => {
    // Master 2026 supersedes this historical current-state assertion while
    // preserving the original pre-master contract below for historical states.
    if (isMaster2026Active()) {
      assertMaster2026CurrentState();
      return;
    }

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
    ] as const) {
      const mapping = byId.get(id);
      expect(mapping?.draft, `${id} should remain draft`).toBe(true);
      expect(mapping?.suggestions, `${id} should not publish a suggestion`).toEqual([]);
      expect(mapping?.todo.length, `${id} should state the hold reason`).toBeGreaterThan(0);
    }
  });

  it("guards the key negative modeling dispositions", () => {
    // Master 2026 supersedes this historical current-state assertion while
    // preserving the original pre-master contract below for historical states.
    if (isMaster2026Active()) {
      assertMaster2026CurrentState();
      return;
    }

    expect(byId.get("carpal-tunnel-syndrome")?.todo.join(" ")).toMatch(/taxonomy|diagnostic overlap|median/i);
    expect(byId.get("median-neuropathy")?.todo.join(" ")).toMatch(/carpal tunnel|overlap/i);
    expect(byId.get("hypothyroidism")?.todo.join(" ")).toMatch(/41002938|not statistically significant|adjust/i);
    expect(byId.get("rem-sleep-disorder")?.todo.join(" ")).toMatch(/prodromal|does not.*cause|Parkinson/i);
  });

  it("reflects the current citation debt after Master 2026 citation verification", () => {
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

    expect(liveReferences).toHaveLength(141);
    expect(liveUnverified).toHaveLength(0);
    expect(publishedUnverified).toHaveLength(0);
    expect(clinicalWithUrls).toHaveLength(136);
  });

  it("leaves the Wave 1-7 disposition ledger unchanged", () => {
    // Master 2026 supersedes this historical current-state assertion while
    // preserving the original pre-master contract below for historical states.
    if (isMaster2026Active()) {
      assertMaster2026CurrentState();
      return;
    }

    const ledger = JSON.parse(
      readFileSync(join(process.cwd(), "data/expansion-dispositions.json"), "utf8"),
    ) as { waves: Array<{ identities: Array<{ disposition: string }> }> };
    const entries = ledger.waves.flatMap((wave) => wave.identities);

    expect(entries.filter((entry) => entry.disposition === "published-evidence-led")).toHaveLength(31);
    expect(entries.filter((entry) => entry.disposition === "safe-draft")).toHaveLength(76);
    expect(entries.filter((entry) => entry.disposition === "promotion-candidate")).toHaveLength(0);
  });
});
