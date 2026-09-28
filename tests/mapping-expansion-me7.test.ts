import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

const rows = [
  {
    "primaryId": "benign-prostatic-hyperplasia",
    "targetId": "urethral-stricture",
    "currentTargetId": "chronic-kidney-disease",
    "pmid": "37561537",
    "finalProposition": "Treatment-mediated urethral-stricture risk after TURP or HoLEP performed for documented benign prostatic hyperplasia.",
    "finalGuard": "Require documented benign prostatic hyperplasia, documented transurethral resection of the prostate (TURP) or holmium laser enucleation of the prostate (HoLEP), and a separately established urethral stricture arising after that procedure with compatible chronology. Do not infer urethral stricture from untreated BPH, lower urinary tract symptoms, or bladder-outlet obstruction alone. Preserve prior urethral instrumentation or trauma, infection, lichen sclerosus, prior pelvic surgery or radiation, and other recognized causes of urethral stricture.",
    "finalCitation": "Chen F, Chen Y, Zou Y, Wang Y, Wu X, Chen M. Comparison of holmium laser enucleation and transurethral resection of prostate in benign prostatic hyperplasia: a systematic review and meta-analysis. J Int Med Res. 2023;51(8):3000605231190763. PMID 37561537. doi:10.1177/03000605231190763."
  },
  {
    "primaryId": "q-fever",
    "targetId": "hepatitis",
    "currentTargetId": "gallbladder-disease",
    "pmid": "29543806",
    "finalProposition": "Acute hepatitis as a recognized clinical manifestation of acute Q fever.",
    "finalGuard": "Require clinically established acute Q fever using appropriate Coxiella burnetii diagnostic evidence and separately established acute hepatitis with compatible timing. Do not generalize this edge to chronic hepatitis, cirrhosis, or an isolated nonspecific liver-enzyme elevation without a compatible acute Q-fever syndrome. Preserve viral hepatitis, alcohol-associated liver disease, metabolic liver disease, autoimmune hepatitis, drug- or toxin-induced injury, ischemic injury, biliary disease, and other hepatic causes.",
    "finalCitation": "Alende-Castro V, Macía-Rodríguez C, Novo-Veleiro I, et al. Q fever in Spain: Description of a new series, and systematic review. PLoS Negl Trop Dis. 2018;12(3):e0006338. PMID 29543806. doi:10.1371/journal.pntd.0006338."
  },
  {
    "primaryId": "polycythemia-vera",
    "targetId": "pulmonary-hypertension",
    "currentTargetId": "leukemia",
    "pmid": "37311222",
    "finalProposition": "Hemodynamically established precapillary pulmonary hypertension can occur with myeloproliferative neoplasms; in polycythemia vera the registry evidence is strongest for chronic thromboembolic pulmonary hypertension, while group-5 PH is also represented across the MPN cohort.",
    "finalGuard": "Require confirmed polycythemia vera and separately established precapillary pulmonary hypertension using appropriate hemodynamic evaluation, with classification of chronic thromboembolic pulmonary hypertension versus group-5 PH when applicable. The source is strongest for CTEPH in polycythemia vera/essential thrombocythemia and does not support postcapillary pulmonary hypertension caused by left-heart disease. Do not infer pulmonary hypertension from polycythemia vera, dyspnea, hypoxemia, or an isolated echocardiographic estimate alone. Treat the registry as population-level complication evidence rather than automatic individual causation. Preserve left-heart disease, chronic lung disease or hypoxia, sleep-disordered breathing, unrelated thromboembolic disease, medications, and other recognized pulmonary-hypertension causes.",
    "finalCitation": "Montani D, Thoré P, Mignard X, et al. Clinical Phenotype and Outcomes of Pulmonary Hypertension Associated with Myeloproliferative Neoplasms: A Population-based Study. Am J Respir Crit Care Med. 2023;208(5):600-612. PMID 37311222. doi:10.1164/rccm.202210-1941OC."
  },
  {
    "primaryId": "hiatal-hernia",
    "targetId": "gerd",
    "currentTargetId": "barretts-esophagus",
    "pmid": "10482693",
    "finalProposition": "Physiologically relevant hiatal hernia as an anatomic contributor to objectively established gastroesophageal reflux disease.",
    "finalGuard": "Require a documented hiatal hernia, with the source proposition most directly applicable to a sliding or otherwise physiologically relevant gastroesophageal-junction hernia, and a separately established diagnosis of GERD using appropriate clinical, endoscopic, or reflux-monitoring evidence. Do not infer GERD solely from the presence of a hiatal hernia. Preserve lower-esophageal-sphincter dysfunction, obesity, medications, delayed gastric emptying, dietary or behavioral contributors, prior foregut surgery, and other reflux causes.",
    "finalCitation": "Fein M, Ritter MP, DeMeester TR, et al. Role of the lower esophageal sphincter and hiatal hernia in the pathogenesis of gastroesophageal reflux disease. J Gastrointest Surg. 1999;3(4):405-410. PMID 10482693. doi:10.1016/S1091-255X(99)80057-2."
  },
  {
    "primaryId": "esophageal-cancer",
    "targetId": "cardiomyopathy",
    "currentTargetId": "cardiac-arrhythmia",
    "pmid": "35289694",
    "finalProposition": "Thoracic chemoradiotherapy for esophageal cancer is associated with early left-ventricular functional decline; this source supports a treatment-mediated cardiotoxicity pathway but does not by itself establish cardiomyopathy.",
    "finalGuard": "Require documented esophageal cancer, actual exposure to thoracic chemoradiotherapy, and a separately established cardiomyopathy diagnosis with compatible post-treatment chronology. Use this source only as evidence that chemoradiotherapy can produce early left-ventricular dysfunction/cardiotoxicity; it does not itself establish cardiomyopathy or individual causation. Do not infer cardiomyopathy from the cancer diagnosis, radiation exposure, a small isolated strain or ejection-fraction change, fatigue, or dyspnea alone. Preserve pre-existing cardiomyopathy or heart failure, ischemic disease, hypertension, valvular disease, arrhythmia, other cardiotoxic therapies, alcohol or toxin exposure, genetic cardiomyopathy, and other recognized myocardial causes.",
    "finalCitation": "Astrup Søndergaard MM, Nordsmark M, Sloth Møller D, Melgaard Nielsen K, Poulsen SH. Reduction in myocardial function and oxygen consumption after chemoradiotherapy in patients with esophageal cancer. Acta Oncol. 2022;61(5):566-574. PMID 35289694. doi:10.1080/0284186X.2022.2048068."
  }
] as const;

describe("mapping expansion ME-7", () => {
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the approved five rank-2 relationships with their final verified boundaries", () => {
    for (const row of rows) {
      const mapping = byId.get(row.primaryId);
      expect(mapping).toBeDefined();
      expect(mapping?.draft).toBe(false);
      expect(mapping?.suggestions).toHaveLength(2);
      expect(mapping?.suggestions[0]?.conditionId).toBe(row.currentTargetId);
      expect(mapping?.suggestions[0]?.rank).toBe(1);
      const added = mapping?.suggestions.find((entry) => entry.conditionId === row.targetId);
      expect(added?.rank).toBe(2);
      expect(added?.nexusClaim?.nexusClassification).toBeDefined(); expect(added?.evidentiaryProfile?.etiologicalConsensus).toBeDefined();
      expect(added?.pathwayIntelligence).toBeUndefined();
      expect(added?.rationale).toContain(row.finalProposition);
      expect(added?.rationale).toContain(row.finalGuard);
    }
  });

  it("records all five ME-7 clinical references as qualified-human verified", () => {
    for (const row of rows) {
      const added = byId.get(row.primaryId)?.suggestions.find((entry) => entry.conditionId === row.targetId);
      expect(added?.sourceReferences).toHaveLength(1);
      const source = added?.sourceReferences[0];
      expect(source?.verified).toBe(true);
      expect(source?.verificationScope).toBe("clinical-evidence");
      expect(source?.sourceUrl).toContain(`/` + row.pmid + `/`);
      expect(source?.citation).toBe(row.finalCitation);
    }
  });

  it("keeps the published matrix at P1 86 / P2+ 53", () => {
    const published = kb.filter((mapping) => mapping.draft === false);
    expect(published).toHaveLength(140);
    expect(published.filter((mapping) => mapping.suggestions.length === 1)).toHaveLength(67);
    expect(published.filter((mapping) => mapping.suggestions.length >= 2)).toHaveLength(73);
  });

  it("pins the exact ME-7 final citation totals", () => {
    const refs = kb.flatMap((mapping) => mapping.suggestions.flatMap((suggestion) => suggestion.sourceReferences ?? []));
expect(refs).toHaveLength(1523);
    expect(refs.filter((source) => source.verified === true)).toHaveLength(383);
expect(refs.filter((r) => r.verified === false)).toHaveLength(1140);
  });
});
