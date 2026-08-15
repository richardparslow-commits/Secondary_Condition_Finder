import { z } from "zod";

import type {
  ExposureCatalog,
  ExposureCategory,
  PresumptiveCondition,
  QualifyingService,
} from "./schema";

const serviceDateSchema = z.iso.date();

function isValidServiceDate(value: string): boolean {
  return serviceDateSchema.safeParse(value).success;
}

export const serviceHistorySchema = z
  .object({
    /** Optional administrative context; deliberately ignored by matchPresumptives. */
    serviceBranchCodes: z.array(z.string().trim().min(1).max(64)).max(8).optional(),
    /** Location labels the user selected, matched exactly against the data. */
    locations: z.array(z.string().min(1)).min(1, {
      message: "Select at least one location where you served.",
    }),
    serviceStart: serviceDateSchema.nullable().default(null),
    serviceEnd: serviceDateSchema.nullable().default(null),
  })
  .refine(
    (value) =>
      !value.serviceStart ||
      !value.serviceEnd ||
      !isValidServiceDate(value.serviceStart) ||
      !isValidServiceDate(value.serviceEnd) ||
      value.serviceStart <= value.serviceEnd,
    { message: "Service start date must be on or before the end date.", path: ["serviceEnd"] },
  );

export type ServiceHistory = z.infer<typeof serviceHistorySchema>;

export interface MatchedPeriod {
  period: QualifyingService;
  matchedLocations: string[];
  /**
   * True only when both service dates were supplied and the interval was fully
   * checked. A one-sided date can exclude impossible periods but cannot confirm
   * that the full qualifying window requirement is satisfied.
   */
  datesConfirmed: boolean;
}

export interface CategoryMatch {
  category: ExposureCategory;
  matchedPeriods: MatchedPeriod[];
  conditions: PresumptiveCondition[];
}

export interface PresumptiveResult {
  matches: CategoryMatch[];
  /** Locations the user selected that matched no qualifying period. */
  unmatchedLocations: string[];
  /**
   * True when at least one match has no complete service date range and
   * therefore requires the user to verify the qualifying window.
   */
  hasUnconfirmedDates: boolean;
}

/** ISO date strings compare correctly with string comparison. */
function rangesOverlap(
  aStart: string,
  aEnd: string | null,
  bStart: string,
  bEnd: string | null,
): boolean {
  if (aEnd && aEnd < bStart) return false;
  if (bEnd && bEnd < aStart) return false;
  return true;
}

/**
 * Applies only the service-date bounds the user actually supplied. A known
 * start can rule out a qualifying period that ended before service began; a
 * known end can rule out a period that began after service ended. Missing one
 * bound must never be collapsed into a synthetic one-day service interval.
 */
function partialRangeMayOverlap(
  serviceStart: string | null,
  serviceEnd: string | null,
  periodStart: string,
  periodEnd: string | null,
): boolean {
  if (serviceStart && periodEnd && serviceStart > periodEnd) return false;
  if (serviceEnd && serviceEnd < periodStart) return false;
  return true;
}

/** Every distinct location across the catalog, for building the UI. */
export function listLocations(catalog: ExposureCatalog): string[] {
  const locations = new Set<string>();
  for (const category of catalog) {
    for (const period of category.qualifyingService) {
      for (const location of period.locations) locations.add(location);
    }
  }
  return [...locations].sort((a, b) => a.localeCompare(b));
}

/**
 * Matches a service history against exposure categories.
 *
 * Service-branch reference values are intentionally not consulted here. This
 * reports which presumptions *may* apply from the authored location/date rules;
 * it is not an eligibility determination. VA also considers discharge
 * characterization, the diagnosis itself, and evidence that can rebut a
 * presumption under 38 CFR 3.307(d).
 */
export function matchPresumptives(
  catalog: ExposureCatalog,
  history: ServiceHistory,
): PresumptiveResult {
  const selected = [...new Set(history.locations)];
  const matchedLocationSet = new Set<string>();
  const matches: CategoryMatch[] = [];
  let hasUnconfirmedDates = false;

  for (const category of catalog) {
    const matchedPeriods: MatchedPeriod[] = [];

    for (const period of category.qualifyingService) {
      const matchedLocations = selected.filter((location) =>
        period.locations.includes(location),
      );
      if (matchedLocations.length === 0) continue;

      const datesConfirmed = Boolean(history.serviceStart && history.serviceEnd);

      if (datesConfirmed) {
        if (
          !rangesOverlap(
            history.serviceStart!,
            history.serviceEnd,
            period.startDate,
            period.endDate,
          )
        ) {
          continue;
        }
      } else {
        if (
          !partialRangeMayOverlap(
            history.serviceStart,
            history.serviceEnd,
            period.startDate,
            period.endDate,
          )
        ) {
          continue;
        }
        hasUnconfirmedDates = true;
      }

      for (const location of matchedLocations) matchedLocationSet.add(location);
      matchedPeriods.push({ period, matchedLocations, datesConfirmed });
    }

    if (matchedPeriods.length > 0) {
      matches.push({
        category,
        matchedPeriods,
        conditions: [...category.conditions].sort(
          (a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name),
        ),
      });
    }
  }

  return {
    matches,
    unmatchedLocations: selected.filter(
      (location) => !matchedLocationSet.has(location),
    ),
    hasUnconfirmedDates,
  };
}
