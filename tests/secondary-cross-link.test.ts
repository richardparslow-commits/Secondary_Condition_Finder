import { describe, expect, it } from "vitest";

import { buildSecondaryCrossLinks } from "@/app/presumptive/results/secondary-cross-link";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { indexById } from "@/lib/catalog/lookup";
import type { ConditionCatalog } from "@/lib/catalog/schema";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { draftMappings, secondaryTargetIndex } from "@/lib/kb/lookup";
import { knowledgeBaseSchema, type KnowledgeBase } from "@/lib/kb/schema";
import { loadExposureCatalog } from "@/lib/presumptive/load";
import type { PresumptiveCondition } from "@/lib/presumptive/schema";
import {
  buildCausalMechanism,
  buildEvidentiaryProfile,
  buildNexusClaim,
} from "./helpers/crg-fixtures";

const realCatalog = loadConditionCatalog();

function syntheticCatalog(): ConditionCatalog {
  return [
    { id: "asthma", name: "Asthma", aliases: [], bodySystem: "Test", ratingSchedule: [], reviewNotes: ["test"] },
    { id: "gerd", name: "Gastroesophageal Reflux Disease (GERD)", aliases: [], bodySystem: "Test", ratingSchedule: [], reviewNotes: ["test"] },
    { id: "ptsd", name: "Post-Traumatic Stress Disorder (PTSD)", aliases: [], bodySystem: "Test", ratingSchedule: [], reviewNotes: ["test"] },
    { id: "unmapped", name: "Unmapped Condition", aliases: [], bodySystem: "Test", ratingSchedule: [], reviewNotes: ["test"] },
  ];
}

function syntheticKb(): KnowledgeBase {
  return knowledgeBaseSchema.parse([
    {
      id: "gerd",
      draft: false,
      todo: [],
      suggestions: [
        {
          conditionId: "asthma",
          rank: 1,
          nexusClaim: buildNexusClaim(),
          causalMechanism: buildCausalMechanism(),
          evidentiaryProfile: buildEvidentiaryProfile(),
          rationale: "Bounded association fixture.",
          evidenceGaps: ["Review evidence."],
          sourceReferences: [{ citation: "Fixture", note: "Fixture", verified: false }],
        },
      ],
    },
    {
      id: "ptsd",
      draft: false,
      todo: [],
      suggestions: [
        {
          conditionId: "asthma",
          rank: 1,
          nexusClaim: buildNexusClaim(),
          causalMechanism: buildCausalMechanism(),
          evidentiaryProfile: buildEvidentiaryProfile(),
          rationale: "Second bounded association fixture.",
          evidenceGaps: ["Review evidence."],
          sourceReferences: [{ citation: "Fixture 2", note: "Fixture", verified: false }],
        },
      ],
    },
  ]);
}

function pc(conditionId: string): PresumptiveCondition {
  return {
    conditionId,
    name: `Presumptive ${conditionId}`,
    group: "Test group",
    qualifier: undefined,
  } as unknown as PresumptiveCondition;
}

describe("secondaryTargetIndex", () => {
  it("indexes published secondary targets with sorted, deduplicated primaries", () => {
    const index = secondaryTargetIndex(syntheticKb());
    expect(index.get("asthma")).toEqual(["gerd", "ptsd"]);
    expect(index.has("gerd")).toBe(false);
  });

  it("excludes draft mappings, matching suggestion output", () => {
    const kb = syntheticKb();
    const drafts = draftMappings(kb);
    expect(drafts).toHaveLength(0);
    const index = secondaryTargetIndex(kb);
    for (const [target, primaries] of index) {
      expect(primaries.length).toBeGreaterThan(0);
      expect(target).not.toBe(primaries[0]);
    }
  });
});

describe("buildSecondaryCrossLinks", () => {
  it("intersects matched presumptive conditions with published secondary targets", () => {
    const links = buildSecondaryCrossLinks(
      [pc("asthma"), pc("unmapped")],
      syntheticCatalog(),
      syntheticKb(),
    );
    expect(links).toHaveLength(1);
    expect(links[0].name).toBe("Asthma");
    expect(links[0].primaryIds).toEqual(["gerd", "ptsd"]);
    expect(links[0].primaryNames).toEqual([
      "Gastroesophageal Reflux Disease (GERD)",
      "Post-Traumatic Stress Disorder (PTSD)",
    ]);
  });

  it("returns no links when nothing intersects", () => {
    const links = buildSecondaryCrossLinks(
      [pc("unmapped")],
      syntheticCatalog(),
      syntheticKb(),
    );
    expect(links).toEqual([]);
  });

  it("deduplicates repeated presumptive entries for the same condition", () => {
    const links = buildSecondaryCrossLinks(
      [pc("asthma"), pc("asthma")],
      syntheticCatalog(),
      syntheticKb(),
    );
    expect(links).toHaveLength(1);
  });

  it("degrades unknown catalog ids to the raw id instead of throwing", () => {
    const kb = knowledgeBaseSchema.parse([
      {
        id: "gerd",
        draft: false,
        todo: [],
        suggestions: [
          {
            conditionId: "not-in-catalog",
            rank: 1,
            nexusClaim: buildNexusClaim(),
            causalMechanism: buildCausalMechanism(),
            evidentiaryProfile: buildEvidentiaryProfile(),
            rationale: "Fixture targeting an id outside the synthetic catalog.",
            evidenceGaps: ["Review evidence."],
            sourceReferences: [{ citation: "Fixture", note: "Fixture", verified: false }],
          },
        ],
      },
    ]);
    const links = buildSecondaryCrossLinks([pc("not-in-catalog")], syntheticCatalog(), kb);
    expect(links).toHaveLength(1);
    expect(links[0].name).toBe("not-in-catalog");
    expect(links[0].primaryNames).toEqual(["Gastroesophageal Reflux Disease (GERD)"]);
  });

  it("every link resolves against the real catalog, exposure catalog, and KB", () => {
    const byId = indexById(realCatalog);
    const exposure = loadExposureCatalog();
    const allPresumptive = exposure.flatMap((category) => category.conditions);
    const links = buildSecondaryCrossLinks(allPresumptive, realCatalog, loadKnowledgeBase());

    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(byId.get(link.name)?.id ?? link.name).toBeDefined();
      for (const primaryId of link.primaryIds) {
        expect(byId.has(primaryId), `primary "${primaryId}" missing from catalog`).toBe(true);
      }
      for (const primaryName of link.primaryNames) {
        expect(primaryName.length).toBeGreaterThan(0);
      }
    }
  });
});
