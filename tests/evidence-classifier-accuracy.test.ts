import { describe, expect, it } from "vitest";

import { analyzeEvidenceText } from "../src/lib/evidence/extract";

describe("evidence classifier accuracy fixes", () => {
  it("captures VA shorthand 'working dx of' as a diagnosis list entry", () => {
    const text = [
      "ASSESSMENT:",
      "PTSD-chronic",
      "working dx of REM sleep behavior disorder",
      "rule out narcolepsy",
    ].join("\n");

    const analysis = analyzeEvidenceText(
      text,
      { sourceName: "psych-note.txt", credential: "psychologist" },
      ["PTSD", "REM Sleep Behavior Disorder"],
    );

    const rem = analysis.excerpts.find((excerpt) =>
      /REM sleep behavior disorder/i.test(excerpt.quote),
    );
    expect(rem).toBeDefined();
    expect(rem?.category).toBe("diagnosis");
    expect(rem?.strength).toBe("supporting");
    expect(rem?.matchedTerms).toContain("REM Sleep Behavior Disorder");
    expect(analysis.nexusRelevantCount).toBe(0);
  });

  it("reads '2/2' as causation shorthand without matching dates", () => {
    const analysis = analyzeEvidenceText(
      "The insomnia may be 2/2 OSA.",
      { sourceName: "sleep-note.txt", credential: "physician" },
      ["OSA"],
    );
    expect(analysis.nexusRelevantCount).toBe(1);
    expect(analysis.excerpts[0]?.category).toBe("causation");

    const dated = analyzeEvidenceText(
      "Progress note dated 2/22/2020 and 2/2/2020 were reviewed.",
      { sourceName: "record.txt", credential: "physician" },
      ["OSA"],
    );
    expect(dated.excerpts.some((excerpt) => excerpt.category === "causation")).toBe(false);
  });

  it("matches hyphenless and hyphenated spellings of the same condition term", () => {
    const analysis = analyzeEvidenceText(
      "The veteran's posttraumatic stress disorder is aggravated by chronic sleep disruption.",
      { sourceName: "opinion.txt", credential: "physician" },
      ["Post-Traumatic Stress Disorder (PTSD)", "post-traumatic stress disorder", "ptsd"],
    );
    expect(analysis.nexusRelevantCount).toBe(1);
    expect(analysis.excerpts[0]?.matchedTerms.some((term) => /stress disorder/i.test(term))).toBe(true);
  });

  it("excludes regulatory boilerplate rather than counting it as evidence", () => {
    const analysis = analyzeEvidenceText(
      [
        "Service connection may be granted for a disability which began in service or was caused by an event in service (38 CFR 3.303).",
        "The veteran's sleep apnea is secondary to PTSD.",
      ].join("\n"),
      { sourceName: "decision.txt", credential: "physician" },
      ["PTSD", "sleep apnea"],
    );
    const boilerplate = analysis.excerpts.find((excerpt) => /may be granted/i.test(excerpt.quote));
    expect(boilerplate).toBeUndefined();
    expect(analysis.nexusRelevantCount).toBe(1);
    expect(analysis.excerpts[0]?.quote).toContain("secondary to PTSD");
  });

  it("treats one-condition-per-line diagnosis lists under Assessment/Diagnosis headers as context", () => {
    const text = [
      "Diagnosis:",
      "PTSD-chronic",
      "MDD-recurrent",
      "Insomnia-may be 2/2 OSA",
      "working dx of REM sleep behavior disorder",
    ].join("\n");

    const analysis = analyzeEvidenceText(
      text,
      { sourceName: "intake.txt", credential: "physician" },
      ["PTSD", "REM Sleep Behavior Disorder"],
    );

    expect(analysis.supportingCount).toBeGreaterThanOrEqual(3);
    const ptsd = analysis.excerpts.find((excerpt) => /PTSD-chronic/i.test(excerpt.quote));
    expect(ptsd?.category).toBe("diagnosis");
    const insomnia = analysis.excerpts.find((excerpt) => /Insomnia-may be 2\/2 OSA/i.test(excerpt.quote));
    expect(insomnia?.category).toBe("causation");
    expect(insomnia?.strength).toBe("supporting");
    expect(analysis.nexusRelevantCount).toBe(0);
  });
});
