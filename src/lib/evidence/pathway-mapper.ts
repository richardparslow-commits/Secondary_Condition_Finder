import type { ContributingPrimary, Recommendation } from "@/lib/engine/types";
import type { MechanismCategory, NexusClassification } from "@/lib/kb/schema";

import type { EvidenceAnalysis, EvidenceExcerpt } from "./extract";

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

interface IndexedExcerpt {
  analysis: EvidenceAnalysis;
  index: number;
  sequence: number;
}

function indexExcerptsByMatchedTerm(analyses: readonly EvidenceAnalysis[]): Map<string, IndexedExcerpt[]> {
  const index = new Map<string, IndexedExcerpt[]>();
  let sequence = 0;
  for (const analysis of analyses) {
    for (let excerptIndex = 0; excerptIndex < analysis.excerpts.length; excerptIndex += 1) {
      const excerpt = analysis.excerpts[excerptIndex];
      const entry: IndexedExcerpt = { analysis, index: excerptIndex, sequence };
      sequence += 1;
      const normalizedTerms = new Set(
        excerpt.matchedTerms
          .map(normalizeTerm)
          .filter((term) => term.length > 0),
      );
      for (const term of normalizedTerms) {
        const entries = index.get(term);
        if (entries) entries.push(entry);
        else index.set(term, [entry]);
      }
    }
  }
  return index;
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
  const excerptsByMatchedTerm = indexExcerptsByMatchedTerm(analyses);
  const rows: PathwayEvidenceRow[] = [];

  for (const result of results) {
    const recommendation = result.recommendation;
    if (!recommendation) continue;

    for (const primary of recommendation.contributingPrimaries) {
      const primaryTerms = new Set(
        buildPrimaryConditionTerms(primary)
          .map(normalizeTerm)
          .filter((term) => term.length > 0),
      );
      const mechanismCategory = MECHANISM_CATEGORY_LABEL[
        primary.causalMechanism?.mechanismCategory as MechanismCategory
      ] ?? null;
      const nexusClaim = primary.nexusClaim?.nexusClassification ?? null;

      const direct: PathwayEvidenceExcerpt[] = [];
      const supporting: PathwayEvidenceExcerpt[] = [];
      const related: PathwayEvidenceExcerpt[] = [];
      const seen = new Set<string>();

      const candidates = new Map<number, IndexedExcerpt>();
      for (const term of primaryTerms) {
        const excerpts = excerptsByMatchedTerm.get(term);
        if (!excerpts) continue;
        for (const indexedExcerpt of excerpts) {
          candidates.set(indexedExcerpt.sequence, indexedExcerpt);
        }
      }
      const sortedCandidates = [...candidates.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, value]) => value);
      for (const indexedExcerpt of sortedCandidates) {
        const excerpt = indexedExcerpt.analysis.excerpts[indexedExcerpt.index];

        const key = `${excerpt.category}:${excerpt.quote.toLocaleLowerCase()}:${excerpt.locator}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const rowExcerpt = toRowExcerpt(indexedExcerpt.analysis, indexedExcerpt.index);
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

/* ─── Hop-level annotation (multi-hop pathways) ───────────────────────────── */

/** Minimal structural view of one pathway hop for annotation purposes. */
export interface HopLike {
  /** 0-based position of this hop within its pathway. */
  stepIndex: number;
  edge: {
    sourceConditionId: string;
    targetConditionId: string;
  };
}

/** Structural view of one hop for the per-hop text export (adds the legal classification). */
export type PathwayHopLike = HopLike & {
  edge: HopLike["edge"] & { nexusClassification: NexusClassification };
};

/** Composite legal nexus of a whole pathway chain (mirrors the canonical enum). */
export type CompositeNexus = "DIRECT_CAUSATION" | "AGGRAVATION" | "ASSOCIATION_ONLY_CHAIN_BROKEN";

/**
 * Structural view of a traversed 1–2 hop pathway for the per-hop text export,
 * mirroring the client view-model without importing it (this module stays
 * engine-agnostic and is also consumed before the view layer exists).
 */
export interface ClaimPathwayLike {
  originConditionId: string;
  terminalConditionId: string;
  hops: readonly PathwayHopLike[];
  compositeNexus: CompositeNexus;
}

/**
 * A browser-local excerpt annotated with the pathway hop it supports.
 * `supportedHopIndex` is the `stepIndex` (0-based) of the hop whose legal
 * theory the excerpt speaks to; `PathwayEvidenceTable` joins on it with
 * strict equality.
 */
export type HopAnnotatedExcerpt = EvidenceExcerpt & { supportedHopIndex: number };

/**
 * Annotates stored excerpts with the hop (`stepIndex`) of the given pathway
 * they support, ready for `PathwayEvidenceTable`.
 *
 * Assignment is a stable two-tier match per hop:
 *
 *   1. **Target match** — the excerpt's matched terms include a term of the
 *      hop's *target* condition. For the final hop this is the claimed
 *      condition itself; for an upstream hop it is the intermediate link.
 *      Named evidence is the stronger cue for a hop's nexus theory, so it
 *      wins over context-only matching.
 *   2. **Source match** — otherwise, the excerpt matched a term of the hop's
 *      *source* condition: diagnosis, treatment, medication, or timeline
 *      excerpts that anchor the condition the hop departs from are the
 *      context every nexus theory needs.
 *
 * An excerpt matching several hops lands under the first one (lowest
 * `stepIndex`), so each excerpt renders under exactly one hop section.
 * Condition terms are derived from the catalog ID (its kebab-case form and
 * its tokens of four or more characters, mirroring
 * `buildPrimaryConditionTerms`) plus, when supplied, the display name —
 * excerpts that matched only a catalog alias or guarded acronym may therefore
 * land in `unmatched` rather than being misassigned.
 *
 * Deterministic only: it re-labels excerpts that already exist. It never
 * interprets findings beyond the stored classification, never invents
 * clinical text, and performs no network egress. An annotated excerpt is a
 * research cue for a hop — it does not establish that hop's nexus.
 *
 * @param hops - The pathway's hops in traversal order (1–2 hops).
 * @param analyses - Step 4 browser-local analyses (sessionStorage payload).
 * @param conditionNameById - Optional catalog ID → display-name lookup that
 *   widens the term match to excerpts stored under the full condition name.
 * @returns Annotated excerpts in stored order, plus excerpts that matched no
 *   hop — surfaced to the UI, never silently dropped.
 */
export function annotateExcerptsWithHopIndex(
  hops: readonly HopLike[],
  analyses: readonly EvidenceAnalysis[],
  conditionNameById?: Readonly<Record<string, string>>,
): { annotated: HopAnnotatedExcerpt[]; unmatched: EvidenceExcerpt[] } {
  const stored = normalizeStoredExcerpts(analyses);

  const assignment = new Map<EvidenceExcerpt, number>();
  for (const hop of [...hops].sort((a, b) => a.stepIndex - b.stepIndex)) {
    const targetTerms = hopConditionTerms(hop.edge.targetConditionId, conditionNameById);
    const sourceTerms = hopConditionTerms(hop.edge.sourceConditionId, conditionNameById);
    for (const entry of stored) {
      if (assignment.has(entry.excerpt)) continue;
      if (intersects(entry.terms, targetTerms) || intersects(entry.terms, sourceTerms)) {
        assignment.set(entry.excerpt, hop.stepIndex);
      }
    }
  }

  const annotated: HopAnnotatedExcerpt[] = [];
  const unmatched: EvidenceExcerpt[] = [];
  for (const entry of stored) {
    const stepIndex = assignment.get(entry.excerpt);
    if (stepIndex === undefined) unmatched.push(entry.excerpt);
    else annotated.push({ ...entry.excerpt, supportedHopIndex: stepIndex });
  }
  return { annotated, unmatched };
}

function normalizeStoredExcerpts(
  analyses: readonly EvidenceAnalysis[],
): { excerpt: EvidenceExcerpt; terms: Set<string> }[] {
  const stored: { excerpt: EvidenceExcerpt; terms: Set<string> }[] = [];
  for (const analysis of analyses) {
    for (const excerpt of analysis.excerpts) {
      const terms = new Set<string>();
      for (const term of excerpt.matchedTerms) {
        const normalized = normalizeTerm(term);
        if (normalized) terms.add(normalized);
      }
      stored.push({ excerpt, terms });
    }
  }
  return stored;
}

/**
 * Term strings stored excerpts may carry for a hop endpoint: the kebab-case
 * catalog ID, its separator-free form, its tokens of four or more characters,
 * and (when known) the display name — mirroring the term conventions of
 * `buildPrimaryConditionTerms`.
 */
function hopConditionTerms(
  conditionId: string,
  conditionNameById: Readonly<Record<string, string>> | undefined,
): Set<string> {
  const terms = new Set<string>();
  const id = conditionId.trim();
  if (!id) return terms;
  terms.add(normalizeTerm(id));
  for (const token of id.split("-")) {
    if (token.length >= 4) terms.add(normalizeTerm(token));
  }
  const name = conditionNameById?.[id]?.trim();
  if (name) terms.add(normalizeTerm(name));
  return terms;
}

function intersects(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  for (const value of a) {
    if (b.has(value)) return true;
  }
  return false;
}

/* ─── Per-hop text export (mirrors the PathwayEvidenceTable review) ────────── */

/** One-sentence, plain-language summary of the whole chain's legal nexus. */
export const COMPOSITE_NEXUS_SUMMARY: Record<CompositeNexus, string> = {
  DIRECT_CAUSATION: "Every hop in this chain asserts direct causation.",
  AGGRAVATION: "At least one hop in this chain is an aggravation claim.",
  ASSOCIATION_ONLY_CHAIN_BROKEN: "This chain includes an association-only link, which breaks the legal nexus between hops.",
};

/**
 * Formats one hop of a pathway as text-export lines: the numbered heading,
 * the hop's legal theory, and its mapped excerpts — or the explicit empty
 * state, so an evidence gap travels to the printed packet instead of
 * vanishing. Excerpt lines carry only what is already on screen (quote,
 * source, locator, category, strength) and use ASCII punctuation only for
 * safe plain-text rendering.
 */
export function formatPathwayHopEvidenceLines(
  hop: PathwayHopLike,
  hopNumber: number,
  excerpts: readonly HopAnnotatedExcerpt[],
  conditionNameById: Readonly<Record<string, string>> = {},
): string[] {
  const sourceName = conditionNameById[hop.edge.sourceConditionId] ?? hop.edge.sourceConditionId;
  const targetName = conditionNameById[hop.edge.targetConditionId] ?? hop.edge.targetConditionId;

  const lines: string[] = [
    `Hop ${hopNumber}: ${sourceName} -> ${targetName}`,
    `  Theory: ${NEXUS_CLAIM_LABEL[hop.edge.nexusClassification]}`,
  ];

  if (excerpts.length === 0) {
    lines.push("  No evidence mapped for this step.");
    return lines;
  }

  lines.push("  Evidence excerpts (exact quote):");
  for (const excerpt of excerpts) {
    lines.push(
      `   - "${excerpt.quote}" (${excerpt.sourceName}, ${excerpt.locator}; ${excerpt.category}${excerpt.strength === "nexus-relevant" ? ", nexus-relevant" : ""})`,
    );
  }
  return lines;
}

/**
 * Plain-text export of the per-hop evidence review: one numbered section per
 * pathway, one numbered sub-section per hop, with the chain's composite legal
 * nexus in the pathway header so the whole chain's strength travels with its
 * evidence. Renders the same stored excerpts, hop groupings, and empty states
 * as the on-screen `PathwayEvidenceTable` — it adds no analysis, no
 * probabilities, and no determination language.
 *
 * Deterministic only: like `formatPathwayEvidenceMapping`, it prints what is
 * already in browser-local state. Nothing leaves the tab until the veteran
 * chooses to download.
 *
 * @param entries - Per-pathway entries: the pathway view-model plus the
 *   excerpts already annotated against that pathway (as produced by
 *   `annotateExcerptsWithHopIndex`). Excerpts are bucketed per hop here by
 *   strict `supportedHopIndex` equality.
 * @param conditionNameById - Catalog ID → display name; missing IDs fall back
 *   to the ID, exactly as the table renders them.
 */
export function formatPathwayHopEvidenceMapping(
  entries: readonly {
    pathway: ClaimPathwayLike;
    excerpts: readonly HopAnnotatedExcerpt[];
  }[],
  conditionNameById: Readonly<Record<string, string>> = {},
): string {
  const lines: string[] = [
    "Evidence by Pathway Hop (browser-local research cues)",
    "",
    "Sections below mirror the on-screen per-hop review: your Step 4 local",
    "document analysis grouped under the specific hop of each claim pathway it",
    "supports. Matching text is a research cue only — it does not establish",
    "causation, aggravation, competency, probative weight, or VA's",
    "at-least-as-likely-as-not standard. Final determinations are made by VA.",
    "",
  ];

  if (entries.length === 0) {
    lines.push("No research pathways were available to map.");
    return lines.join("\n");
  }

  for (const [pathwayIndex, entry] of entries.entries()) {
    const { pathway, excerpts } = entry;
    const originName = conditionNameById[pathway.originConditionId] ?? pathway.originConditionId;
    const terminalName = conditionNameById[pathway.terminalConditionId] ?? pathway.terminalConditionId;

    lines.push(`Pathway ${pathwayIndex + 1}: ${originName} -> ${terminalName}`);
    lines.push(`  Composite nexus: ${COMPOSITE_NEXUS_SUMMARY[pathway.compositeNexus]}`);

    for (const hop of pathway.hops) {
      const hopExcerpts = excerpts.filter(
        (excerpt) => excerpt.supportedHopIndex === hop.stepIndex,
      );
      lines.push(...formatPathwayHopEvidenceLines(hop, hop.stepIndex + 1, hopExcerpts, conditionNameById));
    }

    lines.push("");
  }

  return lines.join("\n").trimEnd();
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
