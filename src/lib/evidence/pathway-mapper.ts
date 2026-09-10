import type { ContributingPrimary, Recommendation } from "@/lib/engine/types";
import type { MechanismCategory, NexusClassification } from "@/lib/kb/schema";

import type { EvidenceAnalysis } from "./extract";

/**
 * Rule-based projection of browser-local evidence excerpts (Step 4 local
 * analysis, stored per-tab in sessionStorage) onto the authored claim pathways
 * produced by the recommendation engine. This is the pathway-level complement
 * to gap-coverage.ts, which maps excerpts to authored evidence-gap sentences.
 *
 * Deterministic only: it groups and labels excerpts that already exist. It
 * never interprets findings beyond the stored classification, never invents
 * clinical text, never assigns probabilities, and performs no network egress.
 * A matched excerpt is a research cue — it does not establish causation,
 * aggravation, competency, probative weight, or VA's "at least as likely as
 * not" standard.
 */

export const NEXUS_CLAIM_LABEL: Record<NexusClassification, string> = {
  DIRECT_CAUSATION: "Direct causation — 38 CFR § 3.310(a)",
  AGGRAVATION: "Aggravation — 38 CFR § 3.310(b)",
  ASSOCIATION_ONLY: "Association only — no nexus claim asserted",
};

export const MECHANISM_CATEGORY_LABEL: Record<MechanismCategory, string> = {
  MICROVASCULAR_METABOLIC: "Microvascular / metabolic",
  BIOMECHANICAL_ALTERATION: "Biomechanical alteration",
  NEUROENDOCRINE_CASCADE: "Neuroendocrine cascade",
  PHARMACOLOGICAL_IATROGENIC: "Pharmacological (medication effect)",
  PSYCHOPHYSIOLOGICAL: "Psychophysiological",
  SYSTEMIC_INFLAMMATORY: "Systemic inflammatory",
  IMMUNE_MEDIATED: "Immune-mediated",
  THROMBOTIC_OR_VASCULAR: "Thrombotic / vascular",
  NEUROLOGICAL_DEGENERATION: "Neurological",
  METABOLIC_OR_NUTRITIONAL: "Metabolic / nutritional",
  MALIGNANT_TRANSFORMATION: "Malignant transformation",
  INFECTIOUS_SPREAD: "Infectious spread",
  MECHANICAL_OR_COMPRESSIVE: "Mechanical / compressive",
  POST_SURGICAL_OR_TREATMENT: "Post-surgical / treatment-related",
  MULTIFACTORIAL: "Multifactorial",
  NOT_ESTABLISHED: "Not biologically established",
};

export type PathwayEvidenceStatus =
  | "direct-support"
  | "supporting-only"
  | "related-excerpts"
  | "no-excerpts";

export interface PathwayEvidenceExcerpt {
  sourceName: string;
  locator: string;
  quote: string;
  category: string;
  strength: "nexus-relevant" | "supporting";
  clinicianAuthored: boolean;
}

export interface PathwayEvidenceRow {
  /** Secondary (non-service-connected) condition the pathway targets. */
  conditionId: string;
  conditionName: string;
  primaryId: string;
  primaryName: string;
  nexusClaim: NexusClassification | null;
  theoryLabel: string;
  mechanismLabel: string | null;
  consensusLabel: string | null;
  /** Excerpts whose nexus language matches this pathway's claim theory. */
  direct: PathwayEvidenceExcerpt[];
  /** Diagnosis/treatment/medication/timeline excerpts naming the primary. */
  supporting: PathwayEvidenceExcerpt[];
  /** Matched excerpts that are neither theory-matched nor classified supporting. */
  related: PathwayEvidenceExcerpt[];
  status: PathwayEvidenceStatus;
  gapCount: number;
}

const CAUSAL_CATEGORIES = new Set(["causation", "aggravation", "alternative-cause"]);
const SUPPORTING_CATEGORIES = new Set(["diagnosis", "treatment", "medication", "timeline"]);

function normalizeTerm(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
}

function excerptMatchesPrimary(
  matchedTerms: string[],
  primaryTerms: string[],
): boolean {
  const candidates = primaryTerms.map(normalizeTerm).filter((term) => term.length > 0);
  if (candidates.length === 0) return false;
  return matchedTerms.some((term) => {
    const normalized = normalizeTerm(term);
    return normalized.length > 0 && candidates.includes(normalized);
  });
}

/**
 * Condition-term strings the stored excerpts may carry for a contributing
 * primary. Excerpts were matched on the evidence-condition terms built at
 * Step 6 render time (catalog name + aliases); the display name is the stable
 * core, and the hyphenated condition id supplies mnemonic forms such as
 * "ptsd" that appear as stored matched terms.
 */
export function buildPrimaryConditionTerms(primary: Pick<ContributingPrimary, "id" | "name">): string[] {
  const terms = new Set<string>();
  const name = primary.name.trim();
  if (name) terms.add(name);
  for (const token of primary.id.split("-")) {
    if (token.length >= 4) terms.add(token);
  }
  return [...terms];
}

function theoryAllowsDirect(
  nexusClaim: NexusClassification | null,
  category: string,
  strength: string,
  clinicianAuthored: boolean,
): boolean {
  if (strength !== "nexus-relevant" || !clinicianAuthored) return false;
  if (nexusClaim === "DIRECT_CAUSATION") return category === "causation";
  if (nexusClaim === "AGGRAVATION") return category === "aggravation";
  return false;
}

function toRowExcerpt(analysis: EvidenceAnalysis, index: number): PathwayEvidenceExcerpt {
  const excerpt = analysis.excerpts[index];
  return {
    sourceName: analysis.sourceName,
    locator: excerpt.locator,
    quote: excerpt.quote,
    category: excerpt.category,
    strength: excerpt.strength,
    clinicianAuthored: excerpt.clinicianAuthored,
  };
}

/**
 * Maps stored excerpts onto every contributing-primary pathway of the given
 * recommendations. Rows are emitted in recommendation order, then primary
 * rank. Excerpts are deduplicated per row by category + quote + locator.
 */
export function mapEvidenceToPathways(
  results: readonly { conditionId: string; conditionName: string; recommendation: Recommendation | null }[],
  analyses: readonly EvidenceAnalysis[],
): PathwayEvidenceRow[] {
  const rows: PathwayEvidenceRow[] = [];

  for (const result of results) {
    const recommendation = result.recommendation;
    if (!recommendation) continue;

    for (const primary of recommendation.contributingPrimaries) {
      const primaryTerms = buildPrimaryConditionTerms(primary);
      const mechanismCategory = MECHANISM_CATEGORY_LABEL[
        primary.causalMechanism?.mechanismCategory as MechanismCategory
      ] ?? null;
      const nexusClaim = primary.nexusClaim?.nexusClassification ?? null;

      const direct: PathwayEvidenceExcerpt[] = [];
      const supporting: PathwayEvidenceExcerpt[] = [];
      const related: PathwayEvidenceExcerpt[] = [];
      const seen = new Set<string>();

      for (const analysis of analyses) {
        for (let index = 0; index < analysis.excerpts.length; index += 1) {
          const excerpt = analysis.excerpts[index];
          if (!excerptMatchesPrimary(excerpt.matchedTerms, primaryTerms)) continue;

          const key = `${excerpt.category}:${excerpt.quote.toLocaleLowerCase()}:${excerpt.locator}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const rowExcerpt = toRowExcerpt(analysis, index);
          if (theoryAllowsDirect(nexusClaim, excerpt.category, excerpt.strength, excerpt.clinicianAuthored)) {
            direct.push(rowExcerpt);
          } else if (SUPPORTING_CATEGORIES.has(excerpt.category)) {
            supporting.push(rowExcerpt);
          } else if (CAUSAL_CATEGORIES.has(excerpt.category)) {
            related.push(rowExcerpt);
          }
          // Non-causal, non-supporting categories (e.g. alternative-cause in
          // a claim theory that never allows direct support) fall into
          // `related` via the causal check above; anything else is excluded.
        }
      }

      rows.push({
        conditionId: result.conditionId,
        conditionName: result.conditionName,
        primaryId: primary.id,
        primaryName: primary.name,
        nexusClaim,
        theoryLabel: nexusClaim ? NEXUS_CLAIM_LABEL[nexusClaim] : "Authored pathway",
        mechanismLabel: mechanismCategory,
        consensusLabel: primary.evidentiaryProfile?.etiologicalConsensus ?? null,
        direct,
        supporting,
        related,
        status: direct.length > 0
          ? "direct-support"
          : supporting.length > 0
            ? "supporting-only"
            : related.length > 0
              ? "related-excerpts"
              : "no-excerpts",
        gapCount: recommendation.evidenceGaps.length,
      });
    }
  }

  return rows;
}

/**
 * Combines the pathway mapping text with the consultation-summary text for a
 * single browser-only download. Both inputs are already-rendered export text:
 * this helper only joins them and adds no content of its own.
 */
export function combineMappingWithClaimSummary(mappingText: string, claimSummaryText: string): string {
  const divider = "=".repeat(60);
  return `${mappingText}\n\n${divider}\n\n${claimSummaryText}`;
}

const STATUS_SUMMARY: Record<PathwayEvidenceStatus, string> = {
  "direct-support": "Nexus-relevant clinician-authored excerpts matching this pathway theory were found in your local analysis.",
  "supporting-only": "Supporting excerpts (diagnosis, treatment, medication, or timeline) name this primary condition, but no excerpt matches the pathway's nexus language yet.",
  "related-excerpts": "Related causal-language excerpts were found, but they do not match this pathway's claim theory (or are not clinician-authored).",
  "no-excerpts": "No local excerpt in this tab names this primary condition.",
};

/** One-sentence, honest summary of what the mapped excerpts can and cannot show. */
export function pathwayEvidenceStatusSummary(status: PathwayEvidenceStatus): string {
  return STATUS_SUMMARY[status];
}

/**
 * Plain-text export of the mapping for use alongside the consultation summary.
 * Contains only what is already on screen: pathway labels and stored excerpt
 * quotes. No probabilities, no determinations, no added clinical language.
 */
export function formatPathwayEvidenceMapping(rows: readonly PathwayEvidenceRow[]): string {
  const lines: string[] = [
    "Pathway Evidence Mapping (browser-local research cues)",
    "",
    "Excerpts below come from your own Step 4 local document analysis in this browser tab.",
    "They are grouped by authored research pathway. Matching text is a research cue only —",
    "it does not establish causation, aggravation, competency, probative weight, or VA's",
    "at-least-as-likely-as-not standard. Final determinations are made by VA.",
    "",
  ];

  if (rows.length === 0) {
    lines.push("No authored research pathways were available to map.");
    return lines.join("\n");
  }

  let currentCondition = "";
  for (const row of rows) {
    if (row.conditionName !== currentCondition) {
      currentCondition = row.conditionName;
      lines.push(`Condition: ${row.conditionName}`);
    }
    lines.push(`- Pathway: ${row.primaryName} → ${row.conditionName}`);
    lines.push(`  Theory: ${row.theoryLabel}`);
    if (row.mechanismLabel) lines.push(`  Mechanism: ${row.mechanismLabel}`);
    lines.push(`  Status: ${pathwayEvidenceStatusSummary(row.status)}`);
    const mapped = [...row.direct, ...row.supporting, ...row.related];
    if (mapped.length === 0) {
      lines.push("  Supporting excerpts: none found in this tab");
    } else {
      lines.push("  Supporting excerpts:");
      for (const excerpt of mapped) {
        lines.push(`   - "${excerpt.quote}" (${excerpt.sourceName}, ${excerpt.locator}; ${excerpt.category}${excerpt.strength === "nexus-relevant" ? ", nexus-relevant" : ""})`);
      }
    }
    lines.push(`  Authored evidence questions for this diagnosis: ${row.gapCount}`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
