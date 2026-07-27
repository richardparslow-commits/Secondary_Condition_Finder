import { z } from "zod";

import type {
  ExposureCatalog,
  ExposureCategory,
  PresumptiveCondition,
  QualifyingService,
} from "./schema";

export const serviceHistorySchema = z
  .object({
    /** Location labels the user selected, matched exactly against the data. */
    locations: z.array(z.string().min(1)).min(1, {
      message: "Select at least one location where you served.",
    }),
    serviceStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
    serviceEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  })
  .refine(
    (value) =>
      !value.serviceStart ||
      !value.serviceEnd ||
      value.serviceStart <= value.serviceEnd,
    { message: "Service start date must be on or before the end date.", path: ["serviceEnd"] },
  );

export type ServiceHistory = z.infer<typeof serviceHistorySchema>;

export interface MatchedPeriod {
  period: QualifyingService;
  matchedLocations: string[];
  /**
   * False when the user supplied no dates. The location qualifies, but whether
   * the date window is met is unconfirmed and must be said out loud.
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
   * True when at least one match rests on location alone because no service
   * dates were supplied.
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
 * This reports which presumptions *may* apply. It is not an eligibility
 * determination: VA also considers discharge characterization, the diagnosis
 * itself, and evidence that can rebut a presumption under 38 CFR 3.307(d).
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

      const datesConfirmed = Boolean(history.serviceStart || history.serviceEnd);

      if (datesConfirmed) {
        const start = history.serviceStart ?? history.serviceEnd!;
        const end = history.serviceEnd ?? history.serviceStart!;
        if (!rangesOverlap(start, end, period.startDate, period.endDate)) {
          continue;
        }
      } else {
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
