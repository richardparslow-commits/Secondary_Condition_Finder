import { describe, expect, it } from "vitest";

import { indexById } from "@/lib/catalog/lookup";
import { loadConditionCatalog } from "@/lib/catalog/load";
import {
  mappedConditionIds,
  publishedMappings,
  secondaryTargetIndex,
} from "@/lib/kb/lookup";
import { loadKnowledgeBase } from "@/lib/kb/load";

describe("high-severity performance remediations", () => {
  it("memoizes catalog id index for the same loaded catalog instance", () => {
    const catalog = loadConditionCatalog();

    const first = indexById(catalog);
    const second = indexById(catalog);

    expect(second).not.toBe(first);
    expect(second.size).toBe(first.size);
    expect(second.get("ptsd")).toEqual(first.get("ptsd"));
  });

  it("memoizes published mapping indexes for the same loaded KB instance", () => {
    const kb = loadKnowledgeBase();

    const firstPublished = publishedMappings(kb);
    const secondPublished = publishedMappings(kb);
    expect(secondPublished).not.toBe(firstPublished);
    expect(secondPublished.size).toBe(firstPublished.size);

    const firstMappedIds = mappedConditionIds(kb);
    const secondMappedIds = mappedConditionIds(kb);
    expect(secondMappedIds).not.toBe(firstMappedIds);
    expect(secondMappedIds.size).toBe(firstMappedIds.size);

    const firstSecondaryTargets = secondaryTargetIndex(kb);
    const secondSecondaryTargets = secondaryTargetIndex(kb);
    expect(secondSecondaryTargets).not.toBe(firstSecondaryTargets);
    expect(secondSecondaryTargets.size).toBe(firstSecondaryTargets.size);
  });
});
