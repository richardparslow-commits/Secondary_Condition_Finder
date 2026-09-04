/**
 * Centralized Legal and Medical Guardrails
 *
 * FORBIDDEN_PHRASES is enforced in two places:
 * 1. `assertNoForbiddenPhrases` in `src/lib/kb/validate.ts` fails closed at
 *    knowledge-base load time when authored suggestion text (rationale,
 *    evidence gaps) contains any phrase below.
 * 2. `tests/legal-copy-contracts.test.ts` asserts rendered pages never
 *    contain them.
 *
 * `validateGuardrails` is the shared checker behind those contracts.
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
