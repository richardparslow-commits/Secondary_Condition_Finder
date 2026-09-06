/**
 * Consent storage for optional telemetry (Application Insights).
 *
 * Telemetry is off by default. It is only initialized after the visitor
 * explicitly chooses "Allow analytics", and the choice is remembered in the
 * browser only (localStorage) so declining is respected on later visits.
 */

export const TELEMETRY_CONSENT_KEY = "scf-telemetry-consent";

export type TelemetryConsent = "granted" | "declined";

export function readTelemetryConsent(
  storage: Pick<Storage, "getItem">,
): TelemetryConsent | null {
  const value = storage.getItem(TELEMETRY_CONSENT_KEY);
  return value === "granted" || value === "declined" ? value : null;
}

export function storeTelemetryConsent(
  storage: Pick<Storage, "setItem">,
  consent: TelemetryConsent,
): void {
  storage.setItem(TELEMETRY_CONSENT_KEY, consent);
}
