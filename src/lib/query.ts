/**
 * Shared query-string helpers for App Router pages.
 *
 * The wizard and results pages carry session state in the URL (GET forms), so
 * every route needs the same small parsing/serialization utilities. These used
 * to be copy-pasted per page; keep them here so behavior changes in one place.
 */

export type QueryValue = string | string[] | undefined;
export type QueryParams = Record<string, QueryValue>;

/** First entry of a repeated parameter, or undefined. */
export function first(value: QueryValue): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Expands repeated parameters and comma-separated lists into trimmed strings.
 * Used where a single field can carry several values (e.g. `?primary=a,b`).
 */
export function toArray(value: QueryValue): string[] {
  if (!value) return [];

  return (Array.isArray(value) ? value : [value])
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Trims and drops empties without splitting on commas. Used when each repeated
 * parameter is already one value (e.g. checkbox lists).
 */
export function toTrimmedValues(value: QueryValue): string[] {
  if (!value) return [];

  return (Array.isArray(value) ? value : [value])
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** Serializes every defined parameter back into a `?a=1&a=2` query string. */
export function toBackQuery(params: QueryParams): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;

    for (const entry of Array.isArray(value) ? value : [value]) {
      search.append(key, entry);
    }
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Formats an ISO `yyyy-mm-dd` date as `Month D, yyyy`, falling back to the raw input. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  const monthIndex = Number(month) - 1;
  const dayNumber = Number(day);

  if (!year || Number.isNaN(monthIndex) || Number.isNaN(dayNumber)) {
    return iso;
  }
  const monthLabel = MONTH_NAMES[monthIndex];
  if (!monthLabel || dayNumber < 1 || dayNumber > 31) {
    return iso;
  }

  return `${monthLabel} ${dayNumber}, ${year}`;
}
