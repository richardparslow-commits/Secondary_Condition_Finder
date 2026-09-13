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

export type AccreditedRepValidationCode = keyof typeof ACCREDITED_REP_VALIDATION_MESSAGES;

export function accreditedRepValidationMessage(
  value: string | string[] | undefined,
): string | null {
  const code = Array.isArray(value) ? value[0] : value;
  if (!code || !Object.prototype.hasOwnProperty.call(ACCREDITED_REP_VALIDATION_MESSAGES, code)) {
    return null;
  }
  return ACCREDITED_REP_VALIDATION_MESSAGES[code as AccreditedRepValidationCode];
}
