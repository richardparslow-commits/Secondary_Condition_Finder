export const ACCREDITED_REP_TYPE_VALUES = ["VSO", "agent", "attorney"] as const;
export type AccreditedRepType = (typeof ACCREDITED_REP_TYPE_VALUES)[number];

export const APPROVED_RADIUS_MILES = [25, 50, 100] as const;
export type ApprovedRadiusMiles = (typeof APPROVED_RADIUS_MILES)[number];

export const ZIP_RE = /^[0-9]{5}$/;

export const ACCREDITED_REP_VALIDATION_MESSAGES = {
  "invalid-zip": "Enter a 5-digit US zip code.",
  "invalid-radius": `Radius must be one of ${APPROVED_RADIUS_MILES.join(", ")} miles.`,
  "invalid-type": `Type must be one of ${ACCREDITED_REP_TYPE_VALUES.join(", ")}.`,
} as const;

/**
 * The locator's validation vocabulary, consumed by the Server Action (which
 * picks the code) and by the rendered alert (which shows the copy).
 *
 * The predecessor of this list was read back out of an `?error=` query
 * parameter; audit A01 took the lookup out of the URL, so the code now travels
 * as action state and the URL-parameter reader was deleted rather than left as
 * a second, unused transport.
 */
export type AccreditedRepValidationCode = keyof typeof ACCREDITED_REP_VALIDATION_MESSAGES;
