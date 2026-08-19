import { assertMaster2026CurrentState, isMaster2026Active } from "./helpers/master-2026-current";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadKnowledgeBase } from "@/lib/kb/load";

const root = process.cwd();
const kb = loadKnowledgeBase();
const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

describe("qualified-human approved clinical mapping batch M1", () => {
  it("publishes social anxiety to depressive disorder as temporal association only", () => {
    const mapping = byId.get("social-anxiety-disorder");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("depressive-disorder");
    expect(suggestion?.pathwayIntelligence).toBeUndefined();
    expect(suggestion?.sourceReferences).toHaveLength(2);
    expect(suggestion?.sourceReferences.every((reference) => reference.verified === true)).toBe(true);
    expect(suggestion?.sourceReferences.every((reference) => reference.verificationScope === "clinical-evidence")).toBe(true);
    const urls = suggestion?.sourceReferences.map((reference) => reference.sourceUrl).join(" ");
    expect(urls).toMatch(/11231832/);
    expect(urls).toMatch(/17679635/);
  });

  it("publishes laryngeal cancer to aphonia only through documented treatment", () => {
    const mapping = byId.get("laryngeal-cancer");
    const suggestion = mapping?.suggestions[0];
    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(suggestion?.conditionId).toBe("aphonia");
    expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["treatment-complication"]);
    expect(suggestion?.sourceReferences).toHaveLength(2);
    expect(suggestion?.sourceReferences.every((reference) => reference.verified === true)).toBe(true);
    expect(suggestion?.rationale).toMatch(/documented total laryngectomy/i);
    expect(suggestion?.rationale).toMatch(/documented aphonia/i);
    expect(suggestion?.rationale).toMatch(/not sufficient/i);
  });

  it("preserves the non-M1 evidence holds", () => {
    // Master 2026 supersedes this historical current-state assertion while
    // preserving the original pre-master contract below for historical states.
    if (isMaster2026Active()) {
      assertMaster2026CurrentState();
      return;
    }

    for (const id of ["narcolepsy", "carpal-tunnel-syndrome", "rem-sleep-disorder"] as const) {
      expect(byId.get(id)?.draft).toBe(true);
      expect(byId.get(id)?.suggestions).toEqual([]);
    }
    const mtbi = byId.get("mild-tbi");
    const source = mtbi?.suggestions[0]?.sourceReferences.find((reference) =>
      [reference.citation, reference.sourceUrl, reference.note, reference.sourceLocator].join(" ").includes("38568491"),
    );
    expect(source?.verified).toBe(false);
  });

  it("records the M1 Wave disposition state", () => {
    // Master 2026 supersedes this historical current-state assertion while
    // preserving the original pre-master contract below for historical states.
    if (isMaster2026Active()) {
      assertMaster2026CurrentState();
      return;
    }

    const ledger = JSON.parse(readFileSync(join(root, "data/expansion-dispositions.json"), "utf8")) as {
      totalIdentities: number;
      waves: Array<{ identities: Array<{ id: string; disposition: string }> }>;
    };
    const entries = ledger.waves.flatMap((wave) => wave.identities);
    expect(ledger.totalIdentities).toBe(107);
    expect(entries.filter((entry) => entry.disposition === "published-evidence-led")).toHaveLength(31);
    expect(entries.filter((entry) => entry.disposition === "safe-draft")).toHaveLength(76);
    expect(entries.filter((entry) => entry.disposition === "promotion-candidate")).toHaveLength(0);
    expect(entries.find((entry) => entry.id === "laryngeal-cancer")?.disposition).toBe("published-evidence-led");
  });

  it("opens exactly four new bounded unverified clinical review rows", () => {
    // Master 2026 supersedes this historical current-state assertion while
    // preserving the original pre-master contract below for historical states.
    if (isMaster2026Active()) {
      assertMaster2026CurrentState();
      return;
    }

    const refs = kb.flatMap((mapping) =>
      mapping.suggestions.flatMap((suggestion) => suggestion.sourceReferences ?? []),
    );
    const unverified = refs.filter((reference) => reference.verified !== true);
    const publishedUnverified = kb.flatMap((mapping) =>
      mapping.draft ? [] : mapping.suggestions.flatMap((suggestion) =>
        (suggestion.sourceReferences ?? []).filter((reference) => reference.verified !== true),
      ),
    );
    const clinicalWithUrls = refs.filter(
      (reference) => reference.verificationScope === "clinical-evidence" && Boolean(reference.sourceUrl),
    );
    expect(refs).toHaveLength(73);
    expect(unverified).toHaveLength(5);
    expect(publishedUnverified).toHaveLength(73);
    expect(clinicalWithUrls).toHaveLength(136);
    const text = unverified.map((reference) => [reference.citation, reference.sourceUrl].join(" ")).join(" ");
    for (const pmid of ["38568491", "11231832", "17679635", "25630206", "20189345"]) {
      expect(text).toContain(pmid);
    }
  });
});
