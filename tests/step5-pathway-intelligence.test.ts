import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { recommend } from "@/lib/engine/recommend";
import { loadKnowledgeBase } from "@/lib/kb/load";
import {
  pathwayIntelligenceSchema,
  type KnowledgeBase,
} from "@/lib/kb/schema";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

function stripPathwayIntelligence(kb: KnowledgeBase): KnowledgeBase {
  return kb.map((mapping) => ({
    ...mapping,
    suggestions: mapping.suggestions.map((suggestion) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { pathwayIntelligence: _dropped, ...rest } = suggestion;
      return rest;
    }),
  }));
}

describe("Step 5 authored pathway intelligence", () => {
  it("keeps the authored metadata bounded and rejects duplicate pathway labels", () => {
    expect(
      pathwayIntelligenceSchema.safeParse({
        pathways: ["direct-secondary", "intermediate-chain"],
        causalChain: "Primary → intermediate mechanism → secondary",
        developmentQuestions: ["What mechanism should be evaluated?"],
        issuesToResolve: ["Confirm the individual medical relationship."],
      }).success,
    ).toBe(true);

    expect(
      pathwayIntelligenceSchema.safeParse({
        pathways: ["direct-secondary", "direct-secondary"],
      }).success,
    ).toBe(false);

    expect(
      pathwayIntelligenceSchema.safeParse({
        pathways: [
          "direct-secondary",
          "aggravation",
          "medication-related",
          "biomechanical",
          "intermediate-chain",
        ],
      }).success,
    ).toBe(false);

    expect(
      pathwayIntelligenceSchema.safeParse({
        pathways: ["direct-secondary"],
        developmentQuestions: Array.from({ length: 7 }, (_, index) => `Question ${index}`),
      }).success,
    ).toBe(false);

    expect(
      pathwayIntelligenceSchema.safeParse({
        pathways: ["direct-secondary"],
        issuesToResolve: Array.from({ length: 6 }, (_, index) => `Issue ${index}`),
      }).success,
    ).toBe(false);
  });

  it("carries only explicitly authored pathway intelligence on the contributing primary", () => {
    const catalog = loadConditionCatalog();
    const kb = loadKnowledgeBase();
    const intake = {
      primaryConditions: ["ptsd"],
      symptoms: [] as string[],
      medications: [] as string[],
      treatments: [] as string[],
      exposures: [] as string[],
      notes: "",
    };

    const ptsd = recommend(catalog, kb, intake);
    const osa = ptsd.recommendations.find((item) => item.conditionId === "sleep-apnea");
    const ed = ptsd.recommendations.find((item) => item.conditionId === "erectile-dysfunction");

    expect(osa?.contributingPrimaries[0]?.pathwayIntelligence).toBeUndefined();
    expect(ed?.contributingPrimaries[0]?.pathwayIntelligence?.pathways).toEqual([
      "medication-related",
    ]);

    const stripped = recommend(catalog, stripPathwayIntelligence(kb), intake);
    const strippedOsa = stripped.recommendations.find(
      (item) => item.conditionId === "sleep-apnea",
    );
    expect(strippedOsa?.contributingPrimaries[0]?.pathwayIntelligence).toBeUndefined();
  });

  it("does not let pathway intelligence affect recommendation order, score, or etiological consensus", () => {
    const catalog = loadConditionCatalog();
    const kb = loadKnowledgeBase();
    const intake = {
      primaryConditions: ["ptsd", "sleep-apnea"],
      symptoms: [] as string[],
      medications: [] as string[],
      treatments: [] as string[],
      exposures: [] as string[],
      notes: "",
    };

    const enriched = recommend(catalog, kb, intake).recommendations.map((item) => ({
      conditionId: item.conditionId,
      score: item.score,
      etiologicalConsensus: item.etiologicalConsensus,
    }));
    const stripped = recommend(
      catalog,
      stripPathwayIntelligence(kb),
      intake,
    ).recommendations.map((item) => ({
      conditionId: item.conditionId,
      score: item.score,
      etiologicalConsensus: item.etiologicalConsensus,
    }));

    expect(enriched).toEqual(stripped);
  });

  it("keeps pathway intelligence out of intake matching and wires conservative diagnosis-centered Step 5 presentation", () => {
    const engine = read("src/lib/engine/recommend.ts");
    const signals = read("src/lib/engine/signals.ts");
    const component = read("src/components/NonServiceConnectedConditionResult.tsx");
    const page = read("src/app/secondary/suggestions/page.tsx");

    expect(engine).toContain("pathwayIntelligence: suggestion.pathwayIntelligence");
    // Post-refactor: the intake-matching guard (and its comment) lives in
    // signals.ts; recommend.ts orchestrates it. Check both so the contract
    // holds regardless of module layout.
    expect(engine + signals).toContain("Authored pathway-intelligence fields are deliberately excluded");

    expect(component).toContain("Authored pathway to evaluate");
    expect(component).toContain("Questions to develop with a clinician or representative");
    expect(component).toContain("Issues to resolve before relying on this theory");
    expect(component).toContain("A mapping is a research lead, not an individual nexus finding");
    expect(component).toContain("Legal framework");
    expect(component).toContain("Clinical evidence");
    expect(component).toContain("Procedural guidance");

    expect(page).toContain("Direction matters:");
    expect(page).toContain("The page does not search for additional diagnoses that might develop in the future");
    expect(page).toContain("Step 6 is limited to the same diagnosed non-service-connected conditions");
  });
});
