import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import {
  findCondition,
  groupByBodySystem,
  indexById,
  normalizeConditionName,
} from "@/lib/catalog/lookup";

const catalog = loadConditionCatalog();

describe("condition catalog", () => {
  it("loads every body system file", () => {
    expect(catalog.length).toBeGreaterThan(150);
  });

  it("uses globally unique ids", () => {
    const ids = catalog.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("assigns every condition a body system", () => {
    for (const condition of catalog) {
      expect(condition.bodySystem.length).toBeGreaterThan(0);
    }
  });

  it("does not mark any rating citation verified without human review", () => {
    const verified = catalog.flatMap((condition) =>
      condition.ratingSchedule.filter((reference) => reference.verified),
    );
    expect(verified).toEqual([]);
  });

  it("records a review note whenever a rating citation is missing", () => {
    // Never invent a citation. An entry without one must say why.
    for (const condition of catalog) {
      if (condition.ratingSchedule.length === 0) {
        expect(condition.reviewNotes.length).toBeGreaterThan(0);
      }
    }
  });

  it("formats every rating citation consistently", () => {
    for (const condition of catalog) {
      for (const reference of condition.ratingSchedule) {
        expect(reference.citation).toMatch(/^38 CFR 4\.\d+[a-z]?$/);
        expect(reference.note.length).toBeGreaterThan(0);
      }
    }
  });

  it("never reuses an alias across two conditions", () => {
    const seen = new Map<string, string>();
    for (const condition of catalog) {
      for (const alias of condition.aliases) {
        const key = normalizeConditionName(alias);
        const previous = seen.get(key);
        expect(
          previous,
          `alias "${alias}" is claimed by both ${previous} and ${condition.id}`,
        ).toBeUndefined();
        seen.set(key, condition.id);
      }
    }
  });

  it("never lets an alias collide with another condition's name or id", () => {
    const names = new Map(
      catalog.map((c) => [normalizeConditionName(c.name), c.id]),
    );
    const ids = new Map(catalog.map((c) => [c.id, c.id]));
    for (const condition of catalog) {
      for (const alias of condition.aliases) {
        const key = normalizeConditionName(alias);
        const byName = names.get(key);
        if (byName) expect(byName).toBe(condition.id);
        const byId = ids.get(key.replace(/\s+/g, "-"));
        if (byId) expect(byId).toBe(condition.id);
      }
    }
  });
});

describe("findCondition", () => {
  it("resolves by name, id, and alias", () => {
    expect(findCondition(catalog, "Tinnitus")?.id).toBe("tinnitus");
    expect(findCondition(catalog, "ptsd")?.id).toBe("ptsd");
    expect(findCondition(catalog, "  PTSD  ")?.id).toBe("ptsd");
    expect(findCondition(catalog, "Post Traumatic Stress Disorder")?.id).toBe(
      "ptsd",
    );
    expect(findCondition(catalog, "diabetes-mellitus-type-2")?.id).toBe(
      "diabetes-mellitus-type-2",
    );
  });

  it("returns null rather than guessing on partial input", () => {
    expect(findCondition(catalog, "knee")).toBeNull();
    expect(findCondition(catalog, "")).toBeNull();
    expect(findCondition(catalog, "not a real condition")).toBeNull();
  });
});

describe("indexById and groupByBodySystem", () => {
  it("indexes every condition", () => {
    expect(indexById(catalog).size).toBe(catalog.length);
  });

  it("groups without losing or duplicating a condition", () => {
    const groups = groupByBodySystem(catalog);
    const total = groups.reduce((sum, [, items]) => sum + items.length, 0);
    expect(total).toBe(catalog.length);
    expect(groups.length).toBeGreaterThan(5);
  });
});
