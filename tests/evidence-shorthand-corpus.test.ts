import { describe, expect, it } from "vitest";

import { analyzeEvidenceText } from "../src/lib/evidence/extract";
import type {
  EvidenceAnalysis,
  EvidenceSourceMetadata,
} from "../src/lib/evidence/extract";

/**
 * Golden-corpus regression fixtures for the browser-local evidence classifier.
 *
 * One fixture per VA medical-record shorthand class. Each case pins the
 * expected category/strength so future pattern changes cannot silently
 * reintroduce false negatives (the veteran's strongest evidence never shown)
 * or false coverage (a gap marked "already addressed" by a negated sentence).
 *
 * These are pure classifier contracts: the module under test runs entirely in
 * the browser and never sees the server.
 */

const CLINICIAN: EvidenceSourceMetadata = {
  sourceName: "corpus-note.txt",
  credential: "physician",
};

function analyze(
  text: string,
  terms: string[],
  metadata: EvidenceSourceMetadata = CLINICIAN,
): EvidenceAnalysis {
  return analyzeEvidenceText(text, metadata, terms);
}

function excerpt(analysis: EvidenceAnalysis, pattern: RegExp) {
  return analysis.excerpts.find((candidate) => pattern.test(candidate.quote));
}

describe("evidence shorthand golden corpus", () => {
  describe("positive nexus language (favorable IMO conclusions)", () => {
    it("classifies 'more likely than not' as clinician nexus-relevant causation", () => {
      const analysis = analyze(
        "It is more likely than not that the veteran's obstructive sleep apnea is due to his service-connected PTSD.",
        ["PTSD", "obstructive sleep apnea"],
      );
      const nexus = excerpt(analysis, /more likely than not/i);
      expect(nexus).toBeDefined();
      expect(nexus?.category).toBe("causation");
      expect(nexus?.strength).toBe("nexus-relevant");
      expect(analysis.nexusRelevantCount).toBe(1);
    });

    it("classifies 'at least as likely as not' as clinician nexus-relevant causation", () => {
      const analysis = analyze(
        "It is at least as likely as not that the veteran's erectile dysfunction was caused by SSRI treatment for his PTSD.",
        ["PTSD", "erectile dysfunction"],
      );
      const nexus = excerpt(analysis, /at least as likely as not/i);
      expect(nexus).toBeDefined();
      expect(nexus?.category).toBe("causation");
      expect(nexus?.strength).toBe("nexus-relevant");
    });

    it("keeps the same language from a non-clinician as supporting only", () => {
      const analysis = analyze(
        "It is more likely than not that my sleep apnea is caused by my PTSD.",
        ["PTSD", "sleep apnea"],
        { sourceName: "lay-statement.txt", credential: "non-clinician" },
      );
      const statement = excerpt(analysis, /more likely than not/i);
      expect(statement).toBeDefined();
      expect(statement?.strength).toBe("supporting");
      expect(analysis.nexusRelevantCount).toBe(0);
    });
  });

  describe("exacerbation and flare-up aggravation language", () => {
    it("classifies 'exacerbated by' as aggravation", () => {
      const analysis = analyze(
        "The veteran's cervical strain is exacerbated by the limited range of motion from his service-connected lumbar condition.",
        ["cervical strain", "lumbar condition"],
      );
      const nexus = excerpt(analysis, /exacerbated by/i);
      expect(nexus).toBeDefined();
      expect(nexus?.category).toBe("aggravation");
      expect(nexus?.strength).toBe("nexus-relevant");
    });

    it("classifies 'exacerbations of ... caused by' as aggravation", () => {
      const analysis = analyze(
        "Exacerbations of the veteran's asthma are caused by exposure to mold in uninhibitable service-connected housing.",
        ["asthma", "housing"],
      );
      const nexus = excerpt(analysis, /exacerbations of/i);
      expect(nexus).toBeDefined();
      expect(nexus?.category).toBe("aggravation");
    });

    it("classifies 'flare-ups ... triggered by' as aggravation", () => {
      const analysis = analyze(
        "The patient's psoriasis flare-ups are triggered by psychological stress from his service-connected PTSD.",
        ["psoriasis", "PTSD"],
      );
      const nexus = excerpt(analysis, /flare-ups/i);
      expect(nexus).toBeDefined();
      expect(nexus?.category).toBe("aggravation");
    });

    it("does not read a bare problem-list 'exacerbation' as a nexus statement", () => {
      const analysis = analyze(
        "COPD exacerbation. Continue albuterol.",
        ["COPD"],
      );
      const entry = excerpt(analysis, /COPD exacerbation/i);
      // A bare exacerbation entry is at most a supporting problem-list line,
      // never an aggravation nexus claim.
      expect(entry?.category).not.toBe("aggravation");
      expect(analysis.nexusRelevantCount).toBe(0);
    });
  });

  describe("acronym matching from catalog aliases", () => {
    it("matches newly added catalog acronyms as whole tokens", () => {
      const analysis = analyze(
        "The veteran's MDD is improved with treatment but worsened by chronic pain from his service-connected knee condition.",
        ["MDD", "knee condition"],
      );
      const nexus = excerpt(analysis, /MDD/i);
      expect(nexus).toBeDefined();
      expect(nexus?.matchedTerms).toContain("MDD");
      expect(nexus?.strength).toBe("nexus-relevant");
    });

    it("matches CHF, CKD, HTN, and IBS catalog aliases", () => {
      const analysis = analyze(
        "Assessment: CHF, CKD, HTN, IBS.",
        ["CHF", "CKD", "HTN", "IBS"],
      );
      const line = excerpt(analysis, /CHF, CKD, HTN, IBS/);
      expect(line).toBeDefined();
      expect(line?.matchedTerms).toEqual(
        expect.arrayContaining(["CHF", "CKD", "HTN", "IBS"]),
      );
    });

    it("still refuses short acronyms embedded in unrelated words", () => {
      const analysis = analyze(
        "The rosacea is caused by medication exposure.",
        ["OSA"],
      );
      expect(analysis.nexusRelevantCount).toBe(0);
    });
  });

  describe("negation guard (no false gap coverage)", () => {
    it("never counts a negated causal finding as evidence", () => {
      const analysis = analyze(
        "No evidence that the veteran's obstructive sleep apnea was caused by his PTSD.",
        ["PTSD", "obstructive sleep apnea"],
      );
      expect(analysis.excerpts).toHaveLength(0);
      expect(analysis.nexusRelevantCount).toBe(0);
    });

    it("does not count denied diagnoses or negative findings", () => {
      const analysis = analyze(
        "Denies a diagnosis of PTSD. Negative for peripheral neuropathy.",
        ["PTSD", "peripheral neuropathy"],
      );
      expect(analysis.excerpts).toHaveLength(0);
    });

    it("does not promote section-context negations to diagnosis excerpts", () => {
      for (const line of ["No PTSD", "Denies PTSD", "Without PTSD"]) {
        const analysis = analyze(`Diagnosis:\n${line}`, ["PTSD"]);
        expect(
          analysis.excerpts.some((excerpt) => excerpt.matchedTerms.includes("PTSD")),
          line,
        ).toBe(false);
      }

      const positive = analyze("Diagnosis:\nPTSD-chronic", ["PTSD"]);
      const diagnosis = positive.excerpts.find(
        (excerpt) => excerpt.quote === "PTSD-chronic",
      );
      expect(diagnosis?.category).toBe("diagnosis");
      expect(diagnosis?.matchedTerms).toContain("PTSD");
    });

    it("keeps explicit unfavorable opinions visible as alternative-cause context", () => {
      const analysis = analyze(
        "The veteran's obstructive sleep apnea is not caused by his PTSD; it is more likely related to his documented obesity.",
        ["PTSD", "obstructive sleep apnea"],
      );
      const unfavorable = excerpt(analysis, /not caused by/i);
      expect(unfavorable).toBeDefined();
      expect(unfavorable?.category).toBe("alternative-cause");
      // Pinned classifier semantics: alternative-cause is deliberately part of
      // isNexusCategory, so a clinician-authored contrary opinion IS
      // nexus-relevant — the veteran must see and address it. The critical
      // assertion is that it is never labeled "causation" (a false positive
      // for the claim) nor silently dropped (a false negative).
      expect(unfavorable?.category).not.toBe("causation");
      expect(unfavorable?.category).not.toBe("aggravation");
    });

    it("keeps 'not more likely than not' as alternative-cause context, not causation", () => {
      const analysis = analyze(
        "It is not more likely than not that the knee condition caused the veteran's lumbar degeneration.",
        ["knee condition", "lumbar degeneration"],
      );
      const unfavorable = excerpt(analysis, /not more likely than not/i);
      expect(unfavorable).toBeDefined();
      expect(unfavorable?.category).toBe("alternative-cause");
    });

    it("does not suppress an evidence-bearing sentence that merely contains 'no' mid-sentence", () => {
      const analysis = analyze(
        "The veteran's insomnia is secondary to his PTSD; there is no other apparent cause.",
        ["PTSD", "insomnia"],
      );
      const nexus = excerpt(analysis, /insomnia is secondary to/i);
      expect(nexus).toBeDefined();
      expect(nexus?.category).toBe("causation");
      expect(nexus?.strength).toBe("nexus-relevant");
    });
  });

  describe("shorthand line length floor", () => {
    it("captures standalone '2/2 OSA' shorthand as clinician nexus evidence", () => {
      const analysis = analyze("2/2 OSA.", ["OSA"]);
      const line = excerpt(analysis, /2\/2 OSA/);
      expect(line).toBeDefined();
      expect(line?.category).toBe("causation");
      expect(line?.strength).toBe("nexus-relevant");
    });

    it("still ignores ultra-short noise fragments", () => {
      const analysis = analyze("dx: OSA.\nok\nnext", ["OSA"]);
      const noise = analysis.excerpts.find((candidate) =>
        /^(ok|next)$/i.test(candidate.quote),
      );
      expect(noise).toBeUndefined();
    });
  });
});
