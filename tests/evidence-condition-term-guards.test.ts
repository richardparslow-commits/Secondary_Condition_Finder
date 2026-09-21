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
    for (const acronym of [
      "MS", "PE", "MI", "CAD", "RA", "OA",
      "DM", "PN", "VT", "VF", "CVA", "DVT", "ESRD",
    ]) {
      expect(conditionTermGuardFor(acronym), acronym).toBeInstanceOf(RegExp);
      expect(conditionTermGuardFor(acronym.toLowerCase())).toBe(
        conditionTermGuardFor(acronym),
      );
    }
  });

  it("does not guard unambiguous three-plus-character acronyms", () => {
    for (const acronym of ["OSA", "PTSD", "GERD", "TBI", "CHF", "BPH", "AFib", "GAD", "PVD", "TIA", "CKD"]) {
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
      ["diabetes-mellitus", "dm"],
      ["peripheral-neuropathy", "PN"],
      ["ventricular-tachycardia-fibrillation", "vt"],
      ["ventricular-tachycardia-fibrillation", "vf"],
      ["cerebrovascular-accident-stroke-residuals", "cva"],
      ["deep-vein-thrombosis", "DVT"],
      ["chronic-kidney-disease", "ESRD"],
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

  it("carries the newly added shorthand aliases for their catalog entries", () => {
    for (const [id, acronym] of [
      ["deep-vein-thrombosis", "DVT"],
      ["benign-prostatic-hyperplasia", "BPH"],
      ["osteoarthritis", "DJD"],
      ["peripheral-vascular-disease", "PVD"],
      ["cardiac-arrhythmia", "AFib"],
      ["anxiety-disorder", "GAD"],
      ["chronic-kidney-disease", "ESRD"],
      ["diabetes-mellitus", "dm"],
      ["peripheral-neuropathy", "PN"],
      ["ventricular-tachycardia-fibrillation", "vt"],
      ["ventricular-tachycardia-fibrillation", "vf"],
    ] as const) {
      const condition = byId.get(id);
      expect(condition, id).toBeDefined();
      expect(buildEvidenceConditionTerms([condition!]), id).toContain(acronym);
    }
  });

  it("keeps UTI out of the catalog rather than fabricating a rating identity", () => {
    const utiOwner = [...byId.values()].find((condition) =>
      /\bUTI\b/.test(condition.name) || condition.aliases.includes("UTI"),
    );
    expect(utiOwner).toBeUndefined();
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

describe("guarded shorthand corpus (dm / PN / VT / VF)", () => {
  it("matches dm only with glycemic co-signals, not ICD-suffix charting", () => {
    const hit = excerptsFor(
      "Assessment:\nDiabetes mellitus, dm uncontrolled; A1c 9.8 on metformin and insulin",
      ["diabetes-mellitus"],
    );
    const dmExcerpt = hit.find((excerpt) => excerpt.matchedTerms.includes("dm"));
    expect(dmExcerpt).toBeDefined();

    // The trap: "dm" as an ICD-code suffix on a problem line. No glycemic
    // co-signal — must never fabricate a match.
    const trap = excerptsFor(
      "Diagnosis:\nE11.9 dm2, some other text",
      ["diabetes-mellitus"],
    );
    expect(trap.every((excerpt) => !excerpt.matchedTerms.includes("dm"))).toBe(true);
  });

  it("matches PN only with neuropathy co-signals, not peripheral anatomy lines", () => {
    const hit = excerptsFor(
      "Assessment:\nPN with stocking-glove numbness, nerve conduction slowed, on gabapentin",
      ["peripheral-neuropathy"],
    );
    const pnExcerpt = hit.find((excerpt) => excerpt.matchedTerms.includes("PN"));
    expect(pnExcerpt).toBeDefined();

    const trap = excerptsFor(
      "Diagnosis:\nRight lower extremity cellulitis, PN pulses intact",
      ["peripheral-neuropathy"],
    );
    expect(trap.every((excerpt) => !excerpt.matchedTerms.includes("PN"))).toBe(true);
  });

  it("matches VT/VF only with arrhythmia co-signals", () => {
    const hit = excerptsFor(
      "Assessment:\nVT episodes documented on telemetry; ICD placed, on amiodarone",
      ["ventricular-tachycardia-fibrillation"],
    );
    const vtExcerpt = hit.find((excerpt) => excerpt.matchedTerms.includes("vt"));
    expect(vtExcerpt).toBeDefined();

    const vfHit = excerptsFor(
      "Impression:\nVF arrest, defibrillated, cardioversion successful",
      ["ventricular-tachycardia-fibrillation"],
    );
    const vfExcerpt = vfHit.find((excerpt) => excerpt.matchedTerms.includes("vf"));
    expect(vfExcerpt).toBeDefined();
  });
});

describe("guarded shorthand corpus (polysemous three-letter: CVA, DVT, ESRD)", () => {
  it("matches CVA with stroke co-signals and never from costovertebral-angle tenderness", () => {
    const hit = excerptsFor(
      "Assessment:\nCVA 2021 with residual right hemiparesis and aphasia",
      ["cerebrovascular-accident-stroke-residuals"],
    );
    const cvaExcerpt = hit.find((excerpt) =>
      excerpt.matchedTerms.some((term) => term.toLowerCase() === "cva"),
    );
    expect(cvaExcerpt).toBeDefined();

    // The GU trap: "CVA tenderness" = costovertebral-angle tenderness on a
    // renal/flank exam. No stroke co-signal — must never match.
    const trap = excerptsFor(
      "Diagnosis:\nFlank pain with CVA tenderness, urinalysis pending",
      ["cerebrovascular-accident-stroke-residuals"],
    );
    expect(
      trap.every(
        (excerpt) =>
          !excerpt.matchedTerms.some((term) => term.toLowerCase() === "cva"),
      ),
    ).toBe(true);
  });

  it("matches DVT with venous co-signals and stays silent under sentence-initial negation", () => {
    const hit = excerptsFor(
      "Assessment:\nLeft leg DVT on duplex ultrasound, anticoagulation with apixaban",
      ["deep-vein-thrombosis"],
    );
    const dvtExcerpt = hit.find((excerpt) => excerpt.matchedTerms.includes("DVT"));
    expect(dvtExcerpt).toBeDefined();

    // Sentence-initial negation wins even with a venous co-signal present:
    // a ruled-out thrombosis must not count as evidence-gap coverage.
    const trap = excerptsFor(
      "Diagnosis:\nNo DVT on duplex ultrasound; leg swelling improved",
      ["deep-vein-thrombosis"],
    );
    expect(
      trap.every((excerpt) => !excerpt.matchedTerms.includes("DVT")),
    ).toBe(true);
  });

  it("matches ESRD only with renal-failure co-signals", () => {
    const hit = excerptsFor(
      "Assessment:\nESRD on hemodialysis three times weekly, nephrology following",
      ["chronic-kidney-disease"],
    );
    const esrdExcerpt = hit.find((excerpt) => excerpt.matchedTerms.includes("ESRD"));
    expect(esrdExcerpt).toBeDefined();

    // The respiratory trap: ESRD also abbreviates end-stage respiratory
    // disease. Without a renal co-signal, no match.
    const trap = excerptsFor(
      "Diagnosis:\nSevere dyspnea; concern for end-stage respiratory disease",
      ["chronic-kidney-disease"],
    );
    expect(
      trap.every((excerpt) => !excerpt.matchedTerms.includes("ESRD")),
    ).toBe(true);
  });
});

describe("guarded shorthand corpus (unambiguous additions)", () => {
  it("matches unguarded three-plus-character aliases without co-signals", () => {
    for (const [text, id, acronym] of [
      ["Assessment:\nBPH with obstructive urinary symptoms", "benign-prostatic-hyperplasia", "BPH"],
      ["Assessment:\nDJD of bilateral knees on x-ray", "osteoarthritis", "DJD"],
      ["Assessment:\nPVD with claudication", "peripheral-vascular-disease", "PVD"],
      ["Assessment:\nAFib rate-controlled on metoprolol", "cardiac-arrhythmia", "AFib"],
      ["Assessment:\nGAD with panic features, on sertraline", "anxiety-disorder", "GAD"],
    ] as const) {
      const excerpts = excerptsFor(text, [id]);
      expect(
        excerpts.some((excerpt) => excerpt.matchedTerms.includes(acronym)),
        `${id} should match ${acronym}`,
      ).toBe(true);
    }
  });
});
