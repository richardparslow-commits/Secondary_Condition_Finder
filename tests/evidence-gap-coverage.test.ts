import { describe, expect, it } from "vitest";

import {
  detectDocumentKindHint,
  isClinicianCredential,
} from "../src/lib/evidence/document-kind";
import {
  assessGapCoverage,
  requiredCategoriesForGap,
  type GapCoverageResult,
} from "../src/lib/evidence/gap-coverage";
import type { EvidenceAnalysis, EvidenceExcerpt } from "../src/lib/evidence/extract";
import { analyzeEvidenceText } from "../src/lib/evidence/extract";

function analysis(
  sourceName: string,
  excerpts: EvidenceExcerpt[],
): EvidenceAnalysis {
  return {
    version: 1,
    sourceName,
    excerpts,
    nexusRelevantCount: excerpts.filter((item) => item.strength === "nexus-relevant").length,
    supportingCount: excerpts.filter((item) => item.strength === "supporting").length,
  };
}

function excerpt(partial: Partial<EvidenceExcerpt>): EvidenceExcerpt {
  return {
    sourceName: "source.pdf",
    locator: "page 1",
    quote: "The condition is related to the veteran's service.",
    category: "diagnosis",
    strength: "supporting",
    clinicianAuthored: true,
    matchedTerms: ["PTSD"],
    ...partial,
  };
}

describe("detectDocumentKindHint", () => {
  it("flags VA decision-letter boilerplate as adjudication text", () => {
    const hint = detectDocumentKindHint([
      {
        text:
          "Rating Decision. Service connection for obstructive sleep apnea is granted as secondary to PTSD. 38 CFR 3.303 and the duty to assist were considered. Entitlement to benefits is established.",
        locatorPrefix: "page 1",
      },
    ]);
    expect(hint).toBe("va-decision-letter");
  });

  it("flags clinical progress-note structure as a clinical note", () => {
    const hint = detectDocumentKindHint([
      {
        text:
          "Progress note. Chief complaint: nightmares. Assessment: PTSD-chronic. Diagnosis: REM sleep behavior disorder. Plan: continue prazosin and melatonin. Patient endorses disrupted sleep.",
        locatorPrefix: "page 1",
      },
    ]);
    expect(hint).toBe("clinical-note");
  });

  it("returns unclear for generic or short text", () => {
    expect(detectDocumentKindHint([{ text: "See attached records.", locatorPrefix: "page 1" }])).toBe("unclear");
    expect(detectDocumentKindHint([])).toBe("unclear");
  });

  it("treats only clinician credentials as clinician-authored", () => {
    expect(isClinicianCredential("physician")).toBe(true);
    expect(isClinicianCredential("psychologist")).toBe(true);
    expect(isClinicianCredential("np-pa")).toBe(true);
    expect(isClinicianCredential("other-licensed-clinician")).toBe(true);
    expect(isClinicianCredential("unknown")).toBe(false);
    expect(isClinicianCredential("non-clinician")).toBe(false);
  });
});

describe("requiredCategoriesForGap", () => {
  it("maps nexus-style wording to the causal requirement set", () => {
    expect(requiredCategoriesForGap("Is there a medical nexus opinion linking PTSD to the claimed condition?")).toEqual([
      "causation",
      "aggravation",
      "alternative-cause",
    ]);
    expect(requiredCategoriesForGap("Was the disorder proximately due to service?")).not.toBeNull();
  });

  it("maps diagnosis, medication, treatment, timeline, and alternative-cause wording", () => {
    expect(requiredCategoriesForGap("Is there a confirmed diagnosis of sleep apnea?")).toEqual(["diagnosis"]);
    expect(requiredCategoriesForGap("Was prazosin prescribed for the condition?")).toEqual(["medication"]);
    expect(requiredCategoriesForGap("Did the veteran receive CPAP or ongoing management?")).toEqual(["treatment"]);
    expect(requiredCategoriesForGap("When did symptoms first begin relative to service?")).toEqual(["timeline"]);
    expect(requiredCategoriesForGap("Could another condition be the alternative cause?")).toEqual(["alternative-cause"]);
  });

  it("returns null for wording with no mapped category", () => {
    expect(requiredCategoriesForGap("Has the veteran been seen by a sleep specialist?")).toBeNull();
  });
});

describe("assessGapCoverage", () => {
  const ptsdTerms = ["PTSD", "Post-Traumatic Stress Disorder"];

  it("marks a nexus gap covered by a clinician nexus excerpt naming the condition", () => {
    const result: GapCoverageResult = assessGapCoverage(
      "Is there a medical nexus opinion linking PTSD to the claimed condition?",
      [
        analysis("ED letter.pdf", [
          excerpt({
            category: "causation",
            strength: "nexus-relevant",
            clinicianAuthored: true,
            matchedTerms: ["PTSD"],
          }),
        ]),
      ],
      ptsdTerms,
    );
    expect(result.status).toBe("covered");
    expect(result.sources).toEqual(["ED letter.pdf"]);
  });

  it("treats non-clinician or non-nexus causal excerpts as related, not covered", () => {
    const result: GapCoverageResult = assessGapCoverage(
      "Is there a medical nexus opinion linking PTSD to the claimed condition?",
      [
        analysis("lay.pdf", [
          excerpt({
            category: "causation",
            strength: "supporting",
            clinicianAuthored: false,
            matchedTerms: ["PTSD"],
          }),
        ]),
      ],
      ptsdTerms,
    );
    expect(result.status).toBe("evidence-found");
  });

  it("does not count diagnosis-only excerpts toward a nexus requirement", () => {
    const result: GapCoverageResult = assessGapCoverage(
      "Is there a medical nexus opinion linking PTSD to the claimed condition?",
      [
        analysis("records.pdf", [
          excerpt({
            category: "diagnosis",
            strength: "supporting",
            clinicianAuthored: true,
            matchedTerms: ["PTSD"],
          }),
        ]),
      ],
      ptsdTerms,
    );
    expect(result.status).toBe("uncovered");
  });

  it("marks a diagnosis gap covered by a diagnosis excerpt naming the condition", () => {
    const result: GapCoverageResult = assessGapCoverage(
      "Is there a confirmed diagnosis of sleep apnea?",
      [
        analysis("DBQ.pdf", [
          excerpt({
            category: "diagnosis",
            strength: "supporting",
            clinicianAuthored: true,
            matchedTerms: ["sleep apnea"],
          }),
        ]),
      ],
      ["sleep apnea"],
    );
    expect(result.status).toBe("covered");
    expect(result.sources).toEqual(["DBQ.pdf"]);
  });

  it("does not mark a diagnosis gap covered by a section-context negation", () => {
    for (const header of ["Diagnosis:", "Assessment:"]) {
      for (const line of ["No PTSD", "Denies PTSD", "Without PTSD"]) {
        const negated = analyzeEvidenceText(
          `${header}\n${line}`,
          { sourceName: "note.txt", credential: "physician" },
          ptsdTerms,
        );
        const result = assessGapCoverage(
          "Is there a confirmed diagnosis of PTSD?",
          [negated],
          ptsdTerms,
        );
        expect(result.status, `${header} ${line}`).toBe("uncovered");
      }

      const positive = analyzeEvidenceText(
        `${header}\nPTSD-chronic`,
        { sourceName: "note.txt", credential: "physician" },
        ptsdTerms,
      );
      const result = assessGapCoverage(
        "Is there a confirmed diagnosis of PTSD?",
        [positive],
        ptsdTerms,
      );
      expect(result.status, header).toBe("covered");
    }
  });

  it("ignores excerpts that do not mention any selected condition", () => {
    const result: GapCoverageResult = assessGapCoverage(
      "Is there a confirmed diagnosis of sleep apnea?",
      [
        analysis("records.pdf", [
          excerpt({
            category: "diagnosis",
            strength: "supporting",
            clinicianAuthored: true,
            matchedTerms: ["migraine"],
          }),
        ]),
      ],
      ["sleep apnea"],
    );
    expect(result.status).toBe("uncovered");
  });

  it("uses weak evidence-found when the gap maps to no category", () => {
    const result: GapCoverageResult = assessGapCoverage(
      "Has the veteran been seen by a sleep specialist?",
      [
        analysis("records.pdf", [
          excerpt({
            category: "treatment",
            strength: "supporting",
            clinicianAuthored: true,
            matchedTerms: ["sleep apnea"],
          }),
        ]),
      ],
      ["sleep apnea"],
    );
    expect(result.status).toBe("evidence-found");
  });

  it("returns uncovered with no sources when no local analyses exist", () => {
    const result: GapCoverageResult = assessGapCoverage(
      "Is there a medical nexus opinion linking PTSD to the claimed condition?",
      [],
      ptsdTerms,
    );
    expect(result.status).toBe("uncovered");
    expect(result.sources).toEqual([]);
  });
});
