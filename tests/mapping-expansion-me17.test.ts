import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type SourceReference = { citation?: string; verified: boolean; verificationScope?: string };
type Suggestion = { conditionId: string; rank: number; nexusClaim: { nexusClassification: string; } | undefined;
  evidentiaryProfile: { etiologicalConsensus: string; } | undefined; pathwayIntelligence?: unknown; sourceReferences: SourceReference[] };
type Mapping = { draft: boolean; suggestions: Suggestion[] };
type RelationshipRecord = { relationshipId: string; primaryPublicationState: string; rank: number; publicationGuard: { structuredGuardText: string } };
type RelationshipRegistry = { baselineCommit: string; currentState: string; relationships: RelationshipRecord[] };
type SourceRecord = { sourceId: string; status: string; verified: boolean };
type SourceRegistry = { baselineCommit: string; currentState: string; sources: SourceRecord[] };
const ROOT = process.cwd();
const rows = [
  {
    "primaryId": "persistent-depressive-disorder",
    "targetId": "depressive-disorder",
    "pmid": "16648329",
    "rank": 1,
    "guard": "Require independently established persistent depressive disorder (dysthymia) and a separately documented major depressive episode superimposed upon it; the cited prospective follow-up found that most dysthymic patients developed a major depressive episode during ten years of observation; do not treat persistent depressive disorder as proof that any individual's depressive disorder was caused by it. Preserve other psychiatric illness, substance use, medical illness, medications, and shared vulnerability as competing explanations. Treat this only as population-level temporal risk, not proof that persistent depressive disorder caused an individual's depressive disorder."
  },
  {
    "primaryId": "somatic-symptom-disorder",
    "targetId": "depressive-disorder",
    "pmid": "18433651",
    "rank": 1,
    "guard": "Require independently established DSM-5 somatic symptom disorder and separately established depressive disorder; the cited primary-care study reports syndromal overlap between somatization, depression, and anxiety and does not establish onset order or direction. Preserve medically explained symptoms, other psychiatric illness, substance use, medications, and shared vulnerability as competing explanations. Do not infer a depressive disorder from somatic symptoms, health concerns, or functional impairment alone, and do not treat this population-level association as proof that somatic symptom disorder caused an individual's depressive disorder."
  },
  {
    "primaryId": "fibromyalgia",
    "targetId": "depressive-disorder",
    "pmid": "16908799",
    "rank": 1,
    "guard": "Require independently established fibromyalgia or documented chronic widespread pain and a separately established depressive disorder; the cited population-based twin study found strong co-occurrence of chronic widespread pain with depressive symptoms, substantially mediated by shared genetic and family-environmental factors, and did not establish individual causation or direction. Preserve chronic fatigue, other functional somatic syndromes, musculoskeletal disorders, medications, substance use, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from pain, fatigue, or impairment alone, and do not treat this population-level association as proof that fibromyalgia caused an individual's depressive disorder."
  },
  {
    "primaryId": "irritable-bowel-syndrome",
    "targetId": "depressive-disorder",
    "pmid": "11910364",
    "rank": 1,
    "guard": "Require independently established irritable bowel syndrome and a separately established depressive disorder; the cited systematic review reported frequent comorbidity of irritable bowel syndrome with major depression and anxiety and does not establish onset order or direction. Preserve other functional gastrointestinal disorders, visceral hypersensitivity, infectious or inflammatory bowel disease, medications, substance use, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from gastrointestinal symptoms, distress, or impairment alone, and do not treat this population-level association as proof that irritable bowel syndrome caused an individual's depressive disorder."
  },
  {
    "primaryId": "tinnitus",
    "targetId": "depressive-disorder",
    "pmid": "30909841",
    "rank": 1,
    "guard": "Require independently established chronic tinnitus and a separately established depressive disorder; the cited systematic review reported frequent depressive comorbidity across tinnitus patient samples and does not establish onset order or direction. Preserve hearing loss, otologic disease, noise exposure, medications, substance use, chronic pain, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from tinnitus-related distress, sleep disturbance, or impairment alone, and do not treat this population-level association as proof that tinnitus caused an individual's depressive disorder."
  },
];
const load = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

describe("Mapping Expansion ME-17 local implementation", () => {
  it("adds exactly five bounded draft relationships while preserving each live publication state", () => {
    for (const row of rows) {
      const mapping = load<Mapping>(path.join(ROOT, "data", "knowledge-base", `${row.primaryId}.json`));
      expect(mapping.draft).toBe(true);
      const hits = mapping.suggestions.filter((s: Suggestion) => s.conditionId === row.targetId);
      expect(hits).toHaveLength(1);
      expect(hits[0]!.rank).toBe(row.rank);
      expect(hits[0]!.nexusClaim?.nexusClassification).toBeDefined(); expect(hits[0]!.evidentiaryProfile?.etiologicalConsensus).toBeDefined();
      expect(hits[0]!.pathwayIntelligence).toBeUndefined();
      const refs = hits[0]!.sourceReferences.filter((r: SourceReference) => r.citation?.includes(`PMID ${row.pmid}`));
      expect(refs).toHaveLength(1);
      expect(refs[0]!.verified).toBe(false);
      expect(refs[0]!.verificationScope).toBe("clinical-evidence");
    }
  });

  it("records five bounded relationships and five pending-verification sources in the master registries", () => {
    const rel = load<RelationshipRegistry>(path.join(ROOT, "data", "evidence", "master-relationships.json"));
    const src = load<SourceRegistry>(path.join(ROOT, "data", "evidence", "master-sources.json"));
    expect(rel.baselineCommit).toBe("ea005e50ccbc30800dd46f3872f764f98e977c1f");
    expect(rel.currentState).toBe("ME27-PRE-QUALIFIED-HUMAN-CITATION-VERIFICATION");
    expect(src.baselineCommit).toBe("ea005e50ccbc30800dd46f3872f764f98e977c1f");
    expect(src.currentState).toBe("ME27-PRE-QUALIFIED-HUMAN-CITATION-VERIFICATION");
    for (const row of rows) {
      const rr = rel.relationships.filter((r: RelationshipRecord) => r.relationshipId === `rel-${row.primaryId}-to-${row.targetId}`);
      expect(rr).toHaveLength(1);
      expect(rr[0]!.primaryPublicationState).toBe("draft");
      expect(rr[0]!.rank).toBe(row.rank);
      expect(rr[0]!.publicationGuard.structuredGuardText).toBe(row.guard);
      const ss = src.sources.filter((s: SourceRecord) => s.sourceId === `pmid-${row.pmid}`);
      expect(ss).toHaveLength(1);
      expect(ss[0]!.status).toBe("pending-verification");
      expect(ss[0]!.verified).toBe(false);
    }
  });

  it("pins the ME-17 pre-citation-verification aggregate state", () => {
    const maps = fs.readdirSync(path.join(ROOT, "data", "knowledge-base")).filter((f) => f.endsWith(".json")).map((f) => load<Mapping>(path.join(ROOT, "data", "knowledge-base", f)));
    const refs = maps.flatMap((m: Mapping) => m.suggestions.flatMap((s: Suggestion) => s.sourceReferences || []));
    const clinical = refs.filter((r: SourceReference) => r.verificationScope === "clinical-evidence");
    expect(maps.reduce((n: number, m: Mapping) => n + m.suggestions.length, 0)).toBe(308);
    expect(maps.filter((m: Mapping) => m.draft === false && m.suggestions.length === 1)).toHaveLength(66);
    expect(maps.filter((m: Mapping) => m.draft === false && m.suggestions.length >= 2)).toHaveLength(73);
    expect(maps.filter((m: Mapping) => m.draft === true && m.suggestions.length === 1)).toHaveLength(79);
    expect(refs).toHaveLength(316);
    expect(refs.filter((r: SourceReference) => r.verified === true)).toHaveLength(256);
    expect(refs.filter((r: SourceReference) => r.verified === false)).toHaveLength(60);
    expect(clinical).toHaveLength(311);
  });
});