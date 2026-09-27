import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type SourceReference = { citation?: string; verified: boolean; verificationScope?: string };
type Suggestion = { conditionId: string; rank: number; nexusClaim: { nexusClassification: string; } | undefined;
  evidentiaryProfile: { etiologicalConsensus: string; } | undefined; causalMechanism?: { hypothesizedOnly?: boolean }; pathwayIntelligence?: unknown; sourceReferences: SourceReference[] };
type Mapping = { draft: boolean; suggestions: Suggestion[] };
type RelationshipRecord = { relationshipId: string; primaryPublicationState: string; rank: number; publicationGuard: { structuredGuardText: string } };
type RelationshipRegistry = { baselineCommit: string; currentState: string; relationships: RelationshipRecord[] };
type SourceRecord = { sourceId: string; status: string; verified: boolean };
type SourceRegistry = { baselineCommit: string; currentState: string; sources: SourceRecord[] };
const ROOT = process.cwd();
const rows = [
  {
    "primaryId": "traumatic-brain-injury-residuals",
    "targetId": "depressive-disorder",
    "pmid": "25038422",
    "rank": 1,
    "guard": "Require documented residuals of adult non-penetrating traumatic brain injury and a separately established depressive disorder; the cited meta-analysis reported that 27% of adults were diagnosed with major depressive disorder or dysthymia following non-penetrating TBI and 38% reported clinically significant depressive symptoms, without establishing onset order, direction, or individual causation. Preserve pre-existing mood disorder, substance use, concurrent post-traumatic stress or other anxiety disorder, medications, sleep disorders, chronic pain, and endocrine disturbance as competing explanations. Do not infer a depressive disorder from transient mood symptoms, post-concussive complaints, or cognitive symptoms alone, and do not treat this population-level association as proof that traumatic brain injury caused an individual's depressive disorder."
  },
  {
    "primaryId": "allergic-rhinitis",
    "targetId": "asthma",
    "pmid": "31660100",
    "rank": 1,
    "guard": "Require documented allergic rhinitis and separately established asthma before presenting the relationship; the cited systematic review and meta-analysis reported that a history of allergic rhinitis is strongly associated with increased risk of asthma, consistent with the united-airway/allergic-march concept, without establishing that allergic rhinitis caused an individual's asthma. Preserve other asthma triggers (viral infection, occupational exposures, exercise, irritants, gastroesophageal reflux) and other rhinitis phenotypes (non-allergic, vasomotor, mixed) as competing explanations. Do not infer asthma from rhinitis symptoms, spirometry in isolation, or self-reported wheeze alone."
  },
  {
    "primaryId": "diabetic-nephropathy",
    "targetId": "chronic-kidney-disease",
    "pmid": "36272764",
    "rank": 1,
    "guard": "Require established diabetic nephropathy (documented albuminuria and/or persistent eGFR decline in a person with diabetes with a compatible phenotype) and separately documented chronic kidney disease; the cited KDIGO clinical practice guideline addresses diabetes management in chronic kidney disease and recognizes diabetic kidney disease as a leading cause of chronic kidney disease, without establishing that any individual's chronic kidney disease is diabetic in origin. Preserve hypertensive, ischemic/renovascular, obstructive, primary glomerular, interstitial, and other chronic kidney disease etiologies as competing explanations. Do not infer diabetic nephropathy from isolated creatinine elevation or from diabetes alone, and do not treat this guideline-framed association as proof that diabetic nephropathy caused an individual's chronic kidney disease."
  },
  {
    "primaryId": "menstrual-disorders",
    "targetId": "anemia",
    "pmid": "37538011",
    "rank": 1,
    "guard": "Require documented abnormal uterine bleeding/heavy menstrual bleeding and objective iron-deficiency anemia (hemoglobin and/or ferritin compatible with iron deficiency) with compatible chronology; the cited review frames heavy menstrual bleeding as the most common cause of iron deficiency and iron deficiency anemia among reproductive-age women without establishing that an individual's anemia is menstrual in origin. Preserve gastrointestinal blood loss, malabsorption, dietary iron deficiency, chronic disease or inflammatory anemia, hemolysis, renal disease, and other gynecologic causes as competing explanations. Do not infer anemia from bleeding history alone, and do not treat this population-level association as proof that menstrual bleeding caused an individual's anemia."
  },
  {
    "primaryId": "oral-lichen-planus-lichenoid-lesions",
    "targetId": "oral-cancer",
    "pmid": "28438300",
    "rank": 1,
    "guard": "Require biopsy-documented oral lichen planus or oral lichenoid lesion and separately established oral squamous cell carcinoma with compatible chronology; the cited meta-analysis of 20,095 patients reported a low but nonzero rate of malignant transformation of oral lichen planus and oral lichenoid lesions without establishing that any individual's cancer arose from the lichenoid lesion. Preserve tobacco use, alcohol use, other premalignant lesions (leukoplakia, erythroplakia), HPV infection, immunocompromise, and other oral-cancer risk factors as competing explanations. Do not infer cancer from clinical appearance or from dysplasia alone, and do not treat this population-level association as proof that oral lichen planus caused an individual's oral cancer."
  },
];
const load = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

describe("Mapping Expansion ME-19 local implementation", () => {
  it("adds exactly five bounded draft relationships while preserving each live publication state", () => {
    for (const row of rows) {
      const mapping = load<Mapping>(path.join(ROOT, "data", "knowledge-base", `${row.primaryId}.json`));
      expect(mapping.draft).toBe(true);
      const hits = mapping.suggestions.filter((s: Suggestion) => s.conditionId === row.targetId);
      expect(hits).toHaveLength(1);
      expect(hits[0]!.rank).toBe(row.rank);
      expect(hits[0]!.nexusClaim?.nexusClassification).toBe("ASSOCIATION_ONLY");
      expect(hits[0]!.nexusClaim?.nexusClassification).toBeDefined();
      expect(hits[0]!.evidentiaryProfile?.etiologicalConsensus).toBe("NOT_ESTABLISHED");
      expect(hits[0]!.evidentiaryProfile?.etiologicalConsensus).toBeDefined();
      expect(hits[0]!.causalMechanism?.hypothesizedOnly).toBe(true);
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

  it("pins the ME-19 pre-citation-verification aggregate state", () => {
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