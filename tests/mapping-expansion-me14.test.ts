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
    "primaryId": "hidradenitis-suppurativa",
    "targetId": "depressive-disorder",
    "pmid": "40737006",
    "guard": "Require independently established hidradenitis suppurativa before first-onset depressive disorder; do not use this proposition for depression predating hidradenitis suppurativa. Preserve obesity, smoking, substance use, socioeconomic factors, other psychiatric illness, chronic-pain burden, treatment effects, and other competing explanations. Treat this only as population-level temporal risk, not proof that hidradenitis suppurativa caused an individual depressive disorder.",
    "draft": true,
    "publicationState": "draft"
  },
  {
    "primaryId": "varicose-veins",
    "targetId": "deep-vein-thrombosis",
    "pmid": "29486040",
    "guard": "Require varicose veins preceding a newly established deep-vein thrombosis and exclude preexisting deep-vein thrombosis. Explicitly assess recent venous surgery or endovenous procedures, prior venous thromboembolism, thrombophilia, malignancy, immobilization, pregnancy or estrogen exposure, trauma or surgery, age, obesity, and other thrombotic risks. Do not publish or present this relationship as proof that varicose veins caused the deep-vein thrombosis.",
    "draft": true,
    "publicationState": "draft"
  },
  {
    "primaryId": "maxillofacial-fracture",
    "targetId": "mandibular-nonunion",
    "pmid": "34314633",
    "guard": "Apply the broader maxillofacial-fracture identity only when the documented fracture specifically involves the mandible. Require separately established mandibular nonunion after that fracture. Do not infer mandibular nonunion from another facial fracture or from uncomplicated fracture healing. Preserve open-fracture status, infection, diabetes, alcohol use, treatment delay or fixation problems, osteonecrosis, metabolic bone disease, and other causes as competing explanations.",
    "draft": true,
    "publicationState": "draft"
  },
  {
    "primaryId": "nontoxic-thyroid-enlargement",
    "targetId": "hypoparathyroidism",
    "pmid": "27256349",
    "guard": "Require multinodular nontoxic thyroid enlargement plus documented total or near-total thyroid surgery followed by separately documented postoperative hypoparathyroidism. The supported proposition is transient postoperative hypoparathyroidism; do not infer permanent hypoparathyroidism, and do not infer hypoparathyroidism from the thyroid enlargement itself. Preserve other neck surgery, autoimmune or genetic parathyroid disease, magnesium disorders, and other etiologies as competing explanations.",
    "draft": true,
    "publicationState": "draft"
  },
  {
    "primaryId": "rem-sleep-disorder",
    "targetId": "parkinsons-disease",
    "pmid": "20083800",
    "guard": "Require polysomnography-confirmed isolated or idiopathic REM sleep behavior disorder before Parkinson disease, with no Parkinsonism or dementia at the REM sleep behavior disorder baseline and a later independently established Parkinson disease diagnosis. State explicitly that REM sleep behavior disorder is a prodromal marker or risk state, not a cause of Parkinson disease, that many patients do not convert during observed follow-up, and that dementia with Lewy bodies and multiple system atrophy are alternative phenoconversion outcomes.",
    "draft": false,
    "publicationState": "published"
  }
];
const load = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

describe("Mapping Expansion ME-14 local implementation", () => {
  it("adds exactly five rank-1 relationships while preserving each live publication state", () => {
    for (const row of rows) {
      const mapping = load<Mapping>(path.join(ROOT, "data", "knowledge-base", `${row.primaryId}.json`));
      expect(mapping.draft).toBe(row.draft);
      const hits = mapping.suggestions.filter((s: Suggestion) => s.conditionId === row.targetId);
      expect(hits).toHaveLength(1);
      expect(hits[0]!.rank).toBe(1);
      expect(hits[0]!.nexusClaim?.nexusClassification).toBeDefined(); expect(hits[0]!.evidentiaryProfile?.etiologicalConsensus).toBeDefined();
      expect(hits[0]!.pathwayIntelligence).toBeUndefined();
      const refs = hits[0]!.sourceReferences.filter((r: SourceReference) => r.citation?.includes(`PMID ${row.pmid}`));
      expect(refs).toHaveLength(1);
      expect(refs[0]!.verified).toBe(true);
      expect(refs[0]!.verificationScope).toBe("clinical-evidence");
    }
  });

  it("preserves five publication-state-preserved relationships and records five verified active sources with exact guards", () => {
    const rel = load<RelationshipRegistry>(path.join(ROOT, "data", "evidence", "master-relationships.json"));
    const src = load<SourceRegistry>(path.join(ROOT, "data", "evidence", "master-sources.json"));
    expect(rel.baselineCommit).toBe("ea005e50ccbc30800dd46f3872f764f98e977c1f");
    expect(rel.currentState).toBe("D1-DRAFT-AUTHORED");
    expect(src.baselineCommit).toBe("ea005e50ccbc30800dd46f3872f764f98e977c1f");
    expect(src.currentState).toBe("D1-DRAFT-AUTHORED");
    for (const row of rows) {
      const rr = rel.relationships.filter((r: RelationshipRecord) => r.relationshipId === `rel-${row.primaryId}-to-${row.targetId}`);
      expect(rr).toHaveLength(1);
      expect(rr[0]!.primaryPublicationState).toBe(row.publicationState);
      expect(rr[0]!.rank).toBe(1);
      expect(rr[0]!.publicationGuard.structuredGuardText).toBe(row.guard);
      const ss = src.sources.filter((s: SourceRecord) => s.sourceId === `pmid-${row.pmid}`);
      expect(ss).toHaveLength(1);
      expect(ss[0]!.status).toBe("active");
      expect(ss[0]!.verified).toBe(true);
    }
  });

  it("pins the ME-14 citation-verified aggregate state", () => {
    const maps = fs.readdirSync(path.join(ROOT, "data", "knowledge-base")).filter((f) => f.endsWith(".json")).map((f) => load<Mapping>(path.join(ROOT, "data", "knowledge-base", f)));
    const refs = maps.flatMap((m: Mapping) => m.suggestions.flatMap((s: Suggestion) => s.sourceReferences || []));
    const clinical = refs.filter((r: SourceReference) => r.verificationScope === "clinical-evidence");
    expect(maps.reduce((n: number, m: Mapping) => n + m.suggestions.length, 0)).toBe(863);
    expect(maps.filter((m: Mapping) => m.draft === false && m.suggestions.length === 1)).toHaveLength(67);
    expect(maps.filter((m: Mapping) => m.draft === false && m.suggestions.length >= 2)).toHaveLength(73);
    expect(maps.filter((m: Mapping) => m.draft === true && m.suggestions.length === 1)).toHaveLength(305);
    expect(refs).toHaveLength(1672);
    expect(refs.filter((r: SourceReference) => r.verified === true)).toHaveLength(384);
    expect(refs.filter((r: SourceReference) => r.verified === false)).toHaveLength(1288);
    expect(clinical).toHaveLength(1667);
  });
});
