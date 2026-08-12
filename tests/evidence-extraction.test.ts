import { describe, expect, it } from "vitest";

import { analyzeEvidenceText } from "../src/lib/evidence/extract";

describe("browser-local evidence extraction", () => {
  it("preserves an exact clinician-authored causation quote and locator", () => {
    const text = [
      "Assessment: Erectile Dysfunction.",
      "In my medical opinion, the Veteran's erectile dysfunction is due to SSRI treatment prescribed for PTSD.",
    ].join("\n");

    const analysis = analyzeEvidenceText(
      text,
      { sourceName: "urology-note.txt", credential: "physician", locatorPrefix: "page 4" },
      ["PTSD", "Erectile Dysfunction"],
    );

    const nexus = analysis.excerpts.find((excerpt) => excerpt.strength === "nexus-relevant");
    expect(nexus).toBeDefined();
    expect(nexus?.quote).toBe("In my medical opinion, the Veteran's erectile dysfunction is due to SSRI treatment prescribed for PTSD.");
    expect(nexus?.locator).toBe("page 4, line 2");
    expect(nexus?.category).toBe("causation");
    expect(nexus?.matchedTerms).toEqual(["PTSD", "Erectile Dysfunction"]);
  });

  it("does not label a lay causation statement as nexus-relevant", () => {
    const analysis = analyzeEvidenceText(
      "I believe my erectile dysfunction is caused by my PTSD medication.",
      { sourceName: "lay-statement.txt", credential: "non-clinician" },
      ["PTSD", "Erectile Dysfunction"],
    );

    expect(analysis.nexusRelevantCount).toBe(0);
    expect(analysis.excerpts[0]?.strength).toBe("supporting");
  });

  it("recognizes clinician-authored aggravation language conservatively", () => {
    const analysis = analyzeEvidenceText(
      "The patient's lumbar degenerative disease was aggravated beyond natural progression by the chronic altered gait from the service-connected knee condition.",
      { sourceName: "orthopedic-opinion.txt", credential: "physician" },
      ["lumbar degenerative disease", "knee condition"],
    );

    expect(analysis.nexusRelevantCount).toBe(1);
    expect(analysis.excerpts[0]?.category).toBe("aggravation");
  });

  it("keeps diagnosis and treatment statements as supporting evidence", () => {
    const analysis = analyzeEvidenceText(
      "Diagnosis: obstructive sleep apnea. Treatment includes CPAP therapy.",
      { sourceName: "sleep-note.txt", credential: "physician" },
      ["obstructive sleep apnea"],
    );

    expect(analysis.nexusRelevantCount).toBe(0);
    expect(analysis.supportingCount).toBeGreaterThan(0);
    expect(analysis.excerpts.every((excerpt) => excerpt.strength === "supporting")).toBe(true);
  });

  it("does not promote causation language without a selected-condition match", () => {
    const analysis = analyzeEvidenceText(
      "The neuropathy is caused by uncontrolled diabetes mellitus.",
      { sourceName: "neurology-note.txt", credential: "physician" },
      ["PTSD", "migraine headaches"],
    );

    expect(analysis.nexusRelevantCount).toBe(0);
    expect(analysis.excerpts[0]?.strength).toBe("supporting");
  });
});
