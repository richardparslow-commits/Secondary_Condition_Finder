import { describe, expect, it } from "vitest";

import { auditSourceReference, classifySourceReference } from "@/lib/kb/evidence-architecture";
import { sourceReferenceSchema, suggestionSchema } from "@/lib/kb/schema";
import {
  buildCausalMechanism,
  buildEvidentiaryProfile,
  buildNexusClaim,
} from "./helpers/crg-fixtures";

describe("evidence architecture v2", () => {
  it("keeps legacy source references backward compatible", () => {
    expect(() =>
      sourceReferenceSchema.parse({ citation: "38 C.F.R. § 3.310", note: "Secondary service connection framework.", verified: false }),
    ).not.toThrow();
  });

  it("classifies current regulations, statutes, medical literature, and VA guidance", () => {
    expect(
      classifySourceReference(sourceReferenceSchema.parse({
        citation: "38 C.F.R. § 3.310",
        note: "Secondary service connection framework.",
        sourceUrl: "https://www.ecfr.gov/current/title-38/section-3.310",
        verified: false,
      })).authorityCategory,
    ).toBe("current-regulatory-authority");

    expect(
      classifySourceReference(sourceReferenceSchema.parse({
        citation: "38 U.S.C. § 1168",
        note: "TERA examination statute.",
        sourceUrl: "https://www.govinfo.gov/link/uscode/38/1168",
        verified: false,
      })).authorityCategory,
    ).toBe("statutory-authority");

    expect(
      classifySourceReference(sourceReferenceSchema.parse({
        citation: "PMID: 12345678",
        note: "Peer-reviewed clinical study.",
        verificationScope: "clinical-evidence",
        sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/12345678/",
        verified: false,
      })).authorityCategory,
    ).toBe("medical-scientific-evidence");

    expect(
      classifySourceReference(sourceReferenceSchema.parse({
        citation: "M21-1 adjudication procedures manual",
        note: "VA adjudication guidance.",
        verificationScope: "procedural-guidance",
        sourceUrl: "https://www.knowva.ebenefits.va.gov/",
        verified: false,
      })).authorityCategory,
    ).toBe("va-adjudication-guidance");
  });

  it("does not assume a Federal Register document is final merely from its domain", () => {
    const source = sourceReferenceSchema.parse({
      citation: "89 Fed. Reg. 79815",
      note: "PACT Act implementation rulemaking.",
      sourceUrl: "https://www.federalregister.gov/documents/example",
      verified: false,
    });
    expect(classifySourceReference(source).authorityCategory).toBeUndefined();
    expect(auditSourceReference(source).map(issue => issue.code)).toContain("FR_TYPE_REQUIRED_FOR_CLASSIFICATION");
  });

  it("rejects a proposed Federal Register rule explicitly marked binding", () => {
    expect(() =>
      sourceReferenceSchema.parse({
        citation: "89 Fed. Reg. 79815",
        note: "Proposed rule.",
        authorityCategory: "federal-register-proposed-or-notice",
        federalRegisterType: "proposed-rule",
        bindingStatus: "binding",
        sourceUrl: "https://www.federalregister.gov/documents/example",
        verified: false,
      }),
    ).toThrow();
  });

  it("rejects explicit use of 38 C.F.R. § 3.310 as clinical causation proof", () => {
    expect(() =>
      sourceReferenceSchema.parse({
        citation: "38 C.F.R. § 3.310",
        note: "Legal secondary-service-connection framework.",
        authorityCategory: "current-regulatory-authority",
        propositionRole: "clinical-evidence",
        sourceUrl: "https://www.ecfr.gov/current/title-38/section-3.310",
        verified: false,
      }),
    ).toThrow();
  });

  it("accepts 38 C.F.R. § 3.310 as legal framework", () => {
    expect(() =>
      sourceReferenceSchema.parse({
        citation: "38 C.F.R. § 3.310",
        note: "Legal secondary-service-connection framework.",
        authorityCategory: "current-regulatory-authority",
        propositionRole: "legal-framework",
        bindingStatus: "binding",
        sourceUrl: "https://www.ecfr.gov/current/title-38/section-3.310",
        verified: false,
      }),
    ).not.toThrow();
  });

  it("flags a purely presumptive theory that unnecessarily requires an individual nexus", () => {
    const suggestion = suggestionSchema.parse({
      conditionId: "chronic-sinusitis",
      rank: 1,
      nexusClaim: buildNexusClaim(),
      causalMechanism: buildCausalMechanism(),
      evidentiaryProfile: buildEvidentiaryProfile(),
      rationale: "Presumptive pathway fixture.",
      claimTheories: ["presumptive"],
      nexusRequirement: "individual-medical-opinion",
      evidenceGaps: ["Confirm qualifying service and diagnosis."],
      sourceReferences: [{
        citation: "38 C.F.R. § 3.320",
        note: "Particulate-matter presumption.",
        authorityCategory: "current-regulatory-authority",
        propositionRole: "legal-presumption",
        sourceUrl: "https://www.ecfr.gov/current/title-38/section-3.320",
        verified: false,
      }],
    });

    const issues = suggestion.sourceReferences.flatMap(reference =>
      auditSourceReference(reference, {
        claimTheories: suggestion.claimTheories,
        nexusRequirement: suggestion.nexusRequirement,
      }),
    );
    expect(issues.map(issue => issue.code)).toContain("PRESUMPTIVE_NEXUS_REQUIREMENT_REVIEW");
  });

  it("requests effective-date/applicability metadata for final rules used in timeline disputes", () => {
    const source = sourceReferenceSchema.parse({
      citation: "88 Fed. Reg. 60336",
      note: "Final rule fixture.",
      authorityCategory: "federal-register-final-rule",
      propositionRole: "effective-date-applicability",
      federalRegisterType: "final-rule",
      bindingStatus: "binding",
      sourceUrl: "https://www.federalregister.gov/documents/example",
      verified: false,
    });
    const codes = auditSourceReference(source, { claimTheories: ["effective-date"] }).map(issue => issue.code);
    expect(codes).toContain("FR_EFFECTIVE_DATE_MISSING");
    expect(codes).toContain("FR_APPLICABILITY_MISSING");
  });
});
