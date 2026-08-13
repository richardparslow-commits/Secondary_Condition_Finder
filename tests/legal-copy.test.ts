import { describe, it, expect } from "vitest";
import { DISCLAIMERS, CANONICAL_REFERENCES } from "../src/lib/legal/references";

const REQUIRED_STATUTORY_REFERENCES = [
  "38 U.S.C. § 1116",
  "38 U.S.C. § 1116B",
  "38 U.S.C. § 1117",
  "38 U.S.C. § 1112(c)",
  "38 U.S.C. § 1120",
] as const;

describe("P0 Guardrails: Legal Copy & Compliance Dictionary", () => {
  it("enforces non-diagnostic and non-deterministic disclaimer language", () => {
    expect(DISCLAIMERS.nonDiagnostic).toContain("does not constitute medical or legal advice");
    expect(DISCLAIMERS.nonDiagnostic).toContain("cannot diagnose");
    expect(DISCLAIMERS.noGuarantee).toContain("does not guarantee");
  });

  it("transparently communicates unverified citation status", () => {
    expect(DISCLAIMERS.unverifiedCitations).toContain("await manual certification");

    CANONICAL_REFERENCES.forEach((ref) => {
      expect(ref.verificationStatus).toBe("unverified");
    });
  });

  it("contains the mandatory 38 CFR 3.310 direct and aggravation basis entries", () => {
    const ids = CANONICAL_REFERENCES.map((ref) => ref.id);
    expect(ids).toContain("38-cfr-3.310-a");
    expect(ids).toContain("38-cfr-3.310-b");
  });

  it("uses real Title 38 statutory authorities for presumptive references", () => {
    const citations = CANONICAL_REFERENCES.map((ref) => ref.citation);

    for (const citation of REQUIRED_STATUTORY_REFERENCES) {
      expect(citations).toContain(citation);
    }

    expect(citations.some((citation) => citation.includes("81 U.S.C."))).toBe(false);
    expect(citations.some((citation) => citation.includes("Pub. L. 109-4"))).toBe(false);
  });
});
