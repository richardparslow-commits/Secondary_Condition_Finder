import { describe, expect, it } from "vitest";

import { loadExposureCatalog } from "@/lib/presumptive/load";
import {
  listLocations,
  matchPresumptives,
  serviceHistorySchema,
  type ServiceHistory,
} from "@/lib/presumptive/match";

const catalog = loadExposureCatalog();

function history(partial: Partial<ServiceHistory> & Pick<ServiceHistory, "locations">) {
  return serviceHistorySchema.parse(partial);
}

describe("exposure catalog integrity", () => {
  it("loads and validates both exposure categories", () => {
    expect(catalog.map((c) => c.id).sort()).toEqual([
      "agent-orange",
      "burn-pits",
    ]);
  });

  it("uses unique conditionIds within each category", () => {
    for (const category of catalog) {
      const ids = category.conditions.map((c) => c.conditionId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("gives every category at least one citation with a resolvable url", () => {
    for (const category of catalog) {
      expect(category.sourceReferences.length).toBeGreaterThan(0);
      for (const reference of category.sourceReferences) {
        expect(reference.url).toMatch(/^https:\/\//);
      }
    }
  });

  it("does not mark any citation verified without human review", () => {
    const verified = catalog.flatMap((category) =>
      category.sourceReferences.filter((reference) => reference.verified),
    );
    expect(verified).toEqual([]);
  });

  it("uses ordered, valid date windows", () => {
    for (const category of catalog) {
      for (const period of category.qualifyingService) {
        expect(period.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        if (period.endDate) {
          expect(period.endDate >= period.startDate).toBe(true);
        }
      }
    }
  });

  it("keeps the Agent Orange windows closed and the burn pit windows open", () => {
    const ao = catalog.find((c) => c.id === "agent-orange")!;
    const burn = catalog.find((c) => c.id === "burn-pits")!;
    expect(ao.qualifyingService.every((p) => p.endDate !== null)).toBe(true);
    expect(burn.qualifyingService.every((p) => p.endDate === null)).toBe(true);
  });
});

describe("listLocations", () => {
  it("returns a sorted, deduplicated list across both categories", () => {
    const locations = listLocations(catalog);
    expect(locations).toEqual([...new Set(locations)]);
    expect(locations).toEqual([...locations].sort((a, b) => a.localeCompare(b)));
    expect(locations).toContain("Iraq");
    expect(locations).toContain("Republic of Vietnam");
  });
});

describe("matchPresumptives", () => {
  it("matches burn pit exposure for Iraq service after August 1990", () => {
    const result = matchPresumptives(
      catalog,
      history({
        locations: ["Iraq"],
        serviceStart: "2004-01-01",
        serviceEnd: "2005-01-01",
      }),
    );

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].category.id).toBe("burn-pits");
    expect(result.matches[0].conditions.map((c) => c.conditionId)).toContain(
      "asthma",
    );
    expect(result.hasUnconfirmedDates).toBe(false);
  });

  it("rejects Iraq service that predates the burn pit window", () => {
    const result = matchPresumptives(
      catalog,
      history({
        locations: ["Iraq"],
        serviceStart: "1988-01-01",
        serviceEnd: "1989-12-31",
      }),
    );
    expect(result.matches).toEqual([]);
    expect(result.unmatchedLocations).toEqual(["Iraq"]);
  });

  it("rejects Vietnam service after the herbicide window closed", () => {
    const result = matchPresumptives(
      catalog,
      history({
        locations: ["Republic of Vietnam"],
        serviceStart: "1976-01-01",
        serviceEnd: "1977-01-01",
      }),
    );
    expect(result.matches).toEqual([]);
  });

  it("matches a service period that only partially overlaps the window", () => {
    // Window closes 1975-05-07. Service starting 1975-01-01 overlaps.
    const result = matchPresumptives(
      catalog,
      history({
        locations: ["Republic of Vietnam"],
        serviceStart: "1975-01-01",
        serviceEnd: "1976-06-01",
      }),
    );
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].category.id).toBe("agent-orange");
  });

  it("matches the exact boundary dates of a window", () => {
    const opensOn = matchPresumptives(
      catalog,
      history({
        locations: ["Iraq"],
        serviceStart: "1990-08-02",
        serviceEnd: "1990-08-02",
      }),
    );
    expect(opensOn.matches).toHaveLength(1);

    const dayBefore = matchPresumptives(
      catalog,
      history({
        locations: ["Iraq"],
        serviceStart: "1990-08-01",
        serviceEnd: "1990-08-01",
      }),
    );
    expect(dayBefore.matches).toEqual([]);
  });

  it("respects the narrow Cambodia window", () => {
    const inside = matchPresumptives(
      catalog,
      history({
        locations: ["Cambodia"],
        serviceStart: "1969-04-20",
        serviceEnd: "1969-04-22",
      }),
    );
    expect(inside.matches).toHaveLength(1);

    const outside = matchPresumptives(
      catalog,
      history({
        locations: ["Cambodia"],
        serviceStart: "1969-05-01",
        serviceEnd: "1969-06-01",
      }),
    );
    expect(outside.matches).toEqual([]);
  });

  it("matches on location alone when no dates are given, and flags it", () => {
    const result = matchPresumptives(catalog, history({ locations: ["Iraq"] }));
    expect(result.matches).toHaveLength(1);
    expect(result.hasUnconfirmedDates).toBe(true);
    expect(result.matches[0].matchedPeriods[0].datesConfirmed).toBe(false);
  });

  it("can match both categories at once", () => {
    const result = matchPresumptives(
      catalog,
      history({ locations: ["Iraq", "Republic of Vietnam"] }),
    );
    expect(result.matches.map((m) => m.category.id).sort()).toEqual([
      "agent-orange",
      "burn-pits",
    ]);
    expect(result.unmatchedLocations).toEqual([]);
  });

  it("reports locations that matched nothing", () => {
    const result = matchPresumptives(
      catalog,
      history({
        locations: ["Republic of Vietnam", "Iraq"],
        serviceStart: "1968-01-01",
        serviceEnd: "1969-01-01",
      }),
    );
    expect(result.matches.map((m) => m.category.id)).toEqual(["agent-orange"]);
    expect(result.unmatchedLocations).toEqual(["Iraq"]);
  });

  it("carries the melanoma qualifier that excludes other skin cancers", () => {
    const result = matchPresumptives(catalog, history({ locations: ["Iraq"] }));
    const melanoma = result.matches[0].conditions.find(
      (c) => c.conditionId === "melanoma",
    );
    expect(melanoma?.qualifier).toMatch(/basal cell and squamous cell/i);
  });
});

describe("serviceHistorySchema", () => {
  it("requires at least one location", () => {
    expect(() => serviceHistorySchema.parse({ locations: [] })).toThrow();
  });

  it("rejects an end date before the start date", () => {
    expect(() =>
      serviceHistorySchema.parse({
        locations: ["Iraq"],
        serviceStart: "2005-01-01",
        serviceEnd: "2004-01-01",
      }),
    ).toThrow();
  });

  it("defaults both dates to null", () => {
    const parsed = serviceHistorySchema.parse({ locations: ["Iraq"] });
    expect(parsed.serviceStart).toBeNull();
    expect(parsed.serviceEnd).toBeNull();
  });
});
