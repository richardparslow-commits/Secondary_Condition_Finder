import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { EvidenceAnalysis, EvidenceExcerpt } from "../src/lib/evidence/extract";
import {
  buildPrimaryConditionTerms,
  combineMappingWithClaimSummary,
  formatPathwayEvidenceMapping,
  mapEvidenceToPathways,
  pathwayEvidenceStatusSummary,
} from "../src/lib/evidence/pathway-mapper";
import type { Recommendation } from "../src/lib/engine/types";
import type { EvidentiaryProfile } from "../src/lib/kb/schema";

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function excerpt(overrides: Partial<EvidenceExcerpt>): EvidenceExcerpt {
  return {
    sourceName: "Treatment Records",
    locator: "line 4",
    quote: "Clinician statement",
    category: "diagnosis",
    strength: "supporting",
    clinicianAuthored: true,
    matchedTerms: [],
    ...overrides,
  };
}

function analysis(excerpts: EvidenceExcerpt[]): EvidenceAnalysis {
  return {
    version: 1,
    sourceName: excerpts[0]?.sourceName ?? "Records",
    excerpts,
    nexusRelevantCount: excerpts.filter((e) => e.strength === "nexus-relevant").length,
    supportingCount: excerpts.filter((e) => e.strength === "supporting").length,
  };
}

const evidentiaryProfile: EvidentiaryProfile = {
  etiologicalConsensus: "PROBABLE",
  vaNexusProbabilityAlignment: "AT_LEAST_AS_LIKELY_AS_NOT",
  conservativeRationale:
    "Authored conservative rationale describing the basis for the nexus claim in medically conservative terms.",
  evidenceGaps: "Authored evidence gaps sentence.",
  alternativeEtiologiesToRuleOut: ["Alternative etiology one"],
  requiresSpecificDbqEvidence: false,
};

function recommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    conditionId: "sleep-apnea",
    condition: "Sleep Apnea",
    bodySystem: "Respiratory",
    etiologicalConsensus: "PROBABLE",
    score: 2,
    contributingPrimaries: [
      {
        id: "ptsd",
        name: "Posttraumatic Stress Disorder",
        rank: 1,
        rationale: "Authored rationale.",
        nexusClaim: {
          nexusClassification: "AGGRAVATION",
          baselineProgression:
            "Authored baseline progression description of the natural non-service-connected course of the condition.",
          aggravatingFactor:
            "Authored aggravating factor description of how the service-connected condition worsens the condition.",
        },
        causalMechanism: {
          mechanismCategory: "PSYCHOPHYSIOLOGICAL",
          primaryVector:
            "Authored primary vector describing the psychophysiological cascade between the conditions.",
          hypothesizedOnly: false,
        },
        evidentiaryProfile,
      },
    ],
    evidenceGaps: ["Baseline severity records", "Nexus opinion"],
    sourceReferences: [],
    matchedIntakeContext: [],
    ...overrides,
  };
}

const results = (recommendations: (Recommendation | null)[]) =>
  recommendations.map((rec, index) => ({
    conditionId: rec?.conditionId ?? `unmapped-${index}`,
    conditionName: rec?.condition ?? "Unmapped Condition",
    bodySystem: "Respiratory",
    recommendation: rec,
  }));

describe("pathway evidence mapper", () => {
  it("places theory-matched clinician-authored nexus excerpts in direct support", () => {
    const rows = mapEvidenceToPathways(
      results([recommendation()]),
      [
        analysis([
          excerpt({
            category: "aggravation",
            strength: "nexus-relevant",
            clinicianAuthored: true,
            matchedTerms: ["ptsd"],
            quote: "PTSD symptoms worsened the sleep disturbance beyond its natural progression.",
          }),
        ]),
      ],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("direct-support");
    expect(rows[0].direct).toHaveLength(1);
    expect(rows[0].direct[0].quote).toContain("worsened");
    expect(rows[0].theoryLabel).toContain("Aggravation");
    expect(rows[0].mechanismLabel).toBe("Psychophysiological");
    expect(rows[0].consensusLabel).toBe("PROBABLE");
  });

  it("places diagnosis and treatment excerpts in supporting only", () => {
    const rows = mapEvidenceToPathways(
      results([recommendation()]),
      [
        analysis([
          excerpt({ category: "diagnosis", matchedTerms: ["ptsd"], quote: "Diagnosis: chronic PTSD, severe." }),
          excerpt({ category: "treatment", matchedTerms: ["ptsd"], quote: "Treatment with trauma-focused therapy ongoing." }),
        ]),
      ],
    );

    expect(rows[0].status).toBe("supporting-only");
    expect(rows[0].supporting).toHaveLength(2);
    expect(rows[0].direct).toHaveLength(0);
  });

  it("keeps causal language that does not match the claim theory as related only", () => {
    const rows = mapEvidenceToPathways(
      results([recommendation()]),
      [
        analysis([
          excerpt({
            category: "causation",
            strength: "nexus-relevant",
            clinicianAuthored: true,
            matchedTerms: ["ptsd"],
            quote: "Sleep apnea is likely proximately due to PTSD.",
          }),
        ]),
      ],
    );

    expect(rows[0].status).toBe("related-excerpts");
    expect(rows[0].related).toHaveLength(1);
    expect(rows[0].direct).toHaveLength(0);
    expect(rows[0].supporting).toHaveLength(0);
  });

  it("reports no excerpts when nothing names the primary condition", () => {
    const rows = mapEvidenceToPathways(
      results([recommendation()]),
      [analysis([excerpt({ category: "diagnosis", matchedTerms: ["diabetes"], quote: "Diagnosis of diabetes noted." })])],
    );

    expect(rows[0].status).toBe("no-excerpts");
    expect(rows[0].direct).toHaveLength(0);
    expect(rows[0].supporting).toHaveLength(0);
  });

  it("never reports direct support for a bare primary without a nexus claim", () => {
    const bare = recommendation({
      contributingPrimaries: [
        {
          id: "ptsd",
          name: "Posttraumatic Stress Disorder",
          rank: 1,
          rationale: "Authored rationale.",
        },
      ],
    });
    const rows = mapEvidenceToPathways(
      results([bare]),
      [
        analysis([
          excerpt({
            category: "causation",
            strength: "nexus-relevant",
            clinicianAuthored: true,
            matchedTerms: ["ptsd"],
            quote: "Sleep apnea is proximately due to PTSD.",
          }),
        ]),
      ],
    );

    expect(rows[0].nexusClaim).toBeNull();
    expect(rows[0].theoryLabel).toBe("Authored pathway");
    expect(rows[0].direct).toHaveLength(0);
    expect(rows[0].status).toBe("related-excerpts");
  });

  it("skips results without a published recommendation and dedupes identical excerpts", () => {
    const duplicated = excerpt({
      category: "diagnosis",
      matchedTerms: ["ptsd"],
      quote: "Diagnosis: chronic PTSD.",
    });
    const rows = mapEvidenceToPathways(
      results([recommendation(), null]),
      [analysis([duplicated]), analysis([{ ...duplicated, strength: "supporting" }])],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].supporting).toHaveLength(1);
  });

  it("preserves excerpt order when one excerpt matches multiple primary terms", () => {
    const rows = mapEvidenceToPathways(
      results([recommendation()]),
      [
        analysis([
          excerpt({
            category: "diagnosis",
            matchedTerms: ["Posttraumatic Stress Disorder", "ptsd"],
            quote: "First excerpt",
            locator: "line 1",
          }),
          excerpt({
            category: "treatment",
            matchedTerms: ["ptsd"],
            quote: "Second excerpt",
            locator: "line 2",
          }),
        ]),
      ],
    );

    expect(rows[0].supporting.map((item) => item.quote)).toEqual([
      "First excerpt",
      "Second excerpt",
    ]);
  });

  it("builds primary condition terms from the name and id tokens", () => {
    expect(buildPrimaryConditionTerms({ id: "ptsd", name: "Posttraumatic Stress Disorder" })).toEqual([
      "Posttraumatic Stress Disorder",
      "ptsd",
    ]);
  });

  it("exports the mapping with pathways, excerpts, and the research-cue boundary only", () => {
    const rows = mapEvidenceToPathways(
      results([recommendation()]),
      [
        analysis([
          excerpt({
            category: "aggravation",
            strength: "nexus-relevant",
            clinicianAuthored: true,
            matchedTerms: ["ptsd"],
            quote: "PTSD worsened the sleep disturbance.",
          }),
        ]),
      ],
    );
    const text = formatPathwayEvidenceMapping(rows);

    expect(text).toContain("Pathway: Posttraumatic Stress Disorder → Sleep Apnea");
    expect(text).toContain("Aggravation — 38 CFR § 3.310(b)");
    expect(text).toContain("PTSD worsened the sleep disturbance.");
    expect(text).toContain("research cue");
    expect(text).not.toMatch(/\d{2}%/);
    expect(text).not.toContain("establishes");
    expect(text).not.toContain("nexus is established");
  });

  it("summarizes every status honestly without determination language", () => {
    for (const status of ["direct-support", "supporting-only", "related-excerpts", "no-excerpts"] as const) {
      const summary = pathwayEvidenceStatusSummary(status);
      expect(summary.length).toBeGreaterThan(20);
      expect(summary).toMatch(/excerpt/i);
    }
    expect(pathwayEvidenceStatusSummary("direct-support")).toContain(
      "matching this pathway theory",
    );
  });

  it("combines mapping and summary text with a divider and adds no content of its own", () => {
    const combined = combineMappingWithClaimSummary("MAPPING SECTION", "SUMMARY SECTION");

    expect(combined).toContain("MAPPING SECTION");
    expect(combined).toContain("SUMMARY SECTION");
    const mappingEnd = combined.indexOf("MAPPING SECTION") + "MAPPING SECTION".length;
    const summaryStart = combined.indexOf("SUMMARY SECTION");
    expect(combined.slice(mappingEnd, summaryStart).trim().length).toBeGreaterThan(0);
    expect(combined.startsWith("MAPPING SECTION")).toBe(true);
    expect(combined.trimEnd().endsWith("SUMMARY SECTION")).toBe(true);
  });
});

describe("pathway evidence mapper governance contracts", () => {
  it("performs no network egress and imports no LLM or transport modules", () => {
    const moduleSource = readRepoFile("src/lib/evidence/pathway-mapper.ts");
    const component = readRepoFile("src/components/evidence/PathwayEvidenceMapper.tsx");

    for (const source of [moduleSource, component]) {
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toContain("XMLHttpRequest");
      expect(source).not.toContain("sendBeacon");
      expect(source).not.toMatch(/from\s+["'](node:)?(http|https|net)["']/);
      expect(source.toLowerCase()).not.toContain("openai");
      expect(source.toLowerCase()).not.toContain("anthropic");
      expect(source.toLowerCase()).not.toContain("llm");
    }
  });

  it("reads only the browser-local evidence store in the component", () => {
    const component = readRepoFile("src/components/evidence/PathwayEvidenceMapper.tsx");

    expect(component).toContain("evidenceAnalysisStorageKey");
    expect(component).toContain("window.sessionStorage");
    expect(component).not.toContain("localStorage");
  });

  it("keeps the rejected LLM design out of the component copy", () => {
    const component = readRepoFile("src/components/evidence/PathwayEvidenceMapper.tsx");

    expect(component).not.toContain("AI Analysis");
    expect(component).toContain("Research cues, not determinations");
    expect(component).toContain("No text leaves this browser tab");
  });

  it("wires the mapper into Step 6 after the local evidence review", () => {
    const page = readRepoFile("src/app/secondary/evidence/page.tsx");

    expect(page).toContain('import { PathwayEvidenceMapper } from "@/components/evidence/PathwayEvidenceMapper";');
    const mapperIndex = page.indexOf(
      "<PathwayEvidenceMapper results={nonServiceConnectedResults} recommendations={consultationRecommendations} />",
    );
    const localReviewIndex = page.indexOf("<LocalEvidenceReview />");
    expect(mapperIndex).toBeGreaterThan(-1);
    expect(mapperIndex).toBeGreaterThan(localReviewIndex);
  });

  it("offers the combined mapping + summary export with the same privacy-stripped inputs", () => {
    const component = readRepoFile("src/components/evidence/PathwayEvidenceMapper.tsx");
    const page = readRepoFile("src/app/secondary/evidence/page.tsx");

    expect(component).toContain("Download mapping + consultation summary");
    expect(component).toContain('formatClaimSummary(recommendations, [])');
    expect(component).toContain("combineMappingWithClaimSummary");
    expect(component).toContain("does not include raw local-evidence excerpts");
    // The combined download must reuse the consultation-summary component for
    // the standalone export, and the page must no longer render it twice.
    expect(component).toContain("ConsultationSummaryDownload");
    expect(page).not.toContain("<ConsultationSummaryDownload");
    expect(page).toContain("Downloads are in the Pathway Evidence Mapping section");
  });
});
