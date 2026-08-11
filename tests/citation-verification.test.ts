import { describe, expect, it } from "vitest";
import { sourceReferenceSchema } from "../src/lib/kb/schema";

describe("citation verification", () => {
  it("requires provenance metadata for verified sources", () => {
    expect(() => sourceReferenceSchema.parse({
      citation: "38 CFR 3.310(a)",
      note: "Secondary service connection legal framework",
      verified: true,
    })).toThrow();
  });

  it("accepts a fully documented verified source", () => {
    expect(sourceReferenceSchema.parse({
      citation: "38 CFR 3.310(a)-(b)",
      note: "Legal framework for secondary service connection and aggravation",
      verificationScope: "legal-framework",
      sourceUrl: "https://www.law.cornell.edu/cfr/text/38/3.310",
      verified: true,
      sourceCheckedOn: "2026-08-10",
      sourceLocator: "§ 3.310(a)-(b)",
    }).verified).toBe(true);
  });

  it("keeps unverified sources explicitly unverified", () => {
    expect(sourceReferenceSchema.parse({
      citation: "Example source",
      note: "Requires claim-specific review",
      verified: false,
    }).verified).toBe(false);
  });
});
