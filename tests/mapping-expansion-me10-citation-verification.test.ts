import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { loadKnowledgeBase } from "@/lib/kb/load";

const root = process.cwd();
const sources = JSON.parse(
  fs.readFileSync(path.join(root, "data", "evidence", "master-sources.json"), "utf8"),
) as {
  currentState: string;
  lastUpdatedBy: string;
  sources: Array<{
    sourceId: string;
    status: string;
    kind: string;
    pmid?: string;
    doi?: string;
    canonicalCitation?: string;
    verified?: boolean;
    verificationState?: Record<string, unknown>;
  }>;
};

const expected = {"pmid-41905893": {"pmid": "41905893", "doi": "10.1111/jsr.70333", "citation": "Srivali N, De Giacomi F. Obstructive Sleep Apnea in Bronchiectasis: Prevalence, Risk Factors and Clinical Implications-A Systematic Review and Meta-Analysis. J Sleep Res. 2026;35(4):e70333. PMID 41905893. doi:10.1111/jsr.70333."}, "pmid-42511690": {"pmid": "42511690", "doi": "10.3390/ijms27146348", "citation": "Bordoni M, Ciarloni A, Aboud N, Sidori E, Silvetti F, Taccaliti A, Vassallo A, Romeo M, Salvio G, Balercia G. Effects of Treatment with L-Thyroxine on Chronic Urticaria in Subjects with Autoimmune Thyroiditis: A Systematic Review and Meta-Analysis. Int J Mol Sci. 2026;27(14):6348. PMID 42511690. doi:10.3390/ijms27146348."}, "pmid-42141385": {"pmid": "42141385", "doi": "10.1186/s12891-026-09965-w", "citation": "Liu L, Lu J, Wang J, Wang Q, Zhao H, Zhang Y. Pharmacological treatment for Charcot neuroarthropathy: a systematic review. BMC Musculoskelet Disord. 2026;27(1):592. PMID 42141385. doi:10.1186/s12891-026-09965-w."}, "pmid-41546697": {"pmid": "41546697", "doi": "10.1007/s00417-025-07110-2", "citation": "Barbosa LIT, Lima RV, Moreira JLML, Hira S, Arruda MP, Zinher MT, Thomaz S, Del Valle GS. Ocular findings in patients with lyme disease: a systematic review and meta-analysis. Graefes Arch Clin Exp Ophthalmol. 2026;264(4):1101-1110. PMID 41546697. doi:10.1007/s00417-025-07110-2."}, "pmid-41747645": {"pmid": "41747645", "doi": "10.1016/j.smrv.2026.102264", "citation": "Zhang X, Yin W, Ren J, Zhou X, Zha M, Zong Q, Shen Y, Spruyt K, Zhou J. Narcolepsy and metabolic disease: A meta-analytic synthesis. Sleep Med Rev. 2026;87:102264. PMID 41747645. doi:10.1016/j.smrv.2026.102264."}} as const;

describe("ME-10 qualified-human citation verification", () => {
  const kb = loadKnowledgeBase();

  it("promotes exactly the five implemented ME-10 KB references without semantic changes", () => {
    const pairs = [{"primaryId": "bronchiectasis", "targetId": "sleep-apnea", "pmid": "41905893"}, {"primaryId": "thyroiditis", "targetId": "urticaria", "pmid": "42511690"}, {"primaryId": "charcot-arthropathy", "targetId": "osteomyelitis", "pmid": "42141385"}, {"primaryId": "lyme-disease", "targetId": "uveitis", "pmid": "41546697"}, {"primaryId": "narcolepsy", "targetId": "hypertension", "pmid": "41747645"}] as const;
    for (const row of pairs) {
      const mapping = kb.find((entry) => entry.id === row.primaryId);
      const suggestion = mapping?.suggestions.find((entry) => entry.conditionId === row.targetId);
      expect(suggestion?.rank).toBe(2);
      expect(suggestion?.sourceReferences).toHaveLength(1);
      expect(suggestion?.sourceReferences?.[0]?.verified).toBe(true);
      expect(suggestion?.sourceReferences?.[0]?.citation).toContain(`PMID ${row.pmid}`);
      expect(suggestion?.pathwayIntelligence).toBeUndefined();
    }
  });

  it("promotes exactly the five normalized ME-10 master sources to active", () => {
    const selected = sources.sources.filter((source) => Object.prototype.hasOwnProperty.call(expected, source.sourceId));
    expect(selected).toHaveLength(5);
    for (const source of selected) {
      const identity = expected[source.sourceId as keyof typeof expected];
      expect(source.status).toBe("active");
      expect(source.kind).toBe("clinical-evidence");
      expect(source.verified).toBe(true);
      expect(source.pmid).toBe(identity.pmid);
      expect(source.doi?.toLowerCase()).toBe(identity.doi.toLowerCase());
      expect(source.canonicalCitation).toBe(identity.citation);
      expect(source.verificationState).toMatchObject({
        qualifiedHumanCitationReviewRequired: false,
        qualifiedHumanCitationReviewDecision: "approve-as-implemented",
        qualifiedHumanCitationReviewDate: "2026-08-21",
        automaticPromotionAuthorized: false,
        mappingApprovalDoesNotEqualCitationVerification: true,
      });
    }
  });

  it("pins final ME-10 verification totals with no live verification debt", () => {
    const refs = kb.flatMap((mapping) =>
      mapping.suggestions.flatMap((suggestion) => suggestion.sourceReferences ?? []),
    );
    expect(refs).toHaveLength(379);
    expect(refs.filter((reference) => reference.verified === true)).toHaveLength(379);
    expect(refs.filter((reference) => reference.verified === false)).toHaveLength(0);
    expect(sources.sources.filter((source) => source.status === "active")).toHaveLength(346);
    expect(sources.sources.filter((source) => source.status === "pending-verification")).toHaveLength(0);
  });
});
