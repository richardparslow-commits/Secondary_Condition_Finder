import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { loadKnowledgeBase } from "@/lib/kb/load";

type VerificationState = {
  qualifiedHumanCitationReviewRequired: boolean;
  qualifiedHumanCitationReviewDecision: string;
  automaticPromotionAuthorized: boolean;
  mappingApprovalDoesNotEqualCitationVerification: boolean;
};

type SourceRow = {
  sourceId: string;
  status: string;
  verified: boolean;
  pmid: string;
  doi: string;
  canonicalCitation: string;
  verificationState: VerificationState;
};

const root = process.cwd();
const rows = [{"primaryId": "malaria", "targetId": "anemia", "pmid": "30340592", "doi": "10.1186/s12936-018-2509-9", "citation": "White NJ. Anaemia and malaria. Malar J. 2018;17(1):371. PMID 30340592. doi:10.1186/s12936-018-2509-9.", "guard": "Require established malaria and a separately documented anemia phenotype with compatible timing. Do not infer chronic anemia from remote resolved malaria. Preserve nutritional deficiency, blood loss, hemoglobinopathy, chronic kidney disease, marrow disease, hemolysis from other causes, and other competing etiologies."}, {"primaryId": "hiv-aids", "targetId": "peripheral-neuropathy", "pmid": "33226721", "doi": "10.1111/ene.14656", "citation": "Julian T, Rekatsina M, Shafique F, Zis P. Human immunodeficiency virus-related peripheral neuropathy: A systematic review and meta-analysis. Eur J Neurol. 2021;28(4):1420-1431. PMID 33226721. doi:10.1111/ene.14656.", "guard": "Require established HIV/AIDS and a separately diagnosed peripheral-neuropathy phenotype. Distinguish HIV-related disease mechanisms from antiretroviral neurotoxicity and preserve diabetes, alcohol, nutritional deficiency, chemotherapy, compressive neuropathy, opportunistic infection, and other neurologic causes."}, {"primaryId": "myelodysplastic-syndrome", "targetId": "anemia", "pmid": "26404446", "doi": "10.1053/j.seminhematol.2015.06.002", "citation": "Santini V. Anemia as the Main Manifestation of Myelodysplastic Syndromes. Semin Hematol. 2015;52(4):348-356. PMID 26404446. doi:10.1053/j.seminhematol.2015.06.002.", "guard": "Require established myelodysplastic syndrome and separately documented anemia. Do not attribute every anemia automatically to MDS; preserve bleeding, iron/B12/folate deficiency, chronic kidney disease, hemolysis, treatment effects, inflammatory disease, and other marrow disorders."}, {"primaryId": "primary-myelofibrosis", "targetId": "anemia", "pmid": "18947294", "doi": "10.1146/annurev.med.60.041707.160528", "citation": "Abdel-Wahab OI, Levine RL. Primary myelofibrosis: update on definition, pathogenesis, and treatment. Annu Rev Med. 2009;60:233-245. PMID 18947294. doi:10.1146/annurev.med.60.041707.160528.", "guard": "Require established primary myelofibrosis and separately documented anemia. Preserve bleeding, nutritional deficiency, renal disease, hemolysis, treatment effects, coexisting marrow disease, and leukemic transformation as competing or contributing explanations."}, {"primaryId": "heart-transplant-residuals", "targetId": "chronic-kidney-disease", "pmid": "25134671", "doi": "10.1007/s40265-014-0274-9", "citation": "González-Vílchez F, Vázquez de Prada JA. Chronic renal insufficiency in heart transplant recipients: risk factors and management options. Drugs. 2014;74(13):1481-1494. PMID 25134671. doi:10.1007/s40265-014-0274-9.", "guard": "Require an actual heart transplant and separately established post-transplant chronic kidney disease with compatible chronology. Do not infer CKD from transplant status alone. Preserve preexisting CKD, diabetes, hypertension, perioperative acute kidney injury, cardiorenal/hemodynamic factors, rejection-related injury, and other nephrotoxic exposures."}] as const;

describe("mapping expansion ME-8 qualified-human citation verification", () => {
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));
  const sources = JSON.parse(fs.readFileSync(path.join(root, "data/evidence/master-sources.json"), "utf8")) as {
    sources: SourceRow[];
  };

  it("promotes exactly the five approved ME-8 KB references without changing citation identity", () => {
    for (const row of rows) {
      const suggestion = byId.get(row.primaryId)?.suggestions.find((entry) => entry.conditionId === row.targetId);
      expect(suggestion).toBeDefined();
      expect(suggestion?.rank).toBe(2);
      expect(suggestion?.pathwayIntelligence).toBeUndefined();
      expect(suggestion?.rationale).toContain(row.guard);
      expect(suggestion?.sourceReferences).toHaveLength(1);
      const ref = suggestion?.sourceReferences[0];
      expect(ref?.verified).toBe(true);
      expect(ref?.citation).toBe(row.citation);
      expect(ref?.sourceUrl).toBe(`https://pubmed.ncbi.nlm.nih.gov/${row.pmid}/`);
    }
  });

  it("promotes the same five normalized sources to active with approve-as-implemented decisions", () => {
    for (const row of rows) {
      const source = sources.sources.find((entry) => entry.sourceId === `pmid-${row.pmid}`);
      expect(source).toBeDefined();
      if (!source) {
        throw new Error(`Missing normalized source pmid-${row.pmid}`);
      }
      expect(source.status).toBe("active");
      expect(source.verified).toBe(true);
      expect(source.pmid).toBe(row.pmid);
      expect(source.doi.toLowerCase()).toBe(row.doi.toLowerCase());
      expect(source.canonicalCitation).toBe(row.citation);
      expect(source.verificationState).toMatchObject({
        qualifiedHumanCitationReviewRequired: false,
        qualifiedHumanCitationReviewDecision: "approve-as-implemented",
        automaticPromotionAuthorized: false,
        mappingApprovalDoesNotEqualCitationVerification: true,
      });
    }
  });

  it("passes the final citation audit with no verification debt", () => {
    const output = execFileSync(process.execPath, ["scripts/audit-citation-verification.js"], { cwd: root, encoding: "utf8" });
    const result = JSON.parse(output);
    expect(result).toMatchObject({
      references: 276,
      verified: 256,
      retiredVerified: 6,
      verifiedProvenance: 262,
      unverified: 20,
      reviewFindingCount: 0,
      hardFindingCount: 0,
      clinicalEvidenceReferences: 271,
      clinicalEvidenceReferencesWithUrls: 271,
      clinicalEvidenceProvenanceWithUrls: 275,
    });
  });

  it("passes final master-registry parity with no pending source entities", () => {
    const output = execFileSync(process.execPath, ["scripts/audit-master-registry.js"], { cwd: root, encoding: "utf8" });
    const result = JSON.parse(output);
    expect(result).toMatchObject({
      status: "PASS",
      relationships: 268,
      liveSourceReferenceUses: 276,
      verifiedLiveSourceUses: 256,
      pendingVerificationLiveSourceUses: 20,
      activeSourceEntities: 233,
      pendingVerificationSourceEntities: 20,
      activeClinicalSourceEntities: 232,
      pendingClinicalSourceEntities: 20,
      totalSourceEntities: 262,
    });
  });
});
