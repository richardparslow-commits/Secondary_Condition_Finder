import fs from "node:fs";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const load = (path: string) => JSON.parse(fs.readFileSync(`${root}/${path}`, "utf8"));

/**
 * ME-41 is a documentation-and-rationale batch: it closes the residual scope of
 * issue #360 by recording evidence-grounded safe-draft dispositions for the six
 * Mental Disorders primaries that were placed on HOLD during ME-16 planning.
 *
 * It creates no relationship, rank, guard, source, or publication-state change,
 * so this suite pins *stability* rather than growth.
 */
const RESEARCH_DATE = "2026-09-12";
const LEDGER = "docs/mapping-expansion-me41-safe-draft-disposition-ledger.md";

// slug -> PMIDs actually examined via NCBI E-utilities and recorded in the KB todo
const SAFE_DRAFTS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["adjustment-disorder", ["19845414", "21251875"]],
  ["delusional-disorder", ["32774942", "32399397", "36552037"]],
  ["depersonalization-derealization-disorder", ["20308898", "35699456"]],
  ["dissociative-disorder", ["21910187", "23394228"]],
  ["functional-neurological-symptom-disorder", ["28434123"]],
  ["schizoaffective-disorder", ["30699217"]],
] as const;

const SAFE_DRAFT_IDS = SAFE_DRAFTS.map(([id]) => id);

// The 14 issue #360 primaries already mapped by ME-15..ME-18, with their rank-1 target.
const MAPPED: ReadonlyArray<readonly [string, string]> = [
  ["anxiety-disorder", "depressive-disorder"],
  ["panic-disorder", "agoraphobia"],
  ["ocd", "migraine-headaches"],
  ["binge-eating-disorder", "depressive-disorder"],
  ["bipolar-disorder", "anxiety-disorder"],
  ["bulimia-nervosa", "depressive-disorder"],
  ["specific-phobia", "depressive-disorder"],
  ["hoarding-disorder", "depressive-disorder"],
  ["body-dysmorphic-disorder", "depressive-disorder"],
  ["agoraphobia", "depressive-disorder"],
  ["persistent-depressive-disorder", "depressive-disorder"],
  ["somatic-symptom-disorder", "depressive-disorder"],
  ["illness-anxiety-disorder", "depressive-disorder"],
  ["cyclothymic-disorder", "bipolar-disorder"],
] as const;

// issue #360 names exactly these 20 draft Mental Disorders primaries.
const ISSUE_360_SCOPE = [
  "adjustment-disorder", "agoraphobia", "anxiety-disorder", "binge-eating-disorder",
  "bipolar-disorder", "body-dysmorphic-disorder", "bulimia-nervosa", "cyclothymic-disorder",
  "delusional-disorder", "depersonalization-derealization-disorder", "dissociative-disorder",
  "functional-neurological-symptom-disorder", "hoarding-disorder", "illness-anxiety-disorder",
  "ocd", "panic-disorder", "persistent-depressive-disorder", "schizoaffective-disorder",
  "somatic-symptom-disorder", "specific-phobia",
] as const;

type Mapping = {
  id: string;
  draft: boolean;
  todo: string[];
  suggestions: Array<{ conditionId: string; rank: number; pathwayIntelligence?: unknown }>;
};
type RelationshipRow = { relationshipId: string; primaryId: string; targetId: string; rank: number };
type RelationshipRegistry = {
  currentState: string;
  counts: { relationships: number; explicitPublicationGuards: number; legacyRationaleBoundaries: number };
  relationships: RelationshipRow[];
};
type SourceRegistry = { currentState: string; sources: Array<{ sourceId: string }> };

describe("Mapping Expansion ME-41 — Mental Disorders safe-draft dispositions", () => {
  const relationships = load("data/evidence/master-relationships.json") as RelationshipRegistry;
  const sources = load("data/evidence/master-sources.json") as SourceRegistry;
  const ledgerText = fs.readFileSync(`${root}/${LEDGER}`, "utf8");
  const kb = new Map<string, Mapping>(
    SAFE_DRAFT_IDS.map((id) => [id, load(`data/knowledge-base/${id}.json`) as Mapping]),
  );
  const byPrimary = new Map<string, RelationshipRow[]>();
  for (const row of relationships.relationships) {
    byPrimary.set(row.primaryId, [...(byPrimary.get(row.primaryId) ?? []), row]);
  }

  it("keeps all six residual primaries safe-draft with zero suggestions", () => {
    for (const id of SAFE_DRAFT_IDS) {
      const mapping = kb.get(id);
      expect(mapping, `missing KB mapping for ${id}`).toBeDefined();
      expect(mapping?.id).toBe(id);
      expect(mapping?.draft, `${id} must remain draft`).toBe(true);
      expect(mapping?.suggestions, `${id} must carry no suggestion`).toEqual([]);
      expect(mapping?.todo.length, `${id} must document its safe-draft rationale`).toBeGreaterThan(0);
    }
  });

  it("registers no relationship for any residual primary", () => {
    for (const id of SAFE_DRAFT_IDS) {
      expect(byPrimary.get(id) ?? [], `${id} must stay unregistered`).toEqual([]);
    }
  });

  it("records the dated ME-41 rescreen and the exact PMIDs examined for each primary", () => {
    for (const [id, pmids] of SAFE_DRAFTS) {
      const text = (kb.get(id)?.todo ?? []).join(" ");
      expect(text, `${id} must carry the ME-41 rescreen marker`).toContain(
        `ME-41 safe-draft rescreen ${RESEARCH_DATE}`,
      );
      expect(text, `${id} must attribute the rescreen to NCBI E-utilities`).toContain("NCBI E-utilities");
      for (const pmid of pmids) {
        expect(text, `${id} must name examined PMID ${pmid}`).toContain(pmid);
      }
      expect(text, `${id} must state a release condition`).toMatch(/Keep safe-draft|remains in force/);
    }
  });

  it("preserves the ME-30 adjustment-disorder withdrawal rationale alongside the ME-41 rescreen", () => {
    // tests/clinical-evidence-promotion-batch29.test.ts pins PMID 35362447 in this todo;
    // ME-41 appends rather than replaces so the FINAL-CLOSE-DIRECTION history survives.
    const todo = kb.get("adjustment-disorder")?.todo ?? [];
    expect(todo).toHaveLength(2);
    expect(todo[0]).toMatch(/35362447/);
    expect(todo[0]).toMatch(/anxiety|depression|psychosocial/i);
    expect(todo[1]).toContain(`ME-41 safe-draft rescreen ${RESEARCH_DATE}`);
    expect(todo[1]).toContain("FINAL-CLOSE-DIRECTION");
  });

  it("records the phenotype-identity barrier that blocks a schizoaffective-disorder mood edge", () => {
    const todo = kb.get("schizoaffective-disorder")?.todo ?? [];
    const text = todo.join(" ");
    expect(text).toContain("30699217");
    expect(text).toMatch(/constitutive/);
    expect(text).toMatch(/major mood episode/);
    // The previously undocumented primary must now carry both halves of the precedent shape.
    expect(todo).toHaveLength(2);
  });

  it("does not mutate the master relationship registry", () => {
    expect(relationships.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(relationships.counts).toEqual({
      relationships: 749,
      explicitPublicationGuards: 675,
      legacyRationaleBoundaries: 74,
    });
    expect(relationships.relationships).toHaveLength(749);
  });

  it("does not add or verify any master source", () => {
    expect(sources.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(sources.sources).toHaveLength(1203);
    const examined = SAFE_DRAFTS.flatMap(([, pmids]) => pmids).map((pmid) => `pmid-${pmid}`);
    for (const sourceId of examined) {
      expect(
        sources.sources.some((row) => row.sourceId === sourceId),
        `${sourceId} must not be registered by a disposition-only batch`,
      ).toBe(false);
    }
  });

  it("adds no pathwayIntelligence to any residual primary", () => {
    for (const id of SAFE_DRAFT_IDS) {
      const raw = fs.readFileSync(`${root}/data/knowledge-base/${id}.json`, "utf8");
      expect(raw, `${id} must not carry pathwayIntelligence`).not.toContain("pathwayIntelligence");
    }
  });

  it("leaves the historical Wave 1-7 disposition ledger untouched", () => {
    const ledger = load("data/expansion-dispositions.json") as {
      totalIdentities: number;
      waves: Array<{ identities: Array<{ id: string }> }>;
    };
    const entries = ledger.waves.flatMap((wave) => wave.identities);
    expect(ledger.totalIdentities).toBe(107);
    expect(entries).toHaveLength(107);
    // schizoaffective-disorder was never part of the Wave 1-7 snapshot and ME-41 does not add it.
    expect(entries.some((entry) => entry.id === "schizoaffective-disorder")).toBe(false);
  });

  it("closes issue #360: all 20 scope primaries are mapped or dispositioned", () => {
    expect(ISSUE_360_SCOPE).toHaveLength(20);
    expect(new Set(ISSUE_360_SCOPE).size).toBe(20);

    for (const [id, target] of MAPPED) {
      const rows = (byPrimary.get(id) ?? []).filter((row) => row.targetId === target);
      expect(rows.length, `${id} -> ${target} must remain registered`).toBeGreaterThan(0);
      expect(Math.min(...rows.map((row) => row.rank))).toBe(1);
    }

    // ocd keeps its pre-existing rank-1 migraine edge; ME-15 entered at rank 2.
    const ocd = byPrimary.get("ocd") ?? [];
    expect(ocd.map((row) => row.targetId).sort()).toEqual(["depressive-disorder", "migraine-headaches"]);
    expect(ocd.find((row) => row.targetId === "depressive-disorder")?.rank).toBe(2);

    const accounted = new Set<string>([...MAPPED.map(([id]) => id), ...SAFE_DRAFT_IDS]);
    expect([...ISSUE_360_SCOPE].filter((id) => !accounted.has(id))).toEqual([]);
    expect(accounted.size).toBe(20);
  });

  it("documents every residual primary and the no-change attestation in the ME-41 ledger", () => {
    for (const id of SAFE_DRAFT_IDS) {
      expect(ledgerText, `ledger must cover ${id}`).toContain(id);
    }
    expect(ledgerText).toContain("NO RELATIONSHIP MUTATION");
    expect(ledgerText).toContain("ME-39-CITATION-VERIFIED");
    expect(ledgerText).toContain("20 / 20 accounted for: 14 mapped, 6 safe drafts");
    expect(ledgerText).toContain("796ff968bfbe38fe148dc23abd32734df5d8447a");
    // Every examined PMID must be traceable in the ledger as well as in the KB todo.
    for (const [, pmids] of SAFE_DRAFTS) {
      for (const pmid of pmids) {
        expect(ledgerText, `ledger must cite PMID ${pmid}`).toContain(pmid);
      }
    }
    // A disposition-only batch must not claim the relationship-bearing approval gates.
    expect(ledgerText).toContain("no mapping approval and no qualified-human citation verification");
  });
});

