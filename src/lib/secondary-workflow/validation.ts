export const SECONDARY_VALIDATION_MESSAGES = {
  "select-diagnosed": "Select at least one diagnosed condition to continue.",
  "answer-service-connected": "Choose Yes or No for every diagnosed condition before continuing.",
  "no-service-connected": "This secondary workflow needs at least one condition already recognized as service connected. If none are already service connected, return to the research tracks instead of marking a new condition as established.",
  "select-rating": "Choose a current rating or I prefer not to answer for every service-connected condition.",
  "invalid-rating": "Use a whole-number rating from 0 through 100, or choose I prefer not to answer.",
  "select-documents": "Choose whether document availability should be reflected in the checklist.",
  "invalid-context": "Optional medication and treatment context is limited to 20 entries per field and 160 characters per entry.",
} as const;

export type SecondaryValidationCode = keyof typeof SECONDARY_VALIDATION_MESSAGES;
export type SecondaryValidationPath =
  | "/secondary/diagnosed"
  | "/secondary/service-connected"
  | "/secondary/ratings"
  | "/secondary/upload";

export function secondaryValidationMessage(
  value: string | string[] | undefined,
): string | null {
  const code = Array.isArray(value) ? value[0] : value;
  if (!code || !Object.prototype.hasOwnProperty.call(SECONDARY_VALIDATION_MESSAGES, code)) {
    return null;
  }
  return SECONDARY_VALIDATION_MESSAGES[code as SecondaryValidationCode];
}

export function secondaryValidationPath(
  path: SecondaryValidationPath,
  code: SecondaryValidationCode,
): string {
  return `${path}?error=${code}`;
}
