/**
 * Centralized Legal and Medical Guardrails
 * Enforces compliance across /, /secondary, /presumptive, and /results surfaces.
 */

export const MEDICAL_DISCLAIMER = "Educational guidance tool only. This tool does not provide medical diagnoses, legal advice, or official VA claim adjudication.";
export const NEVER_DIAGNOSTIC_NOTICE = "Informational estimate only — this platform is never diagnostic and does not establish a medical condition.";
export const UNVERIFIED_CITATION_WARNING = "Regulatory reference requires professional verification or independent medical validation.";

export const FORBIDDEN_PHRASES = [
  "you have been diagnosed with",
  "guaranteed VA rating",
  "official medical diagnosis",
  "this replaces a C&P exam",
  "approved claim"
];

export function validateGuardrails(text: string): { isValid: boolean; violations: string[] } {
  const lower = text.toLowerCase();
  const violations = FORBIDDEN_PHRASES.filter(phrase => lower.includes(phrase));
  return {
    isValid: violations.length === 0,
    violations
  };
}
