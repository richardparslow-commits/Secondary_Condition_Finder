/**
 * Browser-local, deterministic discovery of condition *mentions* in medical
 * records. Catalog matches are research prompts, never new diagnoses or nexus
 * conclusions. No network, patient-data logging, or server-side import.
 *
 * Only call this on already-bounded extracted segments in a browser component.
 */
import type { CatalogCondition, ConditionCatalog } from "@/lib/catalog/schema";
import { conditionTermGuardFor, conditionTermPatternFor } from "@/lib/evidence/condition-terms";
import type { ClinicianCredential, EvidenceTextSegment } from "@/lib/evidence/extract";

export type RecordMentionCategory =
  | "diagnosis-statement"
  | "suspected"
  | "historical"
  | "ruled-out"
  | "family-history"
  | "symptom-only"
  | "ambiguous";

export type RecordClaimStatus = "not-yet-claimed" | "pending" | "denied" | "unknown";
export interface RecordConditionCandidate {
  conditionId: string;
  conditionName: string;
  category: RecordMentionCategory;
  sourceId: string;
  sourceName: string;
  locator: string;
  quote: string;
  clinicianAuthored: boolean;
}

export const RECORD_DISCOVERY_MAX_LINES = 3000;
export const RECORD_DISCOVERY_MAX_CANDIDATES = 30;
export const RECORD_DISCOVERY_MAX_QUOTE_CHARS = 300;
const MAX_TERM_ALIASES = 5;
const MAX_LINE_CHARS = 1200;
// A short label is accepted only if it has a unique catalog owner and appears
// in a named diagnosis/assessment context. Unknown 3-5 letter chart acronyms
// remain excluded to avoid interpreting medical abbreviations speculatively.
const CONTEXTUAL_SHORT_ALIASES = new Set(["osa", "ptsd", "tbi", "gerd", "cfs"]);

type MatcherEntry = {
  conditionId: string; conditionName: string; anchor: string;
  pattern: RegExp; guard: RegExp | null;
  /** Selected low-risk shorthand may match only inside explicit diagnosis context. */
  diagnosisContextRequired: boolean;
};
export type RecordConditionMatcher = readonly MatcherEntry[];

const DIAGNOSIS_HEADER = /^(?:diagnos(?:is|es)|assessment|impressions?|active\s+problems|problem\s+list|medical\s+diagnoses?)\s*:?\s*$/i;
const RESET_HEADER = /^(?:plan|treatment|medications|family\s+history|review\s+of\s+systems|social\s+history|procedure|physical\s+exam(?:ination)?|follow[- ]up|history\s+of\s+present\s+illness)\s*:?\s*$/i;
// Conservative exclusion screen: a family member's condition must not be
// suggested as this Veteran's diagnosis. Colon-terminated FHx headers and
// "mother has" phrasing are common in medical notes.
const FAMILY_HISTORY = /\b(?:family\s*(?:history|hx)|fam\s*hx|fhx|fmhx)\b|\b(?:mother|father|parent|sibling|brother|sister|child|son|daughter|grandmother|grandfather|aunt|uncle)\s+(?:has|had|with|diagnos(?:ed|is)|suffers?|affected)\b/i;
// Fail closed on simple chart negation. It is safer to hold an ambiguous
// statement for clinician review than offer a non-existent disease for opt-in.
const RULED_OUT = /\b(?:rule(?:d)?\s+out|r\/o|no|not|never|negative|absent|denies?|denied|without|unlikely|excluded)\b/i;
const SUSPECTED = /\b(?:possible|possibly|suspected?|probable|perhaps|questionable|concern\s+for|differential|consider|evaluation\s+for|evaluating\s+for|may\s+have|question\s+of|working\s+diagnosis|suggestive\s+of|versus|vs\.?)\b/i;
const HISTORICAL = /\b(?:history\s+of|hx\s+of|previously|resolved|remote\s+history|prior\s+diagnosis)\b/i;
const SYMPTOM_ONLY = /\b(?:symptoms?\s+(?:of|include)|complains?\s+of|reports?\s+of|screen(?:ing)?\s+for|c\/o)\b/i;
const DIAGNOSIS_STATED = /\b(?:dx|diagnos(?:is|es|ed)|assessment|impression|active\s+problems?)\b\s*(?::|with|of)?(?=\s|$)/i;
const BOILERPLATE = /\b(?:38\s+(?:cfr|c\.f\.r\.|usc|u\.s\.c\.)|service\s+connection\s+may\s+be\s+granted|diagnostic\s+code\s+\d{4})\b/i;
const CLINICIANS = new Set<ClinicianCredential>([
  "physician", "psychologist", "np-pa", "other-licensed-clinician",
]);

function acceptableTerm(value: string): boolean {
  const term = value.trim();
  if (term.length < 3 || term.length > 100) return false;
  if (term.length < 6 && !conditionTermGuardFor(term) &&
      !CONTEXTUAL_SHORT_ALIASES.has(term.toLocaleLowerCase())) return false;
  if (/^\d+$/.test(term)) return false;
  return true;
}

/**
 * Terms shared between catalog entries (including broad synonyms) are skipped:
 * an ambiguous lexical identity must never guess which disease is meant.
 */
export function buildRecordConditionMatcher(catalog: ConditionCatalog): RecordConditionMatcher {
  const entries: Array<{ term: string; condition: CatalogCondition }> = [];
  const owners = new Map<string, Set<string>>();
  for (const condition of catalog) {
    const distinct = [...new Set([condition.name, ...condition.aliases.slice(0, MAX_TERM_ALIASES)]
      .map((term) => term.trim()).filter(acceptableTerm))];
    for (const term of distinct) {
      const lower = term.toLocaleLowerCase();
      if (!owners.has(lower)) owners.set(lower, new Set());
      owners.get(lower)?.add(condition.id);
      entries.push({ term, condition });
    }
  }
  return entries.flatMap(({ term, condition }) => {
    if (owners.get(term.toLocaleLowerCase())?.size !== 1) return [];
    const pattern = conditionTermPatternFor(term);
    if (!pattern) return [];
    const anchor = term.toLocaleLowerCase().split(/[\s\u00a0\u2010-\u2015-]/)[0];
    return [{ conditionId: condition.id, conditionName: condition.name,
      anchor, pattern, guard: conditionTermGuardFor(term),
      diagnosisContextRequired: term.length < 6 && !conditionTermGuardFor(term),
    }];
  });
}

function classify(sentence: string, inDiagnosisSection: boolean): RecordMentionCategory {
  if (FAMILY_HISTORY.test(sentence)) return "family-history";
  if (RULED_OUT.test(sentence)) return "ruled-out";
  if (SUSPECTED.test(sentence) || /\?\s*$/.test(sentence)) return "suspected";
  if (HISTORICAL.test(sentence)) return "historical";
  if (SYMPTOM_ONLY.test(sentence)) return "symptom-only";
  if (inDiagnosisSection || DIAGNOSIS_STATED.test(sentence)) return "diagnosis-statement";
  return "ambiguous";
}

/**
 * Per-document output. Quotes and filenames remain solely in the browser's
 * transient React review state; only veteran-approved catalog IDs and claim
 * statuses may enter the existing bounded browser workflow record.
 */
export function discoverRecordConditionCandidates(
  segments: readonly EvidenceTextSegment[],
  metadata: { sourceId: string; sourceName: string; credential: ClinicianCredential },
  matcher: RecordConditionMatcher,
): RecordConditionCandidate[] {
  if (!metadata.sourceId || !matcher.length) return [];
  const out: RecordConditionCandidate[] = [];
  const seen = new Set<string>();
  let lineCount = 0;
  for (const segment of segments) {
    let diagnosisSection = false;
    for (const raw of segment.text.replace(/\r\n?/g,"\n").split("\n")) {
      lineCount++;
      if (lineCount > RECORD_DISCOVERY_MAX_LINES || out.length >= RECORD_DISCOVERY_MAX_CANDIDATES) return out;
      const line = raw.trim();
      if (!line) { diagnosisSection = false; continue; }
      if (DIAGNOSIS_HEADER.test(line)) { diagnosisSection = true; continue; }
      if (RESET_HEADER.test(line) || (/:\s*$/.test(line) && line.length < 80)) diagnosisSection = false;
      if (line.length > MAX_LINE_CHARS || BOILERPLATE.test(line)) continue;
      const parts = line.split(/(?:;\s*|(?<=[.!?])\s+(?=[A-Z0-9]))/).filter(Boolean);
      for (const part of parts) {
        const sentence = part.trim();
        if (sentence.length < 3 || sentence.length > MAX_LINE_CHARS || BOILERPLATE.test(sentence)) continue;
        const lower = sentence.toLocaleLowerCase();
        for (const m of matcher) {
          if (!lower.includes(m.anchor) || !m.pattern.test(sentence) || (m.guard && !m.guard.test(sentence))) continue;
          if (m.diagnosisContextRequired && !diagnosisSection && !DIAGNOSIS_STATED.test(sentence)) continue;
          const category = classify(sentence, diagnosisSection);
          const key = metadata.sourceId + ":" + m.conditionId + ":" + category;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            conditionId: m.conditionId, conditionName: m.conditionName,
            category, sourceId: metadata.sourceId,
            sourceName: metadata.sourceName.slice(0, 160),
            locator: (segment.locatorPrefix + ", line " + lineCount).slice(0, 240),
            quote: sentence.slice(0, RECORD_DISCOVERY_MAX_QUOTE_CHARS),
            clinicianAuthored: CLINICIANS.has(metadata.credential),
          });
          if (out.length >= RECORD_DISCOVERY_MAX_CANDIDATES) return out;
        }
      }
    }
  }
  return out;
}
