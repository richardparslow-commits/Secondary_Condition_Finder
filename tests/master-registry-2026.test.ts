import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type PublicationGuard = {
  status: string;
  structuredGuardText: string | null;
  boundaryText?: string;
  structuredGuardReviewPending: boolean;
};
type RelationshipRow = {
  relationshipId: string;
  publicationGuard: PublicationGuard;
};
type RelationshipRegistry = {
  status: string;
  baselineCommit: string;
  counts: {
    relationships: number;
    explicitPublicationGuards: number;
    legacyRationaleBoundaries: number;
  };
  relationships: RelationshipRow[];
};
type SourceRow = {
  sourceId: string;
  status: string;
  kind?: string;
  verified?: boolean;
  liveUsageCount?: number;
  pmid?: string;
  doi?: string;
  canonicalCitation?: string;
  canonicalSourceUrl?: string;
  verificationState?: {
    qualifiedHumanCitationReviewRequired?: boolean;
    qualifiedHumanCitationReviewDecision?: string;
    automaticPromotionAuthorized?: boolean;
    mappingApprovalDoesNotEqualCitationVerification?: boolean;
  };
};
type SourceRegistry = {
  status: string;
  baselineCommit: string;
  counts: {
    liveSourceReferenceUses: number;
    activeSourceEntities: number;
    pendingVerificationSourceEntities: number;
    activeClinicalSourceEntities: number;
    pendingClinicalSourceEntities: number;
    activeLegalAuthorityEntities: number;
    retiredOnlySourceEntities: number;
    supersededUnverifiedSourceEntities: number;
    bibliographicCorrectionOnlyEntities: number;
    totalSourceEntitiesIncludingLineage: number;
    retiredVerifiedRelationshipSourceUses: number;
  };
  sources: SourceRow[];
};
type AuditResult = {
  status: string;
  relationships: number;
  liveSourceReferenceUses: number;
  verifiedLiveSourceUses: number;
  pendingVerificationLiveSourceUses: number;
  activeSourceEntities: number;
  pendingVerificationSourceEntities: number;
};

const root = process.cwd();
const relationships = JSON.parse(
  fs.readFileSync(path.join(root, "data", "evidence", "master-relationships.json"), "utf8"),
) as RelationshipRegistry;
const sources = JSON.parse(
  fs.readFileSync(path.join(root, "data", "evidence", "master-sources.json"), "utf8"),
) as SourceRegistry;

describe("Master Relationship & Evidence Registry 2026", () => {
  it("pins the authoritative ME-11 pending-verification registry counts", () => {
    expect(relationships.status).toBe("AUTHORITATIVE-CURRENT-STATE");
    expect(relationships.baselineCommit).toBe("ea005e50ccbc30800dd46f3872f764f98e977c1f");
    expect(relationships.counts).toEqual({
      relationships: 347,
      explicitPublicationGuards: 273,
      legacyRationaleBoundaries: 74,
    });
    expect(sources.status).toBe("AUTHORITATIVE-CURRENT-STATE");
    expect(sources.baselineCommit).toBe("ea005e50ccbc30800dd46f3872f764f98e977c1f");
    expect(sources.counts).toEqual({
      liveSourceReferenceUses: 355,
      activeSourceEntities: 238,
      pendingVerificationSourceEntities: 91,
      activeClinicalSourceEntities: 237,
      pendingClinicalSourceEntities: 91,
      activeLegalAuthorityEntities: 1,
      retiredOnlySourceEntities: 1,
      supersededUnverifiedSourceEntities: 7,
      bibliographicCorrectionOnlyEntities: 1,
      totalSourceEntitiesIncludingLineage: 338,
      retiredVerifiedRelationshipSourceUses: 6,
    });
  });

  it("preserves all 74 legacy rationale boundaries without fabricating guards", () => {
    const legacy = relationships.relationships.filter(
      (row) => row.publicationGuard.status === "legacy-rationale-boundary",
    );
    expect(legacy).toHaveLength(74);
    for (const row of legacy) {
      expect(row.publicationGuard.structuredGuardText).toBeNull();
      expect(row.publicationGuard.boundaryText).toBeTruthy();
      expect(row.publicationGuard.structuredGuardReviewPending).toBe(true);
    }
  });

  it("contains exactly five qualified-human-verified ME-4 clinical sources", () => {
    const ids = new Set(["pmid-28515118", "pmid-32059945", "pmid-37414328", "pmid-38453002", "pmid-41308609"]);
    const selected = sources.sources.filter((source) => ids.has(source.sourceId));
    expect(selected).toHaveLength(5);
    for (const source of selected) {
      expect(source.status).toBe("active");
      expect(source.kind).toBe("clinical-evidence");
      expect(source.verified).toBe(true);
      expect(source.liveUsageCount).toBe(1);
      expect(source.verificationState).toMatchObject({
        qualifiedHumanCitationReviewRequired: false,
        automaticPromotionAuthorized: false,
        mappingApprovalDoesNotEqualCitationVerification: true,
      });
    }
    expect(
      selected.filter((source) => source.status === "pending-verification"),
    ).toHaveLength(0);
  });

  it("contains exactly five qualified-human-verified ME-5 clinical sources", () => {
    const ids = new Set(["pmid-37730081", "pmid-31515657", "pmid-33208169", "pmid-24816764", "pmid-35103762"]);
    const selected = sources.sources.filter((source) => ids.has(source.sourceId));
    expect(selected).toHaveLength(5);
    for (const source of selected) {
      expect(source.status).toBe("active");
      expect(source.kind).toBe("clinical-evidence");
      expect(source.verified).toBe(true);
      expect(source.liveUsageCount).toBe(1);
      expect(source.verificationState).toMatchObject({
        qualifiedHumanCitationReviewRequired: false,
        qualifiedHumanCitationReviewDecision: "approve-as-implemented",
        automaticPromotionAuthorized: false,
        mappingApprovalDoesNotEqualCitationVerification: true,
      });
    }
  });

  it("contains exactly five qualified-human-verified ME-6 clinical sources", () => {
    const ids = new Set(["pmid-29129575", "pmid-29730199", "pmid-27400319", "pmid-31444993", "pmid-12411757"]);
    const selected = sources.sources.filter((source) => ids.has(source.sourceId));
    expect(selected).toHaveLength(5);
    for (const source of selected) {
      expect(source.status).toBe("active");
      expect(source.kind).toBe("clinical-evidence");
      expect(source.verified).toBe(true);
      expect(source.liveUsageCount).toBe(1);
      expect(source.verificationState).toMatchObject({
        qualifiedHumanCitationReviewRequired: false,
        automaticPromotionAuthorized: false,
        mappingApprovalDoesNotEqualCitationVerification: true,
      });
    }
    const decisions = new Map(
      selected.map((source) => [source.sourceId, source.verificationState?.qualifiedHumanCitationReviewDecision]),
    );
    expect(decisions.get("pmid-29129575")).toBe("approve-as-implemented");
    expect(decisions.get("pmid-29730199")).toBe("approve-as-implemented");
    expect(decisions.get("pmid-27400319")).toBe("approve-as-implemented");
    expect(decisions.get("pmid-31444993")).toBe("approve-as-implemented");
    expect(decisions.get("pmid-12411757")).toBe("approve-with-narrowing");

    const narrowed = relationships.relationships.find(
      (row) => row.relationshipId === "rel-chronic-pyelonephritis-to-hypertension",
    );
    expect(narrowed?.publicationGuard.structuredGuardText).toBe(
      'Require documented chronic pyelonephritis only in the presence of objectively established vesicoureteral reflux/reflux nephropathy with renal parenchymal scarring, and require separately established hypertension. Do not generalize this source to chronic pyelonephritis, recurrent urinary infection, or renal scarring without documented reflux nephropathy. Treat the cohort as phenotype-specific risk evidence rather than proof that reflux nephropathy caused hypertension in an individual. Preserve primary hypertension, diabetes, chronic kidney disease from other causes, renal-artery disease, endocrine causes, medications, and other contributors.',
    );
  });


  it("contains exactly five qualified-human-verified ME-7 clinical sources", () => {
    const ids = new Set(["pmid-37561537", "pmid-29543806", "pmid-37311222", "pmid-10482693", "pmid-35289694"]);
    const selected = sources.sources.filter((source) => ids.has(source.sourceId));
    expect(selected).toHaveLength(5);
    for (const source of selected) {
      expect(source.status).toBe("active");
      expect(source.kind).toBe("clinical-evidence");
      expect(source.verified).toBe(true);
      expect(source.liveUsageCount).toBe(1);
      expect(source.verificationState).toMatchObject({
        qualifiedHumanCitationReviewRequired: false,
        automaticPromotionAuthorized: false,
        mappingApprovalDoesNotEqualCitationVerification: true,
      });
    }
    const decisions = new Map(
      selected.map((source) => [source.sourceId, source.verificationState?.qualifiedHumanCitationReviewDecision]),
    );
    expect(decisions.get("pmid-37561537")).toBe("approve-as-implemented");
    expect(decisions.get("pmid-29543806")).toBe("approve-with-narrowing");
    expect(decisions.get("pmid-37311222")).toBe("approve-with-narrowing");
    expect(decisions.get("pmid-10482693")).toBe("approve-as-implemented");
    expect(decisions.get("pmid-35289694")).toBe("approve-with-narrowing-and-bibliographic-correction");

    const qFever = relationships.relationships.find(
      (row) => row.relationshipId === "rel-q-fever-to-hepatitis",
    );
    expect(qFever?.publicationGuard.structuredGuardText).toContain(
      "separately established acute hepatitis with compatible timing",
    );

    const pv = relationships.relationships.find(
      (row) => row.relationshipId === "rel-polycythemia-vera-to-pulmonary-hypertension",
    );
    expect(pv?.publicationGuard.structuredGuardText).toContain(
      "separately established precapillary pulmonary hypertension",
    );

    const esophageal = relationships.relationships.find(
      (row) => row.relationshipId === "rel-esophageal-cancer-to-cardiomyopathy",
    );
    expect(esophageal?.publicationGuard.structuredGuardText).toContain(
      "a separately established cardiomyopathy diagnosis",
    );
  });

  it("records the approved 4-as-implemented / 1-narrowed ME-4 verification decisions", () => {
    const decisions = new Map(
      sources.sources
        .filter((source) =>
          new Set(["pmid-28515118", "pmid-32059945", "pmid-37414328", "pmid-38453002", "pmid-41308609"]).has(source.sourceId),
        )
        .map((source) => [source.sourceId, source.verificationState?.qualifiedHumanCitationReviewDecision]),
    );
    expect(decisions.get("pmid-28515118")).toBe("approve-as-implemented");
    expect(decisions.get("pmid-32059945")).toBe("approve-as-implemented");
    expect(decisions.get("pmid-37414328")).toBe("approve-with-narrowing");
    expect(decisions.get("pmid-38453002")).toBe("approve-as-implemented");
    expect(decisions.get("pmid-41308609")).toBe("approve-as-implemented");

    const uveitis = relationships.relationships.find(
      (row) => row.relationshipId === "rel-uveitis-to-cataracts",
    );
    expect(uveitis?.publicationGuard.structuredGuardText).toBe(
      "Require documented noninfectious anterior uveitis and separately established cataract in the affected eye. Do not infer cataract from uveitis alone. Preserve age, inflammation severity, corticosteroid exposure, prior ocular surgery, glaucoma treatment, and other cataract contributors.",
    );
  });

  it("keeps source lineage states distinct while retaining all active ME-3 sources", () => {
    expect(sources.sources.filter((source) => source.status === "active")).toHaveLength(238);
    expect(sources.sources.filter((source) => source.status === "pending-verification")).toHaveLength(91);
    expect(sources.sources.filter((source) => source.status === "superseded-unverified")).toHaveLength(7);
    expect(sources.sources.filter((source) => source.status === "bibliographic-correction-only")).toHaveLength(1);
    expect(sources.sources.filter((source) => source.status === "retired-only")).toHaveLength(1);
    expect(new Set(sources.sources.map((source) => source.sourceId)).size).toBe(338);
  });


  it("contains exactly five qualified-human-verified ME-8 clinical sources", () => {
    const ids = new Set(["pmid-30340592", "pmid-33226721", "pmid-26404446", "pmid-18947294", "pmid-25134671"]);
    const selected = sources.sources.filter((source) => ids.has(source.sourceId));
    expect(selected).toHaveLength(5);
    for (const source of selected) {
      expect(source.status).toBe("active");
      expect(source.kind).toBe("clinical-evidence");
      expect(source.verified).toBe(true);
      expect(source.liveUsageCount).toBe(1);
      expect(source.verificationState).toMatchObject({
        qualifiedHumanCitationReviewRequired: false,
        qualifiedHumanCitationReviewDecision: "approve-as-implemented",
        automaticPromotionAuthorized: false,
        mappingApprovalDoesNotEqualCitationVerification: true,
      });
    }
  });

  it("keeps supersession provenance out of all 229 explicit publication guards", () => {
    const explicit = relationships.relationships.filter(
      (row) => row.publicationGuard.status === "explicit",
    );
    expect(explicit).toHaveLength(273);
    for (const row of explicit) {
      expect(row.publicationGuard.structuredGuardText).not.toMatch(/supersedes unverified PMID/i);
    }
  });

  it("passes the authoritative ME-27 pending-verification master-registry parity audit", () => {
    const output = execFileSync(process.execPath, ["scripts/audit-master-registry.js"], {
      cwd: root,
      encoding: "utf8",
    });
    const result = JSON.parse(output) as AuditResult;
    expect(result).toMatchObject({
      status: "PASS",
      relationships: 347,
      liveSourceReferenceUses: 355,
      verifiedLiveSourceUses: 261,
      pendingVerificationLiveSourceUses: 94,
      activeSourceEntities: 238,
      pendingVerificationSourceEntities: 91,
    });
  });

  it("contains exactly five qualified-human-verified ME-9 clinical sources", () => {
    const expected = {"pmid-41178896": {"pmid": "41178896", "doi": "10.25122/jml-2025-0141", "citation": "Alharbi A, Alamri O, Afandi A, Arbaeen A, Mirza A, Alahmari A, Alshomrani S, Qashqari M, Alahmadi M, Alharthy S, Kokandi A. Discoid lupus erythematosus and its progression to systemic lupus erythematosus across age groups: a systematic review. J Med Life. 2025;18(9):830-836. PMID 41178896. doi:10.25122/jml-2025-0141."}, "pmid-33277056": {"pmid": "33277056", "doi": "10.1016/j.ejso.2020.11.136", "citation": "Verkuijl SJ, Jonker JE, Trzpis M, Burgerhof JGM, Broens PMA, Furnée EJB. Functional outcomes of surgery for colon cancer: A systematic review and meta-analysis. Eur J Surg Oncol. 2021;47(5):960-969. PMID 33277056. doi:10.1016/j.ejso.2020.11.136."}, "pmid-34856556": {"pmid": "34856556", "doi": "10.1159/000520135", "citation": "Taniguchi H, Shimada S, Kinoshita H. Testosterone Therapy for Late-Onset Hypogonadism Improves Erectile Function: A Systematic Review and Meta-Analysis. Urol Int. 2022;106(6):539-552. PMID 34856556. doi:10.1159/000520135."}, "pmid-35142721": {"pmid": "35142721", "doi": "10.14309/ctg.0000000000000463", "citation": "Gandhi S, de la Fuente J, Murad MH, Majumder S. Chronic Pancreatitis Is a Risk Factor for Pancreatic Cancer, and Incidence Increases With Duration of Disease: A Systematic Review and Meta-analysis. Clin Transl Gastroenterol. 2022;13(3):e00463. PMID 35142721. doi:10.14309/ctg.0000000000000463."}, "pmid-33599907": {"pmid": "33599907", "doi": "10.1007/s11154-020-09613-1", "citation": "Gosmanova EO, Houillier P, Rejnmark L, Marelli C, Bilezikian JP. Renal complications in patients with chronic hypoparathyroidism on conventional therapy: a systematic literature review: renal disease in chronic hypoparathyroidism. Rev Endocr Metab Disord. 2021;22(2):297-316. PMID 33599907. doi:10.1007/s11154-020-09613-1."}} as const;
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

  it("contains exactly five qualified-human-verified ME-10 clinical sources", () => {
    const expected = {"pmid-41905893": {"pmid": "41905893", "doi": "10.1111/jsr.70333", "citation": "Srivali N, De Giacomi F. Obstructive Sleep Apnea in Bronchiectasis: Prevalence, Risk Factors and Clinical Implications-A Systematic Review and Meta-Analysis. J Sleep Res. 2026;35(4):e70333. PMID 41905893. doi:10.1111/jsr.70333."}, "pmid-42511690": {"pmid": "42511690", "doi": "10.3390/ijms27146348", "citation": "Bordoni M, Ciarloni A, Aboud N, Sidori E, Silvetti F, Taccaliti A, Vassallo A, Romeo M, Salvio G, Balercia G. Effects of Treatment with L-Thyroxine on Chronic Urticaria in Subjects with Autoimmune Thyroiditis: A Systematic Review and Meta-Analysis. Int J Mol Sci. 2026;27(14):6348. PMID 42511690. doi:10.3390/ijms27146348."}, "pmid-42141385": {"pmid": "42141385", "doi": "10.1186/s12891-026-09965-w", "citation": "Liu L, Lu J, Wang J, Wang Q, Zhao H, Zhang Y. Pharmacological treatment for Charcot neuroarthropathy: a systematic review. BMC Musculoskelet Disord. 2026;27(1):592. PMID 42141385. doi:10.1186/s12891-026-09965-w."}, "pmid-41546697": {"pmid": "41546697", "doi": "10.1007/s00417-025-07110-2", "citation": "Barbosa LIT, Lima RV, Moreira JLML, Hira S, Arruda MP, Zinher MT, Thomaz S, Del Valle GS. Ocular findings in patients with lyme disease: a systematic review and meta-analysis. Graefes Arch Clin Exp Ophthalmol. 2026;264(4):1101-1110. PMID 41546697. doi:10.1007/s00417-025-07110-2."}, "pmid-41747645": {"pmid": "41747645", "doi": "10.1016/j.smrv.2026.102264", "citation": "Zhang X, Yin W, Ren J, Zhou X, Zha M, Zong Q, Shen Y, Spruyt K, Zhou J. Narcolepsy and metabolic disease: A meta-analytic synthesis. Sleep Med Rev. 2026;87:102264. PMID 41747645. doi:10.1016/j.smrv.2026.102264."}} as const;
    const selected = sources.sources.filter((source) => Object.prototype.hasOwnProperty.call(expected, source.sourceId));
    expect(selected).toHaveLength(5);
    for (const source of selected) {
      const identity = expected[source.sourceId as keyof typeof expected];
      expect(source.status).toBe("active");
      expect(source.kind).toBe("clinical-evidence");
      expect(source.verified).toBe(true);
      expect(source.liveUsageCount).toBe(1);
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


  it("contains exactly five pending ME-11 clinical sources", () => {
    const expected = {"pmid-41871568": {"pmid": "41871568", "doi": "10.24953/turkjpediatr.2026.6451", "citation": "Yildirim Arslan S, Tigrak S, Yucel E, Demirci M, Ekici O. Pediatric cervicofacial actinomycosis presenting with mandibular osteomyelitis: a diagnostic and therapeutic challenge and literature review. Turk J Pediatr. 2026. PMID 41871568. doi:10.24953/turkjpediatr.2026.6451."}, "pmid-33360604": {"pmid": "33360604", "doi": "10.1016/j.smrv.2020.101403", "citation": "Li L, Gan Y, Zhou X, et al. Insomnia and the risk of hypertension: A meta-analysis of prospective cohort studies. Sleep Med Rev. 2021;56:101403. PMID 33360604. doi:10.1016/j.smrv.2020.101403."}, "pmid-36377800": {"pmid": "36377800", "doi": "10.1111/cdoe.12812", "citation": "Larvin H, Kang J, Aggarwal VR, Pavitt S, Wu J. Periodontitis and risk of immune-mediated systemic conditions: A systematic review and meta-analysis. Community Dent Oral Epidemiol. 2023;51(5):705-717. PMID 36377800. doi:10.1111/cdoe.12812."}, "pmid-31006843": {"pmid": "31006843", "doi": "10.1007/s00404-019-05153-5", "citation": "Nicolaus K, Bräuer D, Sczesny R, Lehmann T, Diebolder H, Runnebaum IB. Unexpected coexistent endometriosis in women with symptomatic uterine leiomyomas is independently associated with infertility, nulliparity and minor myoma size. Arch Gynecol Obstet. 2019;300(1):103-108. PMID 31006843. doi:10.1007/s00404-019-05153-5."}, "pmid-42444963": {"pmid": "42444963", "doi": "10.21037/jtd-2026-0713", "citation": "Bachar R, Tager D, Berro J, Nero N, Sehgal S, Mehta AC. Pulmonary hypertension following lung transplant: a systematic review. J Thorac Dis. 2026;18(6):685. PMID 42444963. doi:10.21037/jtd-2026-0713."}} as const;
    const selected = sources.sources.filter((source) => Object.prototype.hasOwnProperty.call(expected, source.sourceId));
    expect(selected).toHaveLength(5);
    for (const source of selected) {
      const identity = expected[source.sourceId as keyof typeof expected];
      expect(source.status).toBe("active");
      expect(source.kind).toBe("clinical-evidence");
      expect(source.verified).toBe(true);
      expect(source.liveUsageCount).toBe(1);
      expect(source.pmid).toBe(identity.pmid);
      expect(source.doi?.toLowerCase()).toBe(identity.doi.toLowerCase());
      expect(source.canonicalCitation).toBe(identity.citation);
      expect(source.verificationState).toMatchObject({
        qualifiedHumanCitationReviewRequired: false,
        automaticPromotionAuthorized: false,
        mappingApprovalDoesNotEqualCitationVerification: true,
      });
    }
  });

});
