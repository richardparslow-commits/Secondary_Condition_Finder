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
    "primaryId": "pheochromocytoma",
    "targetId": "hypertension",
    "pmid": "24893135",
    "rank": 1,
    "guard": "Require a diagnosed pheochromocytoma (biochemically confirmed catecholamine excess with compatible imaging or histology) and separately established hypertension with compatible chronology; the cited Endocrine Society clinical practice guideline identifies paroxysmal or sustained hypertension as the most common clinical presentation of pheochromocytoma and paraganglioma, without establishing that pheochromocytoma caused an individual's sustained hypertension as opposed to paroxysmal episodes or unrelated essential hypertension. Preserve essential (primary) hypertension, renal and renovascular hypertension, other endocrine causes (primary aldosteronism, thyroid disease, Cushing syndrome), obstructive sleep apnea, medications and substances, and pre-existing hypertension antedating tumor development as competing explanations. Do not infer pheochromocytoma from episodic blood-pressure elevation or from hypertension alone, and do not treat this guideline-framed association as proof that pheochromocytoma caused an individual's hypertensive disease."
  },
  {
    "primaryId": "sjogren-s-syndrome",
    "targetId": "dry-eye-syndrome",
    "pmid": "41009391",
    "rank": 1,
    "guard": "Require an established diagnosis of Sjögren's syndrome and objective evidence of dry eye disease/keratoconjunctivitis sicca (for example Schirmer testing, tear-film break-up time, or ocular surface staining) with compatible chronology; the cited review reports that keratoconjunctivitis sicca affects up to 95% of patients with Sjögren disease and is often the earliest and most persistent manifestation, driven by autoimmune-mediated lacrimal gland dysfunction, without establishing that Sjögren's syndrome caused an individual's dry eye as opposed to other causes of aqueous-deficient or evaporative dry eye. Preserve meibomian gland dysfunction, environmental and medication-related dry eye, age-related tear-film changes, contact lens wear, prior ocular surgery, and other autoimmune or ocular-surface conditions as competing explanations. Do not infer Sjögren's syndrome from dry eye symptoms alone, and do not treat this population-level association as proof that Sjögren's syndrome caused an individual's dry eye disease."
  },
  {
    "primaryId": "leukoplakia",
    "targetId": "oral-cancer",
    "pmid": "26189354",
    "rank": 1,
    "guard": "Require a biopsy-documented oral leukoplakia and separately established oral squamous cell carcinoma with compatible chronology; the cited systematic review of observational studies reported that a meaningful proportion of oral leukoplakias undergo malignant transformation to oral squamous cell carcinoma, without establishing that any individual's cancer arose from the leukoplakic lesion. Preserve tobacco use, alcohol use, other potentially malignant disorders (erythroplakia, oral submucous fibrosis), HPV infection, immunocompromise, and other oral-cancer risk factors as competing explanations. Do not infer cancer from clinical appearance or from dysplasia alone, and do not treat this population-level association as proof that oral leukoplakia caused an individual's oral cancer."
  },
  {
    "primaryId": "erythroplakia",
    "targetId": "oral-cancer",
    "pmid": "35488780",
    "rank": 1,
    "guard": "Require a biopsy-documented oral erythroplakia and separately established oral squamous cell carcinoma with compatible chronology; the cited systematic review and meta-analysis reported an overall malignant development rate of oral erythroplakia of 19.9%, without establishing that any individual's cancer arose from the erythroplakic lesion. Preserve tobacco use, alcohol use, other potentially malignant disorders (leukoplakia, oral submucous fibrosis), HPV infection, immunocompromise, and other oral-cancer risk factors as competing explanations. Do not infer cancer from clinical appearance or from dysplasia alone, and do not treat this population-level association as proof that oral erythroplakia caused an individual's oral cancer."
  },
  {
    "primaryId": "meningitis",
    "targetId": "hearing-loss",
    "pmid": "24618106",
    "rank": 1,
    "guard": "Require an established bacterial meningitis episode with compatible chronology and separately documented hearing loss; the cited tertiary-referral study of children treated for bacterial meningitis found sensorineural hearing loss highly prevalent following the infection, without establishing that an individual's hearing loss was meningitic in origin. Preserve ototoxic medications (including aminoglycosides used to treat the meningitis), suppurative otitis media or labyrinthitis, congenital or pre-existing hearing loss, ototoxic systemic illness, and noise exposure as competing explanations. Do not infer hearing loss from meningitis history alone, and do not treat this clinical-sample association as proof that meningitis caused an individual's hearing loss."
  },
];
const load = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

describe("Mapping Expansion ME-20 local implementation", () => {
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

  it("pins the ME-20 pre-citation-verification aggregate state", () => {
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