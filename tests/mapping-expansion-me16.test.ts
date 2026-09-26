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
    "primaryId": "bulimia-nervosa",
    "targetId": "depressive-disorder",
    "pmid": "21383252",
    "rank": 1,
    "guard": "Require independently established bulimia nervosa and separately established depressive disorder; the cited nationally representative adolescent survey reported substantial bulimia nervosa comorbidity with mood disorders without establishing onset order or direction, and its adolescent sample should not be overgeneralized to adult populations. Preserve obesity and metabolic disease, other eating pathology, substance use, medications, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from eating-disorder symptoms, weight concern, or role impairment alone, and do not treat this population-level association as proof that bulimia nervosa caused an individual's depressive disorder."
  },
  {
    "primaryId": "specific-phobia",
    "targetId": "depressive-disorder",
    "pmid": "28222820",
    "rank": 1,
    "guard": "Require independently diagnosed specific phobia and separately established depressive disorder; the cited cross-national survey reported specific phobia comorbidity with other mental disorders and does not establish onset order or direction. Preserve other anxiety disorders, depressive disorders, substance use, medical causes of episodic symptoms, and avoidance attributable to other conditions as competing explanations. Do not infer a depressive disorder from phobic avoidance, distress, or impairment alone, and do not treat this population-level association as proof that specific phobia caused an individual's depressive disorder."
  },
  {
    "primaryId": "hoarding-disorder",
    "targetId": "depressive-disorder",
    "pmid": "24158881",
    "rank": 1,
    "guard": "Require independently established DSM-5 hoarding disorder and separately established depressive disorder; the cited community study reported elevated comorbidity of hoarding disorder with mood and anxiety disorders and does not establish onset order or direction. Preserve other psychiatric illness, substance use, medical illness, medications, shared vulnerability, and disorganization or collecting behavior attributable to other conditions as competing explanations. Do not infer a depressive disorder from hoarding-related distress or impairment alone, and do not treat this population-level association as proof that hoarding disorder caused an individual's depressive disorder."
  },
  {
    "primaryId": "body-dysmorphic-disorder",
    "targetId": "depressive-disorder",
    "pmid": "16893571",
    "rank": 1,
    "guard": "Require independently established body dysmorphic disorder and separately established major depressive disorder; the cited clinical sample reported high lifetime comorbidity of body dysmorphic disorder with major depressive disorder and does not establish onset order or direction. Preserve eating disorders, OCD-spectrum conditions, social anxiety disorder, substance use, and other psychiatric illness as competing explanations. Do not infer a depressive disorder from appearance-preoccupation distress or impairment alone, and do not treat this clinical-sample association as proof that body dysmorphic disorder caused an individual's depressive disorder."
  },
  {
    "primaryId": "agoraphobia",
    "targetId": "depressive-disorder",
    "pmid": "27775828",
    "rank": 1,
    "guard": "Require independently documented DSM-5 agoraphobia and separately established depressive disorder; under DSM-5 agoraphobia is distinct from panic disorder and must not be inferred from panic attacks or panic disorder alone. The cited cross-national survey reported agoraphobia comorbidity with depressive and other disorders without establishing onset order or direction. Preserve other anxiety disorders, depressive disorders, substance use, medical causes of episodic symptoms, and avoidance attributable to other conditions as competing explanations. Do not present co-occurrence as inevitable progression, and do not treat this population-level association as proof that agoraphobia caused an individual's depressive disorder."
  },
];
const load = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

describe("Mapping Expansion ME-16 local implementation", () => {
  it("adds exactly five bounded draft mental-disorder relationships while preserving each live publication state", () => {
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

  it("pins the ME-16 pre-citation-verification aggregate state", () => {
    const maps = fs.readdirSync(path.join(ROOT, "data", "knowledge-base")).filter((f) => f.endsWith(".json")).map((f) => load<Mapping>(path.join(ROOT, "data", "knowledge-base", f)));
    const refs = maps.flatMap((m: Mapping) => m.suggestions.flatMap((s: Suggestion) => s.sourceReferences || []));
    const clinical = refs.filter((r: SourceReference) => r.verificationScope === "clinical-evidence");
    expect(maps.reduce((n: number, m: Mapping) => n + m.suggestions.length, 0)).toBe(646);
    expect(maps.filter((m: Mapping) => m.draft === false && m.suggestions.length === 1)).toHaveLength(67);
    expect(maps.filter((m: Mapping) => m.draft === false && m.suggestions.length >= 2)).toHaveLength(73);
    expect(maps.filter((m: Mapping) => m.draft === true && m.suggestions.length === 1)).toHaveLength(267);
    expect(refs).toHaveLength(1101);
    expect(refs.filter((r: SourceReference) => r.verified === true)).toHaveLength(383);
    expect(refs.filter((r: SourceReference) => r.verified === false)).toHaveLength(718);
    expect(clinical).toHaveLength(1096);
  });
});
