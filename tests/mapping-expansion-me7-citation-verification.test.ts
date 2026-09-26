import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

type MasterSource = {
  sourceId: string;
  status: string;
  verified: boolean;
  canonicalCitation?: string;
  citationVariants?: string[];
  verificationState?: {
    qualifiedHumanCitationReviewRequired?: boolean;
    qualifiedHumanCitationReviewDecision?: string;
    automaticPromotionAuthorized?: boolean;
    mappingApprovalDoesNotEqualCitationVerification?: boolean;
  };
};

type MasterRelationship = {
  relationshipId: string;
  publicationGuard: {
    structuredGuardText: string | null;
    boundarySource?: string;
  };
};

const rows = [
  {
    "primaryId": "benign-prostatic-hyperplasia",
    "targetId": "urethral-stricture",
    "sourceId": "pmid-37561537",
    "decision": "approve-as-implemented",
    "finalCitation": "Chen F, Chen Y, Zou Y, Wang Y, Wu X, Chen M. Comparison of holmium laser enucleation and transurethral resection of prostate in benign prostatic hyperplasia: a systematic review and meta-analysis. J Int Med Res. 2023;51(8):3000605231190763. PMID 37561537. doi:10.1177/03000605231190763.",
    "implementationCitation": "Chen F, Chen Y, Zou Y, Wang Y, Wu X, Chen M. Comparison of holmium laser enucleation and transurethral resection of prostate in benign prostatic hyperplasia: a systematic review and meta-analysis. J Int Med Res. 2023;51(8):3000605231190763. PMID 37561537. doi:10.1177/03000605231190763.",
    "finalGuard": "Require documented benign prostatic hyperplasia, documented transurethral resection of the prostate (TURP) or holmium laser enucleation of the prostate (HoLEP), and a separately established urethral stricture arising after that procedure with compatible chronology. Do not infer urethral stricture from untreated BPH, lower urinary tract symptoms, or bladder-outlet obstruction alone. Preserve prior urethral instrumentation or trauma, infection, lichen sclerosus, prior pelvic surgery or radiation, and other recognized causes of urethral stricture.",
    "narrowed": false,
    "citationChanged": false
  },
  {
    "primaryId": "q-fever",
    "targetId": "hepatitis",
    "sourceId": "pmid-29543806",
    "decision": "approve-with-narrowing",
    "finalCitation": "Alende-Castro V, Macía-Rodríguez C, Novo-Veleiro I, et al. Q fever in Spain: Description of a new series, and systematic review. PLoS Negl Trop Dis. 2018;12(3):e0006338. PMID 29543806. doi:10.1371/journal.pntd.0006338.",
    "implementationCitation": "Alende-Castro V, Macía-Rodríguez C, Novo-Veleiro I, et al. Q fever in Spain: Description of a new series, and systematic review. PLoS Negl Trop Dis. 2018;12(3):e0006338. PMID 29543806. doi:10.1371/journal.pntd.0006338.",
    "finalGuard": "Require clinically established acute Q fever using appropriate Coxiella burnetii diagnostic evidence and separately established acute hepatitis with compatible timing. Do not generalize this edge to chronic hepatitis, cirrhosis, or an isolated nonspecific liver-enzyme elevation without a compatible acute Q-fever syndrome. Preserve viral hepatitis, alcohol-associated liver disease, metabolic liver disease, autoimmune hepatitis, drug- or toxin-induced injury, ischemic injury, biliary disease, and other hepatic causes.",
    "narrowed": true,
    "citationChanged": false
  },
  {
    "primaryId": "polycythemia-vera",
    "targetId": "pulmonary-hypertension",
    "sourceId": "pmid-37311222",
    "decision": "approve-with-narrowing",
    "finalCitation": "Montani D, Thoré P, Mignard X, et al. Clinical Phenotype and Outcomes of Pulmonary Hypertension Associated with Myeloproliferative Neoplasms: A Population-based Study. Am J Respir Crit Care Med. 2023;208(5):600-612. PMID 37311222. doi:10.1164/rccm.202210-1941OC.",
    "implementationCitation": "Montani D, Thoré P, Mignard X, et al. Clinical Phenotype and Outcomes of Pulmonary Hypertension Associated with Myeloproliferative Neoplasms: A Population-based Study. Am J Respir Crit Care Med. 2023;208(5):600-612. PMID 37311222. doi:10.1164/rccm.202210-1941OC.",
    "finalGuard": "Require confirmed polycythemia vera and separately established precapillary pulmonary hypertension using appropriate hemodynamic evaluation, with classification of chronic thromboembolic pulmonary hypertension versus group-5 PH when applicable. The source is strongest for CTEPH in polycythemia vera/essential thrombocythemia and does not support postcapillary pulmonary hypertension caused by left-heart disease. Do not infer pulmonary hypertension from polycythemia vera, dyspnea, hypoxemia, or an isolated echocardiographic estimate alone. Treat the registry as population-level complication evidence rather than automatic individual causation. Preserve left-heart disease, chronic lung disease or hypoxia, sleep-disordered breathing, unrelated thromboembolic disease, medications, and other recognized pulmonary-hypertension causes.",
    "narrowed": true,
    "citationChanged": false
  },
  {
    "primaryId": "hiatal-hernia",
    "targetId": "gerd",
    "sourceId": "pmid-10482693",
    "decision": "approve-as-implemented",
    "finalCitation": "Fein M, Ritter MP, DeMeester TR, et al. Role of the lower esophageal sphincter and hiatal hernia in the pathogenesis of gastroesophageal reflux disease. J Gastrointest Surg. 1999;3(4):405-410. PMID 10482693. doi:10.1016/S1091-255X(99)80057-2.",
    "implementationCitation": "Fein M, Ritter MP, DeMeester TR, et al. Role of the lower esophageal sphincter and hiatal hernia in the pathogenesis of gastroesophageal reflux disease. J Gastrointest Surg. 1999;3(4):405-410. PMID 10482693. doi:10.1016/S1091-255X(99)80057-2.",
    "finalGuard": "Require a documented hiatal hernia, with the source proposition most directly applicable to a sliding or otherwise physiologically relevant gastroesophageal-junction hernia, and a separately established diagnosis of GERD using appropriate clinical, endoscopic, or reflux-monitoring evidence. Do not infer GERD solely from the presence of a hiatal hernia. Preserve lower-esophageal-sphincter dysfunction, obesity, medications, delayed gastric emptying, dietary or behavioral contributors, prior foregut surgery, and other reflux causes.",
    "narrowed": false,
    "citationChanged": false
  },
  {
    "primaryId": "esophageal-cancer",
    "targetId": "cardiomyopathy",
    "sourceId": "pmid-35289694",
    "decision": "approve-with-narrowing-and-bibliographic-correction",
    "finalCitation": "Astrup Søndergaard MM, Nordsmark M, Sloth Møller D, Melgaard Nielsen K, Poulsen SH. Reduction in myocardial function and oxygen consumption after chemoradiotherapy in patients with esophageal cancer. Acta Oncol. 2022;61(5):566-574. PMID 35289694. doi:10.1080/0284186X.2022.2048068.",
    "implementationCitation": "Søndergaard MMA, Nordsmark M, Møller DS, Nielsen KM, Poulsen SH. Reduction in myocardial function and oxygen consumption after chemoradiotherapy in patients with esophageal cancer. Acta Oncol. 2022;61(5):566-574. PMID 35289694. doi:10.1080/0284186X.2022.2048068.",
    "finalGuard": "Require documented esophageal cancer, actual exposure to thoracic chemoradiotherapy, and a separately established cardiomyopathy diagnosis with compatible post-treatment chronology. Use this source only as evidence that chemoradiotherapy can produce early left-ventricular dysfunction/cardiotoxicity; it does not itself establish cardiomyopathy or individual causation. Do not infer cardiomyopathy from the cancer diagnosis, radiation exposure, a small isolated strain or ejection-fraction change, fatigue, or dyspnea alone. Preserve pre-existing cardiomyopathy or heart failure, ischemic disease, hypertension, valvular disease, arrhythmia, other cardiotoxic therapies, alcohol or toxin exposure, genetic cardiomyopathy, and other recognized myocardial causes.",
    "narrowed": true,
    "citationChanged": true
  }
] as const;
const root = process.cwd();
const sources = JSON.parse(
  fs.readFileSync(path.join(root, "data", "evidence", "master-sources.json"), "utf8"),
) as { sources: MasterSource[] };
const relationships = JSON.parse(
  fs.readFileSync(path.join(root, "data", "evidence", "master-relationships.json"), "utf8"),
) as { relationships: MasterRelationship[] };

describe("ME-7 qualified-human citation verification", () => {
  const kb = loadKnowledgeBase();

  it("promotes exactly the five approved ME-7 references without changing source identity", () => {
    for (const row of rows) {
      const mapping = kb.find((entry) => entry.id === row.primaryId);
      const suggestion = mapping?.suggestions.find((entry) => entry.conditionId === row.targetId);
      const ref = suggestion?.sourceReferences?.[0];
      expect(ref?.verified).toBe(true);
      expect(ref?.citation).toBe(row.finalCitation);

      const source = sources.sources.find((entry) => entry.sourceId === row.sourceId);
      expect(source?.status).toBe("active");
      expect(source?.verified).toBe(true);
      expect(source?.verificationState).toMatchObject({
        qualifiedHumanCitationReviewRequired: false,
        qualifiedHumanCitationReviewDecision: row.decision,
        automaticPromotionAuthorized: false,
        mappingApprovalDoesNotEqualCitationVerification: true,
      });
      expect(source?.canonicalCitation).toBe(row.finalCitation);
    }
  });

  it("applies only the three approved relationship-boundary narrowings", () => {
    for (const row of rows) {
      const relationship = relationships.relationships.find(
        (entry) => entry.relationshipId === `rel-${row.primaryId}-to-${row.targetId}`,
      );
      expect(relationship?.publicationGuard.structuredGuardText).toBe(row.finalGuard);
      if (row.narrowed) {
        expect(relationship?.publicationGuard.boundarySource).toBe(
          "me7-qualified-human-citation-verification",
        );
      } else {
        expect(relationship?.publicationGuard.boundarySource).toBe(
          "approved-me7-implementation-scope",
        );
      }
    }
  });

  it("records the same-source bibliographic correction for PMID 35289694", () => {
    const row = rows.find((entry) => entry.sourceId === "pmid-35289694");
    expect(row?.citationChanged).toBe(true);
    const source = sources.sources.find((entry) => entry.sourceId === "pmid-35289694");
    expect(source?.canonicalCitation).toBe(row?.finalCitation);
    expect(source?.citationVariants).toContain(row?.implementationCitation);
    expect(source?.citationVariants).toContain(row?.finalCitation);
  });

  it("pins the final citation and master-registry state", () => {
    const citationOutput = execFileSync(process.execPath, ["scripts/audit-citation-verification.js"], {
      cwd: root,
      encoding: "utf8",
    });
    const citation = JSON.parse(citationOutput) as {
      references: number;
      verified: number;
      retiredVerified: number;
      verifiedProvenance: number;
      unverified: number;
      reviewFindingCount: number;
      hardFindingCount: number;
    };
    expect(citation).toMatchObject({
      references: 1261,
      verified: 383,
      retiredVerified: 6,
      verifiedProvenance: 389,
      unverified: 878,
      reviewFindingCount: 0,
      hardFindingCount: 0,
    });

    const masterOutput = execFileSync(process.execPath, ["scripts/audit-master-registry.js"], {
      cwd: root,
      encoding: "utf8",
    });
    const master = JSON.parse(masterOutput) as {
      status: string;
      relationships: number;
      liveSourceReferenceUses: number;
      verifiedLiveSourceUses: number;
      pendingVerificationLiveSourceUses: number;
      activeSourceEntities: number;
      pendingVerificationSourceEntities: number;
      activeClinicalSourceEntities: number;
      pendingClinicalSourceEntities: number;
    };
    expect(master).toMatchObject({
      status: "PASS",
      relationships: 716,
      liveSourceReferenceUses: 1261,
      verifiedLiveSourceUses: 383,
      pendingVerificationLiveSourceUses: 878,
      activeSourceEntities: 346,
      pendingVerificationSourceEntities: 778,
      activeClinicalSourceEntities: 345,
      pendingClinicalSourceEntities: 778,
    });
  }, 30000);
});
