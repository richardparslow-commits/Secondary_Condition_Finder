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
    "primaryId": "anxiety-disorder",
    "targetId": "depressive-disorder",
    "pmid": "17548747",
    "rank": 1,
    "guard": "Require independently established generalized anxiety disorder and separately established major depressive disorder. The cited prospective birth cohort found cumulative and roughly symmetric sequential comorbidity, with depression onset first, anxiety onset first, and concurrent onset each occurring in about one third of comorbid cases; do not treat either disorder as reliably primary in onset order. Preserve other psychiatric illness, substance use, medical illness, medications, psychosocial stressors, and shared vulnerability as competing explanations. Treat this only as population-level comorbidity association, not proof that generalized anxiety disorder caused an individual's depressive disorder."
  },
  {
    "primaryId": "panic-disorder",
    "targetId": "agoraphobia",
    "pmid": "16585471",
    "rank": 1,
    "guard": "Require independently documented panic disorder and separately established agoraphobia; under DSM-5 these are distinct diagnoses and agoraphobia must not be inferred from panic attacks or panic disorder alone. The cited nationally representative survey found that most lifetime panic disorder cases did not carry agoraphobia; do not present co-occurrence as inevitable progression. Preserve other anxiety disorders, depressive disorders, substance use, medical causes of episodic symptoms, and avoidance attributable to other conditions as competing explanations. Treat this only as population-level co-occurrence risk, not proof that panic disorder caused an individual's agoraphobia."
  },
  {
    "primaryId": "ocd",
    "targetId": "depressive-disorder",
    "pmid": "18725912",
    "rank": 2,
    "guard": "Require independently established obsessive-compulsive disorder and separately established depressive disorder; the cited nationally representative survey reported substantial comorbidity of OCD with mood disorders as a class and does not establish onset order or direction. Preserve other anxiety disorders, substance use, medical illness, medications, and shared vulnerability as competing explanations. Do not infer a depressive disorder from OCD symptoms or distress alone, and do not treat this population-level association as proof that OCD caused an individual's depressive disorder."
  },
  {
    "primaryId": "binge-eating-disorder",
    "targetId": "depressive-disorder",
    "pmid": "16815322",
    "rank": 1,
    "guard": "Require independently established binge eating disorder and separately established depressive disorder; the cited nationally representative survey found eating disorders significantly comorbid with many other DSM-IV disorders without establishing direction of onset. Preserve obesity and metabolic disease, other eating pathology, substance use, medications, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from binge eating symptoms, weight change, or role impairment alone, and do not treat this population-level association as proof that binge eating disorder caused an individual's depressive disorder."
  },
  {
    "primaryId": "bipolar-disorder",
    "targetId": "anxiety-disorder",
    "pmid": "17485606",
    "rank": 1,
    "guard": "Require independently established bipolar disorder and a separately established anxiety disorder diagnosis; the cited nationally representative survey reported lifetime comorbidity of bipolar spectrum disorder with other Axis I disorders, particularly anxiety disorders as a class, and does not specify onset order or direction. Distinguish an independent anxiety disorder from anxiety symptoms occurring within manic, hypomanic, or depressive episodes. Preserve substance use, medical illness, medications, and other psychiatric illness as competing explanations. Treat this only as population-level comorbidity association, not proof that bipolar disorder caused an individual's anxiety disorder."
  }
];
const load = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

describe("Mapping Expansion ME-15 local implementation", () => {
  it("adds exactly five bounded mental-disorder relationships while preserving each live publication state", () => {
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

  it("preserves five draft-primary relationships and records five verified active master sources with exact guards", () => {
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

  it("pins the ME-15 citation-verified aggregate state", () => {
    const maps = fs.readdirSync(path.join(ROOT, "data", "knowledge-base")).filter((f) => f.endsWith(".json")).map((f) => load<Mapping>(path.join(ROOT, "data", "knowledge-base", f)));
    const refs = maps.flatMap((m: Mapping) => m.suggestions.flatMap((s: Suggestion) => s.sourceReferences || []));
    const clinical = refs.filter((r: SourceReference) => r.verificationScope === "clinical-evidence");
    expect(maps.reduce((n: number, m: Mapping) => n + m.suggestions.length, 0)).toBe(744);
    expect(maps.filter((m: Mapping) => m.draft === false && m.suggestions.length === 1)).toHaveLength(67);
    expect(maps.filter((m: Mapping) => m.draft === false && m.suggestions.length >= 2)).toHaveLength(73);
    expect(maps.filter((m: Mapping) => m.draft === true && m.suggestions.length === 1)).toHaveLength(291);
    expect(refs).toHaveLength(1330);
    expect(refs.filter((r: SourceReference) => r.verified === true)).toHaveLength(383);
    expect(refs.filter((r: SourceReference) => r.verified === false)).toHaveLength(947);
    expect(clinical).toHaveLength(1325);
  });
});
