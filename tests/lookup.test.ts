import { describe, expect, it } from "vitest";

import {
  findPrimaryCondition,
  listPrimaryConditions,
  normalizeConditionName,
} from "@/lib/kb/lookup";
import { loadKnowledgeBase } from "@/lib/kb/load";

const kb = loadKnowledgeBase();

describe("normalizeConditionName", () => {
  it("trims, lowercases, and collapses whitespace", () => {
    expect(normalizeConditionName("  PTSD  ")).toBe("ptsd");
    expect(normalizeConditionName("Knee   Injury")).toBe("knee injury");
  });
});

describe("findPrimaryCondition", () => {
  it("resolves by name regardless of surrounding whitespace or case", () => {
    expect(findPrimaryCondition(kb, " PTSD ")?.id).toBe("ptsd");
  });

  it("resolves by alias", () => {
    expect(findPrimaryCondition(kb, "type 2 diabetes")?.id).toBe(
      "diabetes-mellitus-type-2",
    );
    expect(findPrimaryCondition(kb, "ringing in ears")?.id).toBe("tinnitus");
  });

  it("resolves by id with hyphens or spaces", () => {
    expect(findPrimaryCondition(kb, "knee-injury")?.id).toBe("knee-injury");
    expect(findPrimaryCondition(kb, "knee injury")?.id).toBe("knee-injury");
  });

  it("returns null rather than guessing on partial input", () => {
    expect(findPrimaryCondition(kb, "knee")).toBeNull();
    expect(findPrimaryCondition(kb, "")).toBeNull();
    expect(findPrimaryCondition(kb, "plantar fasciitis")).toBeNull();
  });
});

describe("listPrimaryConditions", () => {
  it("returns every condition sorted by display name", () => {
    const names = listPrimaryConditions(kb).map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names).toContain("PTSD");
    expect(names).toContain("Obstructive sleep apnea");
    expect(names).toHaveLength(19);
  });
});
