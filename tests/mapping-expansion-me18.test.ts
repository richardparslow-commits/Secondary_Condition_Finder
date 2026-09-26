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
    "primaryId": "chronic-fatigue-syndrome",
    "targetId": "depressive-disorder",
    "pmid": "12562565",
    "rank": 1,
    "guard": "Require independently established chronic fatigue syndrome (CFS/ME) and a separately established depressive disorder; the cited review reported substantial comorbidity and symptom overlap between chronic fatigue syndrome and depressive and other psychiatric disorders without establishing onset order, direction, or individual causation. Preserve other medical illness, sleep disorders, substance use, medications, endocrine disease, anemia, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from fatigue, post-exertional malaise, or impairment alone, and do not treat this population-level association as proof that chronic fatigue syndrome caused an individual's depressive disorder."
  },
  {
    "primaryId": "illness-anxiety-disorder",
    "targetId": "depressive-disorder",
    "pmid": "8039697",
    "rank": 1,
    "guard": "Require independently established DSM-5 illness anxiety disorder (or its hypochondriasis diagnostic predecessor) and a separately established depressive disorder; the cited psychiatric-consultation study reported major depression as the most frequent comorbid disturbance among patients with hypochondriasis without establishing individual causation or direction. Preserve other anxiety disorders, somatic symptom disorder, substance use, medical illness, medications, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from health anxiety, illness-related distress, or impairment alone, and do not treat this clinical-sample association as proof that illness anxiety disorder caused an individual's depressive disorder."
  },
  {
    "primaryId": "cyclothymic-disorder",
    "targetId": "bipolar-disorder",
    "pmid": "22459786",
    "rank": 1,
    "guard": "Require independently established cyclothymic disorder and a separately established full bipolar disorder (type I or II) before presenting the relationship; the cited critical review characterizes cyclothymic disorder as a chronic and impairing disorder on the bipolar spectrum and does not establish that any individual will progress to full bipolar disorder. Preserve major depressive disorder, other bipolar-spectrum presentations, substance use, medications, personality factors, and other psychiatric illness as competing explanations. Do not infer bipolar disorder from hypomanic or depressive symptoms alone, and do not treat this spectrum-level association as proof that cyclothymic disorder caused an individual's bipolar disorder."
  },
  {
    "primaryId": "alopecia-areata",
    "targetId": "depressive-disorder",
    "pmid": "31163237",
    "rank": 1,
    "guard": "Require independently established alopecia areata and a separately established depressive disorder; the cited systematic review and meta-analysis reported significantly increased odds of depression among patients with alopecia areata without establishing onset order or direction. Preserve other dermatologic disease, autoimmune disease, thyroid disease, medications, substance use, psychosocial stressors, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from hair-loss-related distress, appearance concern, or impairment alone, and do not treat this population-level association as proof that alopecia areata caused an individual's depressive disorder."
  },
  {
    "primaryId": "vitiligo",
    "targetId": "depressive-disorder",
    "pmid": "27878819",
    "rank": 1,
    "guard": "Require independently established vitiligo and a separately established depressive disorder; the cited systematic review and meta-analysis reported significantly increased odds of depression among patients with vitiligo without establishing onset order or direction. Preserve other dermatologic disease, autoimmune disease, thyroid disease, medications, substance use, psychosocial stressors, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from skin-pigmentation-related distress, stigmatization, or impairment alone, and do not treat this population-level association as proof that vitiligo caused an individual's depressive disorder."
  },
];
const load = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

describe("Mapping Expansion ME-18 local implementation", () => {
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
      expect(refs[0]!.verified).toBe(true);
      expect(refs[0]!.verificationScope).toBe("clinical-evidence");
    }
  });

  it("records five bounded relationships and five pending-verification sources in the master registries", () => {
    const rel = load<RelationshipRegistry>(path.join(ROOT, "data", "evidence", "master-relationships.json"));
    const src = load<SourceRegistry>(path.join(ROOT, "data", "evidence", "master-sources.json"));
    expect(rel.baselineCommit).toBe("ea005e50ccbc30800dd46f3872f764f98e977c1f");
    expect(rel.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(src.baselineCommit).toBe("ea005e50ccbc30800dd46f3872f764f98e977c1f");
    expect(src.currentState).toBe("D1-DRAFT-AUTHORED");
    for (const row of rows) {
      const rr = rel.relationships.filter((r: RelationshipRecord) => r.relationshipId === `rel-${row.primaryId}-to-${row.targetId}`);
      expect(rr).toHaveLength(1);
      expect(rr[0]!.primaryPublicationState).toBe("draft");
      expect(rr[0]!.rank).toBe(row.rank);
      expect(rr[0]!.publicationGuard.structuredGuardText).toBe(row.guard);
      const ss = src.sources.filter((s: SourceRecord) => s.sourceId === `pmid-${row.pmid}`);
      expect(ss).toHaveLength(1);
      expect(ss[0]!.status).toBe("active");
      expect(ss[0]!.verified).toBe(true);
    }
  });

  it("pins the ME-18 pre-citation-verification aggregate state", () => {
    const maps = fs.readdirSync(path.join(ROOT, "data", "knowledge-base")).filter((f) => f.endsWith(".json")).map((f) => load<Mapping>(path.join(ROOT, "data", "knowledge-base", f)));
    const refs = maps.flatMap((m: Mapping) => m.suggestions.flatMap((s: Suggestion) => s.sourceReferences || []));
    const clinical = refs.filter((r: SourceReference) => r.verificationScope === "clinical-evidence");
    expect(maps.reduce((n: number, m: Mapping) => n + m.suggestions.length, 0)).toBe(716);
    expect(maps.filter((m: Mapping) => m.draft === false && m.suggestions.length === 1)).toHaveLength(67);
    expect(maps.filter((m: Mapping) => m.draft === false && m.suggestions.length >= 2)).toHaveLength(73);
    expect(maps.filter((m: Mapping) => m.draft === true && m.suggestions.length === 1)).toHaveLength(281);
    expect(refs).toHaveLength(1261);
    expect(refs.filter((r: SourceReference) => r.verified === true)).toHaveLength(383);
    expect(refs.filter((r: SourceReference) => r.verified === false)).toHaveLength(878);
    expect(clinical).toHaveLength(1256);
  });
});