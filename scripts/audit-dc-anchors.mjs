#!/usr/bin/env node
/**
 * Audit — for every DIRECT_CAUSATION edge — what CLASS of study actually anchors
 * it, and which edges rest on nothing but association or prevalence data.
 *
 *   npm run audit:dc-anchors             # print the table
 *   npm run audit:dc-anchors -- --write  # also refresh docs/dc-anchor-audit-<date>.json
 *
 * Why this exists: `DIRECT_CAUSATION` asserts a legal nexus theory, and the
 * evidence model gives an edge its weight through the mechanism
 * (`src/lib/kb/schema.ts`: "The pathophysiological mechanism gives the edge its
 * biological 'weight'"). A prevalence of co-occurrence, or an odds ratio from an
 * observational population, is not by itself a causal anchor: it cannot separate
 * direction, and it cannot rule out the shared-cause explanation the nexus arm
 * has to survive. An edge whose every anchor is that class is claiming causation
 * on evidence that only supports association.
 *
 * The classifier is deliberately mechanical and its lexicon is printed in the
 * output, because the alternative — a hand-curated list nobody can reproduce —
 * is not an audit. Two limits are recorded rather than hidden:
 *
 *   1. `data/knowledge-base` spellings do not carry a study-design field, so the
 *      class has to be read from the record's own `citation` and `note` text.
 *      A note that does not describe its design is classified `UNSTATED`, never
 *      guessed upward into an analytic class.
 *   2. The script produces CANDIDATES and the mechanical reason for each. The
 *      adjudication of whether a flagged edge should be downgraded or instead
 *      given a proper anchor is authored in
 *      `docs/dc-anchor-audit-<date>.md`, which cites this output per row.
 *
 * Sync-fork copies are skipped: a byte-identical duplicate would double-count.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const KB_DIR = "data/knowledge-base";
const GRAPH_DIR = "data/knowledge-base/graph";
const AUDIT_ID = "dc-anchor-audit-2026-10-06";
const JSON_PATH = `docs/${AUDIT_ID}.json`;

const SYNC_FORK = /(^|\/)[^/]* \d+(\.[^/]*)?$/;
const readDir = (dir) =>
  readdirSync(join(ROOT, dir)).filter(
    (name) => name.endsWith(".json") && !SYNC_FORK.test(name),
  );
const readJson = (file) => JSON.parse(readFileSync(join(ROOT, file), "utf8"));

/* ─── design lexicon ──────────────────────────────────────────────────────── */

/**
 * A study that can carry a causal step needs temporal ordering, an intervention,
 * a randomisation-based causal-inference design, or a described mechanism.
 * Everything else in the lexicon is explicitly weaker than that.
 */
const DESIGN_LEXICON = [
  {
    label: "PREVALENCE_OR_ASSOCIATION",
    note:
      "Reports frequency, co-occurrence, correlation, or a population-level risk/odds association.",
    patterns: [
      /\bprevalence\b/i,
      /\bcross[- ]sectional\b/i,
      /\bsurvey\b/i,
      /\bepidemiolog/i,
      /\bpopulation[- ]based\b/i,
      /\bNHANES\b/,
      /\bmore common (?:in|among|in those)\b/i,
      /\b(?:is|are|was|were) common\b/i,
      /\bassociated with\b/i,
      /\bassociation\b/i,
      /\bcorrelat/i,
      /\bco-?occur/i,
      /\bcomorbid/i,
      /\brisk factor\b/i,
      /\bodds ratio\b/i,
      /\bOR \d/i,
      /\brisk of\b/i,
      /\bproportion of\b/i,
      /\d+(?:\.\d+)? ?%/, // a quantified frequency, e.g. "in 12.7% of patients"
      /\bin \d+ in [\d,]+\b/i, // "1 in 25,000 live births"
      /\b(?:most|least) common\b/i,
      /\bcommonest\b/i,
      /\boccurrence\b/i,
      /\bpresent in \d+/i,
    ],
  },
  {
    label: "ANALYTIC_LONGITUDINAL",
    note:
      "Temporal ordering: prospective, longitudinal, incidence, or a cohort with follow-up. " +
      "A bare 'cohort' is deliberately NOT enough — a cross-sectional cohort is a prevalence design.",
    patterns: [
      /\bprospective\b/i,
      /\blongitudinal\b/i,
      /\bincidence\b/i,
      /\bfollow[- ]up\b/i,
      /\bregistry[- ]based\b/i,
      /\b\d+-year (?:follow|cohort|study|prospective|trial)/i,
    ],
  },
  {
    label: "DESCRIPTIVE_SOURCE",
    note:
      "A review, guideline, consensus, editorial, chapter, case report or case series: it can " +
      "state a mechanism, but it does not itself measure a causal step.",
    patterns: [
      /\breview\b/i,
      /\bguideline/i,
      /\bconsensus\b/i,
      /\beditorial\b/i,
      /\bchapter\b/i,
      /\bcase report\b/i,
      /\bcase series\b/i,
      /\bseries\b/i,
      /\bStatPearls\b/i,
      /\bGeneReviews\b/i,
      /\bposition statement\b/i,
      /\bupdate\b/i,
      /\boverview\b/i,
    ],
  },
  {
    label: "RANDOMIZED",
    note: "Randomised allocation: a trial, or a review restricted to trials.",
    patterns: [/\brandomi[sz]ed\b/i, /\bphase \d trial\b/i, /\btrial of\b/i],
  },
  {
    label: "CAUSAL_INFERENCE_DESIGN",
    note: "Randomisation by nature: Mendelian randomisation, instrumental variables.",
    patterns: [/\bmendelian\b/i, /\binstrumental variable\b/i],
  },
  {
    label: "MECHANISM",
    note: "Describes the pathophysiological or physical step itself, not its frequency.",
    patterns: [
      /\bmechanism/i,
      /\bpathophysiolog/i,
      /\bcascade\b/i,
      /\bcaused by\b/i,
      /\bleads? to\b/i,
      /\bproduces\b/i,
      /\bmediator/i,
      /\bdownstream\b/i,
      /\bhypersecretion\b/i,
      /\bcompression\b/i,
      /\bobstruction\b/i,
      /\bischaem|\bischem/i,
      /\bdemyelinat/i,
      /\binflammator/i,
      /\bfibrosis[- ]progression\b/i,
    ],
  },
  {
    label: "INTERVENTION_RESPONSE",
    note: "The anchor measures a change produced by an intervention rather than a frequency.",
    patterns: [
      /\beradication\b/i,
      /\breduced? (?:the )?(?:need|risk|recurrence)\b/i,
      /\bimprove(?:d|ment) (?:after|following)\b/i,
      /\bresolution\b/i,
      /\bafter (?:decompress|treatment|surgery|withdrawal)\b/i,
      /\bresponse to\b/i,
    ],
  },
];

const STRONG_LABELS = [
  "ANALYTIC_LONGITUDINAL",
  "RANDOMIZED",
  "CAUSAL_INFERENCE_DESIGN",
  "MECHANISM",
  "INTERVENTION_RESPONSE",
];
/** A causal-capable claim that rests only on this class is asserted, not measured. */
const PRIMARY_EVIDENCE_LABELS = [
  "ANALYTIC_LONGITUDINAL",
  "RANDOMIZED",
  "CAUSAL_INFERENCE_DESIGN",
];

function classifyReference(reference) {
  const text = `${reference.citation ?? ""} ${reference.note ?? ""}`;
  const hits = [];
  for (const entry of DESIGN_LEXICON) {
    const matched = entry.patterns.filter((pattern) => pattern.test(text));
    if (matched.length) {
      hits.push({ label: entry.label, matched: matched.map((pattern) => pattern.source) });
    }
  }
  if (!hits.length) {
    return { labels: ["UNSTATED"], matched: {}, strong: false, primaryEvidence: false };
  }
  const labels = hits.map((hit) => hit.label);
  return {
    labels,
    matched: Object.fromEntries(hits.map((hit) => [hit.label, hit.matched])),
    strong: labels.some((label) => STRONG_LABELS.includes(label)),
    primaryEvidence: labels.some((label) => PRIMARY_EVIDENCE_LABELS.includes(label)),
  };
}

/* ─── enumerate DIRECT_CAUSATION edges ────────────────────────────────────── */

const edges = [];
for (const file of readDir(KB_DIR)) {
  const entry = readJson(`${KB_DIR}/${file}`);
  for (const [index, suggestion] of (entry.suggestions ?? []).entries()) {
    if (suggestion.nexusClaim?.nexusClassification !== "DIRECT_CAUSATION") continue;
    const references = (suggestion.sourceReferences ?? []).map((reference) => ({
      ...classifyReference(reference),
      citation: reference.citation,
      note: reference.note,
      verified: reference.verified === true,
    }));
    edges.push({
      index,
      host: entry.id,
      hostDraft: entry.draft === true,
      rank: suggestion.rank,
      target: suggestion.conditionId,
      mechanismCategory: suggestion.causalMechanism?.mechanismCategory,
      hypothesizedOnly: suggestion.causalMechanism?.hypothesizedOnly === true,
      etiologicalConsensus: suggestion.evidentiaryProfile?.etiologicalConsensus,
      vaNexusProbabilityAlignment: suggestion.evidentiaryProfile?.vaNexusProbabilityAlignment,
      requiresSpecificDbqEvidence: suggestion.evidentiaryProfile?.requiresSpecificDbqEvidence === true,
      referenceCount: references.length,
      strongAnchorCount: references.filter((reference) => reference.strong).length,
      references,
    });
  }
}

/**
 * Flagged = no reference in the whole edge carries a causal-capable class, and
 * at least one states a prevalence or association finding. That is the
 * mechanical statement of "its only anchor is a prevalence or association
 * study"; the adjudicated verdict for each flagged row is authored in the
 * report.
 */
for (const edge of edges) {
  edge.primaryEvidenceCount = edge.references.filter(
    (reference) => reference.primaryEvidence,
  ).length;
  edge.descriptiveOnly = edge.references.every(
    (reference) =>
      reference.labels.includes("DESCRIPTIVE_SOURCE") || reference.labels[0] === "UNSTATED",
  );
  edge.associationOrPrevalenceOnly =
    edge.strongAnchorCount === 0 &&
    edge.references.some((reference) => reference.labels.includes("PREVALENCE_OR_ASSOCIATION"));
  /**
   * Mechanism named only inside a review, guideline or case report, with no
   * primary analytic study anywhere on the edge. The causal step is asserted by
   * a secondary source rather than measured.
   */
  edge.mechanismAssertedBySecondaryOnly =
    !edge.associationOrPrevalenceOnly &&
    edge.strongAnchorCount > 0 &&
    edge.primaryEvidenceCount === 0;
  edge.onlyUnstated = edge.references.every((reference) => reference.labels[0] === "UNSTATED");
}

/* ─── graph-store cross-check ─────────────────────────────────────────────── */

const graphDirectCausation = [];
for (const file of readDir(GRAPH_DIR)) {
  const node = readJson(`${GRAPH_DIR}/${file}`);
  for (const edge of node.outgoingEdges ?? []) {
    if (edge.nexusClaim?.nexusClassification !== "DIRECT_CAUSATION") continue;
    graphDirectCausation.push({ host: node.nodeId, target: edge.targetConditionId, rank: edge.rank });
  }
}

const flagged = edges.filter((edge) => edge.associationOrPrevalenceOnly);
const mechanismAssertedOnly = edges.filter((edge) => edge.mechanismAssertedBySecondaryOnly);
const primaryAnchored = edges.filter((edge) => edge.primaryEvidenceCount > 0);

const report = {
  version: 1,
  generatedBy: "npm run audit:dc-anchors -- --write",
  description:
    "For every DIRECT_CAUSATION edge, the class of study anchoring it, in three tiers. " +
    "FLAGGED (associationOrPrevalenceOnly): no causal-capable anchor anywhere on the edge and at " +
    "least one anchor states a prevalence or association finding. DESCRIPTIVE_ANCHOR " +
    "(mechanismAssertedBySecondaryOnly): the causal step is named only inside a review, guideline, " +
    "consensus or case report, with no primary analytic study anywhere on the edge. " +
    "PRIMARY_ANCHORED: at least one anchor is a longitudinal/prospective/incidence design, a " +
    "randomised trial, or a Mendelian-randomisation design. Verdicts for the flagged and " +
    "descriptive-anchor rows are authored in docs/" +
    AUDIT_ID +
    ".md.",
  lexicon: DESIGN_LEXICON.map(({ label, note, patterns }) => ({
    label,
    note,
    patterns: patterns.map((pattern) => pattern.source),
  })),
  summary: {
    directCausationEdges: edges.length,
    hosts: new Set(edges.map((edge) => edge.host)).size,
    flaggedAssociationOrPrevalenceOnly: flagged.length,
    mechanismAssertedBySecondaryOnly: mechanismAssertedOnly.length,
    withPrimaryAnalyticAnchor: primaryAnchored.length,
    withAtLeastOneCausalCapableAnchor: edges.length - flagged.length,
    everyAnchorUnstated: edges.filter((edge) => edge.onlyUnstated).length,
    publishedHosts: edges.filter((edge) => !edge.hostDraft).length,
    draftHosts: edges.filter((edge) => edge.hostDraft).length,
    flaggedOnPublishedHosts: flagged.filter((edge) => !edge.hostDraft).length,
    flaggedOnDraftHosts: flagged.filter((edge) => edge.hostDraft).length,
    graphStoreDirectCausationEdges: graphDirectCausation.length,
    graphStoreEdgesNotAdjudicated:
      "Graph nodes mirror authored suggestions; the suggestion is the adjudicated artifact.",
  },
  flagged,
  mechanismAssertedBySecondaryOnly: mechanismAssertedOnly,
  allEdges: edges,
  graphStoreDirectCausation: graphDirectCausation,
};

if (process.argv.includes("--write")) {
  writeFileSync(join(ROOT, JSON_PATH), `${JSON.stringify(report, null, 2)}\n`);
}

/* ─── print ───────────────────────────────────────────────────────────────── */

const brief = (edge) =>
  `${edge.host}${edge.hostDraft ? " [draft]" : " [published]"} -> ${edge.target} | ` +
  `refs=${edge.referenceCount} primary=${edge.primaryEvidenceCount} cons=${edge.etiologicalConsensus} ` +
  `mech=${edge.mechanismCategory} | ` +
  edge.references
    .map((reference) => reference.labels.join("+") + (reference.verified ? "(v)" : ""))
    .join(", ");

console.log(
  `audit-dc-anchors: ${edges.length} DIRECT_CAUSATION edges across ${report.summary.hosts} hosts — ` +
    `${flagged.length} associate/prevalence-only, ${mechanismAssertedOnly.length} mechanism-asserted-by-secondary-only, ` +
    `${primaryAnchored.length} primary-anchored.`,
);
console.log("");
console.log("TIER 1 — only association/prevalence-class anchors (downgrade candidates):");
for (const edge of flagged) console.log(`  - ${brief(edge)}`);
console.log("");
console.log("TIER 2 — causal step asserted only by a review/guideline/case report, no primary analytic anchor:");
for (const edge of mechanismAssertedOnly) console.log(`  - ${brief(edge)}`);
console.log("");
console.log("TIER 3 — carries a primary analytic, randomised or MR anchor:");
for (const edge of primaryAnchored) console.log(`  = ${brief(edge)}`);
if (process.argv.includes("--debug")) {
  console.log("");
  console.log("MATCHED LEXICON PATTERNS (audit-the-classifier view):");
  for (const edge of edges) {
    console.log(`  ${edge.host} -> ${edge.target}`);
    edge.references.forEach((reference, index) => {
      const matched = Object.entries(reference.matched)
        .map(([label, patterns]) => `${label}[${patterns.join("|")}]`)
        .join(" ");
      console.log(`    r${index + 1} ${matched || "UNSTATED"}`);
    });
  }
}
if (process.argv.includes("--write")) console.log(`\nwrote ${JSON_PATH}`);
