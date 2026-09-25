import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { loadKnowledgeBase } from "@/lib/kb/load";

const root = process.cwd();
const rows = [{"primaryId": "discoid-lupus", "targetId": "systemic-lupus-erythematosus", "pmid": "41178896", "doi": "10.25122/jml-2025-0141", "citation": "Alharbi A, Alamri O, Afandi A, Arbaeen A, Mirza A, Alahmari A, Alshomrani S, Qashqari M, Alahmadi M, Alharthy S, Kokandi A. Discoid lupus erythematosus and its progression to systemic lupus erythematosus across age groups: a systematic review. J Med Life. 2025;18(9):830-836. PMID 41178896. doi:10.25122/jml-2025-0141."}, {"primaryId": "colorectal-cancer", "targetId": "fecal-incontinence", "pmid": "33277056", "doi": "10.1016/j.ejso.2020.11.136", "citation": "Verkuijl SJ, Jonker JE, Trzpis M, Burgerhof JGM, Broens PMA, Furnée EJB. Functional outcomes of surgery for colon cancer: A systematic review and meta-analysis. Eur J Surg Oncol. 2021;47(5):960-969. PMID 33277056. doi:10.1016/j.ejso.2020.11.136."}, {"primaryId": "hypogonadism", "targetId": "erectile-dysfunction", "pmid": "34856556", "doi": "10.1159/000520135", "citation": "Taniguchi H, Shimada S, Kinoshita H. Testosterone Therapy for Late-Onset Hypogonadism Improves Erectile Function: A Systematic Review and Meta-Analysis. Urol Int. 2022;106(6):539-552. PMID 34856556. doi:10.1159/000520135."}, {"primaryId": "pancreatitis", "targetId": "pancreatic-cancer", "pmid": "35142721", "doi": "10.14309/ctg.0000000000000463", "citation": "Gandhi S, de la Fuente J, Murad MH, Majumder S. Chronic Pancreatitis Is a Risk Factor for Pancreatic Cancer, and Incidence Increases With Duration of Disease: A Systematic Review and Meta-analysis. Clin Transl Gastroenterol. 2022;13(3):e00463. PMID 35142721. doi:10.14309/ctg.0000000000000463."}, {"primaryId": "hypoparathyroidism", "targetId": "chronic-kidney-disease", "pmid": "33599907", "doi": "10.1007/s11154-020-09613-1", "citation": "Gosmanova EO, Houillier P, Rejnmark L, Marelli C, Bilezikian JP. Renal complications in patients with chronic hypoparathyroidism on conventional therapy: a systematic literature review: renal disease in chronic hypoparathyroidism. Rev Endocr Metab Disord. 2021;22(2):297-316. PMID 33599907. doi:10.1007/s11154-020-09613-1."}] as const;

describe("mapping expansion ME-9 qualified-human citation verification", () => {
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("promotes exactly the five approved ME-9 references without semantic or bibliographic change", () => {
    for (const row of rows) {
      const suggestion = byId.get(row.primaryId)?.suggestions.find((entry) => entry.conditionId === row.targetId);
      expect(suggestion).toBeDefined();
      expect(suggestion?.rank).toBe(2);
      expect(suggestion?.sourceReferences).toHaveLength(1);
      const ref = suggestion?.sourceReferences[0];
      expect(ref?.verified).toBe(true);
      expect(ref?.verificationScope).toBe("clinical-evidence");
      expect(ref?.citation).toBe(row.citation);
      expect(ref?.sourceUrl).toContain(`/${row.pmid}/`);
    }
  });

  it("promotes exactly the five normalized ME-9 master sources to active", () => {
    const sources = JSON.parse(fs.readFileSync(path.join(root, "data/evidence/master-sources.json"), "utf8")) as {
      sources: Array<{
        sourceId: string; status: string; verified: boolean; pmid?: string; doi?: string;
        canonicalCitation?: string; verificationState?: Record<string, unknown>;
      }>;
    };
    for (const row of rows) {
      const source = sources.sources.find((entry) => entry.sourceId === `pmid-${row.pmid}`);
      expect(source).toBeDefined();
      expect(source?.status).toBe("active");
      expect(source?.verified).toBe(true);
      expect(source?.pmid).toBe(row.pmid);
      expect(source?.doi?.toLowerCase()).toBe(row.doi.toLowerCase());
      expect(source?.canonicalCitation).toBe(row.citation);
      expect(source?.verificationState).toMatchObject({
        qualifiedHumanCitationReviewRequired: false,
        qualifiedHumanCitationReviewDecision: "approve-as-implemented",
        qualifiedHumanCitationReviewDate: "2026-08-21",
        automaticPromotionAuthorized: false,
        mappingApprovalDoesNotEqualCitationVerification: true,
      });
    }
  });

  it("pins final citation totals with no live verification debt", () => {
    const refs = kb.flatMap((mapping) => mapping.suggestions.flatMap((suggestion) => suggestion.sourceReferences ?? []));
    expect(refs).toHaveLength(1029);
    expect(refs.filter((ref) => ref.verified === true)).toHaveLength(383);
    expect(refs.filter((r) => r.verified === false)).toHaveLength(646);
  });
});
