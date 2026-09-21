import { describe, expect, it } from "vitest";

import { analyzeEvidenceText } from "../src/lib/evidence/extract";
import {
  buildEvidenceConditionTerms,
  conditionTermGuardFor,
} from "../src/lib/evidence/condition-terms";
import { indexById } from "../src/lib/catalog/lookup";
import { loadConditionCatalog } from "../src/lib/catalog/load";

/**
 * Golden-corpus regression tests for the acronym context guards.
 *
 * Two-letter clinical acronyms (MI, PE, RA, OA) previously never reached the
 * classifier at all — the terms builder dropped anything shorter than three
 * characters, a systematic false negative for exactly the shorthand VA
 * records use. Enabling them bare, however, matches chart punctuation
 * instead of conditions: "PE:" heads physical-exam lines, "MS" is morphine
 * sulfate on medication lists, "r/o MI" rules an infarct OUT.
 *
 * The pipeline contract these tests pin:
 *  1. A sentence still needs a category pattern (or a Diagnosis:-style
 *     header) before any excerpt is produced; the guard decides whether the
 *     guarded acronym counts as a MATCHED CONDITION TERM — which drives
 *     nexus promotion and Step 6 gap coverage — for sentences that qualify.
 *  2. A guarded acronym never matches on chart scaffolding alone (no
 *     co-signal → no matched term), so "PE: alert, oriented x3" can never
 *     cover a pulmonary-embolism evidence gap.
 *  3. The negation guard sits in front of everything, so "no evidence of MI"
 *     produces nothing even with a co-signal present.
 */

function analyze(
  text: string,
  conditionIds: string[],
): ReturnType<typeof analyzeEvidenceText> {
  const byId = indexById(loadConditionCatalog());
  const conditions = conditionIds
    .map((id) => byId.get(id))
    .filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));
  return analyzeEvidenceText(
    text,
    { sourceName: "Guard corpus", credential: "physician" },
    buildEvidenceConditionTerms(conditions),
  );
}

function excerptsFor(
  text: string,
  conditionIds: string[],
): ReturnType<typeof analyzeEvidenceText>["excerpts"] {
  return analyze(text, conditionIds).excerpts;
}

describe("guard registry", () => {
  it("assigns guards to the polysemous acronyms and shares them case-insensitively", () => {
    for (const acronym of ["MS", "PE", "MI", "CAD", "RA", "OA"]) {
      expect(conditionTermGuardFor(acronym), acronym).toBeInstanceOf(RegExp);
      expect(conditionTermGuardFor(acronym.toLowerCase())).toBe(
        conditionTermGuardFor(acronym),
      );
    }
  });

  it("does not guard unambiguous three-plus-character acronyms", () => {
    for (const acronym of ["OSA", "PTSD", "GERD", "TBI", "CHF"]) {
      expect(conditionTermGuardFor(acronym), acronym).toBeNull();
    }
  });

  it("admits guarded two-letter catalog aliases and keeps unguarded ones out", () => {
    const terms = buildEvidenceConditionTerms([
      {
        id: "example-ms",
        name: "Multiple Sclerosis",
        aliases: ["MS"],
        bodySystem: "Test",
        ratingSchedule: [],
        reviewNotes: [],
      },
      {
        id: "example-xx",
        name: "Unguarded Two Letter",
        aliases: ["XX"],
        bodySystem: "Test",
        ratingSchedule: [],
        reviewNotes: [],
      },
    ]);
    expect(terms).toContain("MS");
    expect(terms).not.toContain("XX");
  });
});

describe("catalog aliases feed the guards", () => {
  const byId = indexById(loadConditionCatalog());

  it("carries the guarded acronyms for the real catalog entries", () => {
    for (const [id, acronym] of [
      ["multiple-sclerosis", "MS"],
      ["pulmonary-embolism", "PE"],
      ["ischemic-heart-disease", "CAD"],
      ["rheumatoid-arthritis", "RA"],
      ["osteoarthritis", "OA"],
    ] as const) {
      const condition = byId.get(id);
      expect(condition, id).toBeDefined();
      expect(buildEvidenceConditionTerms([condition!]), id).toContain(acronym);
    }
  });

  it("adds MI to the myocardial-infarction catalog entry", () => {
    const condition = byId.get("myocardial-infarction");
    expect(condition).toBeDefined();
    expect(buildEvidenceConditionTerms([condition!])).toContain("MI");
  });
});

describe("guarded shorthand corpus (positive)", () => {
  it("matches MI with a clinical co-signal under a diagnosis header", () => {
    const excerpts = excerptsFor(
      "Assessment:\nExacerbation of cardiac disease s/p MI, troponin elevated, stent placed 2019",
      ["myocardial-infarction"],
    );
    const joined = excerpts.map((excerpt) => excerpt.quote).join(" ");
    expect(joined).toMatch(/s\/p MI/);
    const miExcerpt = excerpts.find((excerpt) => excerpt.quote.includes("MI"));
    expect(miExcerpt?.matchedTerms).toContain("MI");
  });

  it("matches PE with pulmonary co-signals and never from a physical-exam heading", () => {
    const hit = excerptsFor(
      "Impression:\nHistory of PE, CT pulmonary angiogram positive, on apixaban anticoagulation",
      ["pulmonary-embolism"],
    );
    const peExcerpt = hit.find((excerpt) => excerpt.quote.includes("PE"));
    expect(peExcerpt?.matchedTerms).toContain("PE");

    // The classic trap: "PE:" heading a physical-exam line. The sentence is
    // exam scaffolding — no pulmonary co-signal — so PE must not match.
    const trap = excerptsFor(
      "PE: alert, oriented x3. CV: RRR. Lungs: CTA bilaterally.",
      ["pulmonary-embolism"],
    );
    expect(trap.every((excerpt) => !excerpt.matchedTerms.includes("PE"))).toBe(true);
  });

  it("matches RA with rheumatology co-signals and ignores nursing-flow-sheet numbers", () => {
    const hit = excerptsFor(
      "Assessment:\nRA with joint erosion on x-ray, continue methotrexate",
      ["rheumatoid-arthritis"],
    );
    const raExcerpt = hit.find((excerpt) => excerpt.quote.includes("RA"));
    expect(raExcerpt?.matchedTerms).toContain("RA");

    // No rheumatology co-signal: "RA 14" on a vitals line must not match.
    const trap = excerptsFor(
      "Vitals:\nRA 14, BP 120/80 per nursing flow sheet",
      ["rheumatoid-arthritis"],
    );
    expect(trap.every((excerpt) => !excerpt.matchedTerms.includes("RA"))).toBe(true);
  });

  it("matches CAD with cardiac co-signals", () => {
    const excerpts = excerptsFor(
      "Assessment:\nCAD with prior angioplasty and stent to LAD",
      ["ischemic-heart-disease"],
    );
    const cadExcerpt = excerpts.find((excerpt) => excerpt.quote.includes("CAD"));
    expect(cadExcerpt?.matchedTerms).toContain("CAD");
  });

  it("matches OA with degenerative co-signals", () => {
    const excerpts = excerptsFor(
      "Assessment:\nOA of bilateral knees with joint space narrowing and osteophytes",
      ["osteoarthritis"],
    );
    const oaExcerpt = excerpts.find((excerpt) => excerpt.quote.includes("OA"));
    expect(oaExcerpt?.matchedTerms).toContain("OA");
  });

  it("matches MS only with a neurological co-signal, not morphine sulfate", () => {
    const hit = excerptsFor(
      "Assessment:\nMS relapse; brain MRI shows new demyelinating lesions per neurologist",
      ["multiple-sclerosis"],
    );
    const msExcerpt = hit.find((excerpt) => excerpt.quote.includes("MS"));
    expect(msExcerpt?.matchedTerms).toContain("MS");

    // Medication-list "MS" = morphine sulfate: no neurological co-signal.
    const trap = excerptsFor(
      "Medications:\nMS 4mg IV q4h PRN severe pain",
      ["multiple-sclerosis"],
    );
    expect(trap.every((excerpt) => !excerpt.matchedTerms.includes("MS"))).toBe(true);
  });

  it("supports guarded acronyms in compound sentences with clause-level co-signals", () => {
    const excerpts = excerptsFor(
      "Impression:\nRecurrent PE suspected; CT angiogram ordered with d-dimer testing",
      ["pulmonary-embolism"],
    );
    const peExcerpt = excerpts.find((excerpt) => excerpt.quote.includes("PE"));
    expect(peExcerpt?.matchedTerms).toContain("PE");
  });

  it("promotes guarded-acronym sentences carrying nexus language to nexus-relevant", () => {
    const excerpts = excerptsFor(
      "It is more likely than not that his sleep apnea is 2/2 PTSD; CPAP adherence documented",
      ["sleep-apnea", "ptsd"],
    );
    expect(excerpts.some((excerpt) => excerpt.strength === "nexus-relevant")).toBe(true);
  });
});

describe("guarded shorthand corpus (negative / negation interplay)", () => {
  it("produces no condition matches from chart scaffolding without co-signals", () => {
    const analysis = analyze(
      "PE: A&O x3\nMI on far monitor\nRA 16\nOA: see prior\nMS as needed",
      [
        "pulmonary-embolism",
        "myocardial-infarction",
        "rheumatoid-arthritis",
        "osteoarthritis",
        "multiple-sclerosis",
      ],
    );
    const allMatchedTerms = analysis.excerpts.flatMap((excerpt) => excerpt.matchedTerms);
    for (const acronym of ["PE", "MI", "RA", "OA", "MS"]) {
      expect(allMatchedTerms).not.toContain(acronym);
    }
  });

  it("keeps the negation guard in front of guarded acronyms even with co-signals", () => {
    const analysis = analyze(
      "No evidence of MI; serial troponins negative",
      ["myocardial-infarction"],
    );
    const allMatchedTerms = analysis.excerpts.flatMap((excerpt) => excerpt.matchedTerms);
    expect(allMatchedTerms).not.toContain("MI");
  });

  it("still surfaces explicit unfavorable opinions as alternative-cause context", () => {
    const excerpts = excerptsFor(
      "The sleep apnea is not caused by the PTSD; independent etiology suspected",
      ["sleep-apnea", "ptsd"],
    );
    expect(
      excerpts.some(
        (excerpt) =>
          excerpt.category === "alternative-cause" &&
          excerpt.matchedTerms.includes("ptsd"),
      ),
    ).toBe(true);
  });
});
