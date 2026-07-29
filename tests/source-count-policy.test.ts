import { describe, it, expect } from "vitest";
import { suggestionSchema } from "../src/lib/kb/schema";

describe("P1 Ticket 6: Source-Count Policy Enforcement (1 to 3 Sources)", () => {
  const validSource = {
    citation: "38 CFR § 3.310",
    note: "Direct secondary connection authority.",
    verified: false as const
  };

  it("allows suggestions with exactly 1, 2, or 3 source references", () => {
    // 1 Source
    const result1 = suggestionSchema.safeParse({
      conditionId: "radiculopathy",
      rank: 1,
      prevalence: "commonly-explored",
      rationale: "Nerve irritation.",
      evidenceGaps: ["Diagnosis"],
      sourceReferences: [validSource]
    });
    expect(result1.success).toBe(true);

    // 3 Sources (Maximum allowed)
    const result3 = suggestionSchema.safeParse({
      conditionId: "radiculopathy",
      rank: 1,
      prevalence: "commonly-explored",
      rationale: "Nerve irritation.",
      evidenceGaps: ["Diagnosis"],
      sourceReferences: [validSource, validSource, validSource]
    });
    expect(result3.success).toBe(true);
  });

  it("rejects suggestions with zero source references (below minimum)", () => {
    const result = suggestionSchema.safeParse({
      conditionId: "radiculopathy",
      rank: 1,
      prevalence: "commonly-explored",
      rationale: "Nerve irritation.",
      evidenceGaps: ["Diagnosis"],
      sourceReferences: []
    });
    expect(result.success).toBe(false);
  });

  it("rejects suggestions exceeding 4 or more source references (above maximum)", () => {
    const result = suggestionSchema.safeParse({
      conditionId: "radiculopathy",
      rank: 1,
      prevalence: "commonly-explored",
      rationale: "Nerve irritation.",
      evidenceGaps: ["Diagnosis"],
      sourceReferences: [validSource, validSource, validSource, validSource]
    });
    expect(result.success).toBe(false);
  });
});
