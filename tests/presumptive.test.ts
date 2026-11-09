import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadExposureCatalog } from "@/lib/presumptive/load";
import { matchPresumptives, serviceHistorySchema } from "@/lib/presumptive/match";
import {
  exposureCategorySchema,
  presumptiveSourceSchema,
  qualifyingServiceSchema,
} from "@/lib/presumptive/schema";

describe("presumptive source validation", () => {
  it("permits a future human-verified source without a schema migration", () => {
    const result = presumptiveSourceSchema.safeParse({
      citation: "VA source",
      note: "Qualified human review completed",
      url: "https://www.va.gov/",
      verified: true,
    });
    expect(result.success).toBe(true);
  });

  it("loads every currently shipped category with truthful unverified source references", () => {
    const catalog = loadExposureCatalog();
    expect(catalog.length).toBeGreaterThan(0);
    for (const category of catalog) {
      for (const source of category.sourceReferences) {
        expect(source.verified).toBe(false);
      }
    }
  });
});

describe("presumptive service-history validation", () => {
  const base = {
    locations: ["Iraq"],
    serviceStart: "2026-01-01",
    serviceEnd: "2026-12-31",
  };

  it.each([
    "2026-02-31",
    "2026-04-31",
    "2026-13-01",
    "2026-00-10",
    "2026-01-00",
    "2026-2-01",
  ])("rejects impossible or malformed service date %s", (invalidDate) => {
    expect(
      serviceHistorySchema.safeParse({ ...base, serviceStart: invalidDate }).success,
    ).toBe(false);
  });

  it("enforces Gregorian leap-year rules", () => {
    expect(
      serviceHistorySchema.safeParse({
        ...base,
        serviceStart: "2024-02-29",
        serviceEnd: "2024-02-29",
      }).success,
    ).toBe(true);
    expect(
      serviceHistorySchema.safeParse({
        ...base,
        serviceStart: "2000-02-29",
        serviceEnd: "2000-02-29",
      }).success,
    ).toBe(true);
    expect(
      serviceHistorySchema.safeParse({ ...base, serviceStart: "2023-02-29" }).success,
    ).toBe(false);
    expect(
      serviceHistorySchema.safeParse({ ...base, serviceStart: "1900-02-29" }).success,
    ).toBe(false);
  });

  it("does not misclassify an impossible end date as a date-order error", () => {
    const result = serviceHistorySchema.safeParse({
      ...base,
      serviceStart: "2026-03-01",
      serviceEnd: "2026-02-31",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(
      result.error.issues.some(
        (issue) => issue.path[0] === "serviceEnd" && issue.code === "invalid_format",
      ),
    ).toBe(true);
    expect(
      result.error.issues.some((issue) =>
        issue.message.includes("Service start date must be on or before the end date."),
      ),
    ).toBe(false);
  });

  it("still rejects a reversed pair of valid calendar dates", () => {
    const result = serviceHistorySchema.safeParse({
      ...base,
      serviceStart: "2026-03-01",
      serviceEnd: "2026-02-28",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.some((issue) =>
        issue.message.includes("Service start date must be on or before the end date."),
      ),
    ).toBe(true);
  });
});

describe("presumptive qualifying-service window validation", () => {
  const base = {
    id: "test-period",
    label: "Test period",
    locations: ["Test"],
    startDate: "2000-01-01",
    endDate: null,
    note: null,
  };

  it.each([
    "2020-02-30",
    "2019-02-29",
    "2020-04-31",
    "2020-13-01",
    "2020-00-10",
  ])("rejects impossible qualifying-service date %s", (invalidDate) => {
    expect(
      qualifyingServiceSchema.safeParse({ ...base, startDate: invalidDate }).success,
    ).toBe(false);
    expect(
      qualifyingServiceSchema.safeParse({ ...base, endDate: invalidDate }).success,
    ).toBe(false);
  });

  it("rejects a reversed qualifying-service window with an end-date error", () => {
    const result = qualifyingServiceSchema.safeParse({
      ...base,
      startDate: "2020-03-01",
      endDate: "2020-02-28",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.some(
        (issue) =>
          issue.path[0] === "endDate" &&
          issue.message.includes("Qualifying period ends before it starts."),
      ),
    ).toBe(true);
  });

  it("accepts open-ended, same-day, and leap-day windows", () => {
    expect(
      qualifyingServiceSchema.safeParse({ ...base, endDate: null }).success,
    ).toBe(true);
    expect(
      qualifyingServiceSchema.safeParse({
        ...base,
        startDate: "2020-02-29",
        endDate: "2020-02-29",
      }).success,
    ).toBe(true);
    expect(
      qualifyingServiceSchema.safeParse({
        ...base,
        startDate: "2024-02-29",
        endDate: "2025-02-28",
      }).success,
    ).toBe(true);
  });
});

describe("presumptive matching integration", () => {
  const catalog = loadExposureCatalog();

  it("matches burn pit service windows when location and dates overlap", () => {
    const result = matchPresumptives(catalog, {
      locations: ["Iraq"],
      serviceStart: "2006-01-01",
      serviceEnd: "2007-01-01",
    });

    expect(result.matches.some((match) => match.category.id === "burn-pits")).toBe(true);
  });

  it("keeps unmatched locations explicit", () => {
    const result = matchPresumptives(catalog, {
      locations: ["UnknownForwardBaseX"],
      serviceStart: "2008-01-01",
      serviceEnd: "2009-01-01",
    });

    expect(result.matches.length).toBe(0);
    expect(result.unmatchedLocations).toEqual(["UnknownForwardBaseX"]);
  });

  it("flags location-only matching when dates are omitted", () => {
    const result = matchPresumptives(catalog, {
      locations: ["Republic of Vietnam"],
      serviceStart: null,
      serviceEnd: null,
    });

    expect(result.hasUnconfirmedDates).toBe(true);
    expect(result.matches.length).toBeGreaterThan(0);
    expect(
      result.matches.some((match) =>
        match.matchedPeriods.some((period) => period.datesConfirmed === false),
      ),
    ).toBe(true);
  });

  it("does not collapse a start-only service history into a single-day interval", () => {
    const result = matchPresumptives(catalog, {
      locations: ["Republic of Vietnam"],
      serviceStart: "1970-01-01",
      serviceEnd: null,
    });

    expect(result.matches.some((match) => match.category.id === "agent-orange")).toBe(true);
    expect(result.hasUnconfirmedDates).toBe(true);
    expect(
      result.matches
        .flatMap((match) => match.matchedPeriods)
        .every((period) => period.datesConfirmed === false),
    ).toBe(true);
  });

  it("does not collapse an end-only service history into a single-day interval", () => {
    const result = matchPresumptives(catalog, {
      locations: ["Republic of Vietnam"],
      serviceStart: null,
      serviceEnd: "1970-12-31",
    });

    expect(result.matches.some((match) => match.category.id === "agent-orange")).toBe(true);
    expect(result.hasUnconfirmedDates).toBe(true);
  });

  it("uses a supplied one-sided bound to rule out an impossible period without claiming confirmation", () => {
    const result = matchPresumptives(catalog, {
      locations: ["Republic of Vietnam"],
      serviceStart: "2000-01-01",
      serviceEnd: null,
    });

    expect(result.matches.some((match) => match.category.id === "agent-orange")).toBe(false);
  });
});

describe("presumptive service-history input bounds", () => {
  const base = {
    locations: ["Iraq"],
    serviceStart: "2026-01-01",
    serviceEnd: "2026-12-31",
  };

  it("caps the location count so a hostile post cannot grow the cookie without bound", () => {
    const result = serviceHistorySchema.safeParse({
      ...base,
      locations: Array.from({ length: 51 }, (_, index) => `Location ${index}`),
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.some((issue) => issue.path[0] === "locations"),
    ).toBe(true);
  });

  it("caps each location label length", () => {
    expect(
      serviceHistorySchema.safeParse({ ...base, locations: ["x".repeat(121)] }).success,
    ).toBe(false);
    expect(
      serviceHistorySchema.safeParse({ ...base, locations: ["x".repeat(120)] }).success,
    ).toBe(true);
  });

  it("rejects branch-code text that is not a short uppercase token", () => {
    expect(
      serviceHistorySchema.safeParse({ ...base, serviceBranchCodes: ["army"] }).success,
    ).toBe(false);
    expect(
      serviceHistorySchema.safeParse({ ...base, serviceBranchCodes: ["<script>"] }).success,
    ).toBe(false);
    expect(
      serviceHistorySchema.safeParse({ ...base, serviceBranchCodes: ["ARMY"] }).success,
    ).toBe(true);
  });

  it("enforces catalog membership for locations before any browser-local write", () => {
    // The schema module has no catalog dependency, so the intake module must do
    // the allowlist check; pin the wiring so it cannot be dropped silently.
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/lib/presumptive/browser-history.ts"),
      "utf8",
    );
    expect(source).toContain("serviceHistorySchema.safeParse");
    expect(source).toContain("new Set(knownLocations)");
    expect(source).toContain(".has(location)");
    expect(source).toContain("persistServiceHistory");
  });
});

describe("presumptive category schema", () => {
  it("requires sourceCheckedOn and at least one source reference", () => {
    const result = exposureCategorySchema.safeParse({
      id: "test-category",
      name: "Test Category",
      authority: "Authority",
      summary: "Summary",
      qualifyingService: [
        {
          id: "test-period",
          label: "Test period",
          locations: ["Test"],
          startDate: "2000-01-01",
          endDate: null,
          note: null,
        },
      ],
      conditions: [
        {
          conditionId: "test-condition",
          name: "Test condition",
          group: "Test group",
          qualifier: null,
        },
      ],
      sourceReferences: [],
    });

    expect(result.success).toBe(false);
  });
});
