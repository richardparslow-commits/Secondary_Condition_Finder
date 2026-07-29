import { describe, it, expect } from "vitest";
import { DISCLAIMERS, CANONICAL_REFERENCES } from "../src/lib/legal/references";

describe("P0 Guardrails: Legal Copy & Compliance Dictionary", () => {
  it("enforces non-diagnostic and non-deterministic disclaimer language", () => {
    expect(DISCLAIMERS.nonDiagnostic).toContain("does not constitute medical or legal advice");
    expect(DISCLAIMERS.nonDiagnostic).toContain("cannot diagnose");
    expect(DISCLAIMERS.noGuarantee).toContain("does not guarantee");
  });

  it("transparently communicates unverified citation status", () => {
    expect(DISCLAIMERS.unverifiedCitations).toContain("await manual certification");
    
    // Ensure all currently loaded references default to unverified for Phase 1
    CANONICAL_REFERENCES.forEach(ref => {
      expect(ref.verificationStatus).toBe("unverified");
    });
  });

  it("contains the mandatory 38 CFR 3.310 direct and aggravation basis entries", () => {
    const ids = CANONICAL_REFERENCES.map(r => r.id);
    expect(ids).toContain("38-cfr-3.310-a");
    expect(ids).toContain("38-cfr-3.310-b");
  });
});
