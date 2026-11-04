export const VALID_RATINGS = [
  "0%", "10%", "20%", "30%", "40%", "50%",
  "60%", "70%", "80%", "90%", "100%", "100% P&T"
] as const;

export type ValidRating = typeof VALID_RATINGS[number];

/**
 * Form/transport token for 100% P&T.
 *
 * It must be distinct from plain "100": they are different answers. Sharing a
 * value silently dropped the permanent-and-total designation on the way to
 * saved state (Heal defect 17) and left the step with no plain 100% choice,
 * because the P&T option overwrote it in the option map (defect 35).
 */
export const PERMANENT_AND_TOTAL_RATING_VALUE = "100-pt";

/** Submitted value for one rating option. */
export function ratingOptionValue(rating: ValidRating): string {
  return rating === "100% P&T"
    ? PERMANENT_AND_TOTAL_RATING_VALUE
    : rating.replace("%", "");
}

/** True when a submitted rating value carries the P&T designation. */
export function isPermanentAndTotalRatingValue(value: string | undefined): boolean {
  return value === PERMANENT_AND_TOTAL_RATING_VALUE;
}

/**
 * Display label for a stored rating. The flag is only meaningful at 100; a
 * stale flag on any other tier is ignored rather than relabelled.
 */
export function ratingDisplayLabel(
  rating: number | null | undefined,
  permanentAndTotal: boolean,
): string | null {
  if (rating === null || rating === undefined) return null;
  return permanentAndTotal && rating === 100 ? "100% P&T" : `${rating}%`;
}
