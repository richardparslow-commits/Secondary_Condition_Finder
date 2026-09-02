/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * ME CRG compliance audit.
 *
 * Audits every suggestion in data/knowledge-base/*.json, with special
 * attribution for the Mapping Expansion (ME-1..ME-18) relationships, against
 * the Causal Relational Graph (CRG) requirements:
 *
 *   - CRG trio presence (nexusClaim / causalMechanism / evidentiaryProfile)
 *   - discriminated-union arm validity (DIRECT_CAUSATION / AGGRAVATION /
 *     ASSOCIATION_ONLY) with no cross-arm field leakage
 *   - mechanism category enum membership and hypothesizedOnly discipline
 *   - etiological-consensus / VA nexus-probability alignment consistency
 *     (CONTESTED requires >= 2 alternative etiologies + specific DBQ evidence;
 *     NOT_ESTABLISHED requires NOT_ASSERTED alignment)
 *   - guard-disclaimer honesty: a suggestion whose rationale/guard disclaims
 *     individual causation must be classified ASSOCIATION_ONLY
 *   - citation discipline: verified flags, no placeholder URLs, and no CFR
 *     cited as clinical evidence
 *   - citation-purity quarantine: single-unverified or >30%-unverified
 *     suggestions must sit behind mapping-level draft: true
 *
 * Usage: node scripts/audit-me-compliance.js [--markdown]
 */

const fs = require("fs");
const path = require("path");

const repositoryRoot = process.cwd();
const kbRoot = path.join(repositoryRoot, "data", "knowledge-base");
const ledgerRoot = path.join(repositoryRoot, "docs");
const markdown = process.argv.includes("--markdown");

const MECHANISM_CATEGORIES = new Set([
  "MICROVASCULAR_METABOLIC",
  "BIOMECHANICAL_ALTERATION",
  "NEUROENDOCRINE_CASCADE",
  "PHARMACOLOGICAL_IATROGENIC",
  "PSYCHOPHYSIOLOGICAL",
  "SYSTEMIC_INFLAMMATORY",
  "IMMUNE_MEDIATED",
  "THROMBOTIC_OR_VASCULAR",
  "NEUROLOGICAL_DEGENERATION",
  "METABOLIC_OR_NUTRITIONAL",
  "MALIGNANT_TRANSFORMATION",
  "INFECTIOUS_SPREAD",
  "MECHANICAL_OR_COMPRESSIVE",
  "POST_SURGICAL_OR_TREATMENT",
  "MULTIFACTORIAL",
  "NOT_ESTABLISHED",
]);

const CONSENSUS_TIERS = new Set([
  "WELL_ESTABLISHED",
  "PROBABLE",
  "CONTESTED_REQUIRES_SPECIFIC_EVIDENCE",
  "IATROGENIC_TREATMENT_EFFECT",
  "NOT_ESTABLISHED",
]);

const ALIGNMENTS = new Set([
  "AT_LEAST_AS_LIKELY_AS_NOT",
  "LESS_THAN_AS_LIKELY_AS_NOT",
  "LEGALLY_PRESUMED",
  "NOT_ASSERTED",
]);

const DISCLAIMER_PHRASES = [
  "do not treat this population-level association as proof",
  "without establishing",
  "cannot establish",
  "not proof",
  "not asserted",
  "as proof that",
];

// "does not establish" is only a structural disclaimer when it is NOT scoped
// to a generalization (e.g. "does not establish that every pacemaker..." or
// "does not establish that every diagnosis coded as CHF..."). Bounded causal
// guards legitimately disclaim generalization while affirming a specific,
// individually-testable mechanism.
const ESTABLISH_SCOPE_PATTERN = /\.{0,3}\s*(that\s+)?(every|each|diagnosis coded|generalized)/i;
const SCOPING_HORIZON = 90;

const PLACEHOLDER_PATTERN =
  /example\.com|placeholder|REPLACE_ME|your-domain|localhost/;

const violations = [];
const warnings = [];
let suggestionsAudited = 0;
let meRelationships = 0;

function violation(suggestionRef, rule, message) {
  violations.push({ suggestion: suggestionRef, rule, message });
}

function warn(suggestionRef, rule, message) {
  warnings.push({ suggestion: suggestionRef, rule, message });
}

function loadMePairs() {
  const pairs = new Map(); // "primary->target" -> me label
  for (const file of fs.readdirSync(ledgerRoot)) {
    const match = file.match(/^mapping-expansion-(me\d+)-approved-implementation-ledger\.json$/);
    if (!match) continue;
    let ledger;
    try {
      ledger = JSON.parse(fs.readFileSync(path.join(ledgerRoot, file), "utf8"));
    } catch {
      continue;
    }
    for (const row of ledger.rows ?? []) {
      if (row.primaryId && row.targetId) {
        pairs.set(`${row.primaryId}->${row.targetId}`, match[1].toUpperCase());
      }
    }
  }
  return pairs;
}

const mePairs = loadMePairs();
const meBySuggestion = new Map(); // "file::conditionId" -> ME label

function auditSuggestion(fileName, mapping, suggestion, index) {
  const ref = `${fileName}::suggestions[${index}] (${suggestion.conditionId})`;
  suggestionsAudited += 1;

  const meLabel = mePairs.get(`${mapping.id}->${suggestion.conditionId}`);
  if (meLabel) {
    meRelationships += 1;
    meBySuggestion.set(`${fileName}::${suggestion.conditionId}`, meLabel);
  }
  // --- CRG trio presence ---
  if (!suggestion.nexusClaim || typeof suggestion.nexusClaim !== "object") {
    violation(ref, "CRG-TRIO", "missing nexusClaim");
    return;
  }
  if (!suggestion.causalMechanism || typeof suggestion.causalMechanism !== "object") {
    violation(ref, "CRG-TRIO", "missing causalMechanism");
    return;
  }
  if (!suggestion.evidentiaryProfile || typeof suggestion.evidentiaryProfile !== "object") {
    violation(ref, "CRG-TRIO", "missing evidentiaryProfile");
    return;
  }

  const { nexusClaim, causalMechanism, evidentiaryProfile } = suggestion;
  const classification = nexusClaim.nexusClassification;

  // --- Discriminated-union arm validity ---
  const FORBIDDEN = {
    DIRECT_CAUSATION: ["baselineProgression", "aggravatingFactor", "associationBasis", "causationStatus"],
    AGGRAVATION: ["etiologicalTrigger", "associationBasis", "causationStatus"],
    ASSOCIATION_ONLY: ["etiologicalTrigger", "baselineProgression", "aggravatingFactor"],
  };
  if (!FORBIDDEN[classification]) {
    violation(ref, "NEXUS-ARM", `unknown nexusClassification ${JSON.stringify(classification)}`);
    return;
  }
  for (const key of FORBIDDEN[classification]) {
    if (nexusClaim[key] !== undefined) {
      violation(ref, "NEXUS-ARM", `${classification} must not carry ${key}`);
    }
  }
  if (classification === "DIRECT_CAUSATION") {
    if (typeof nexusClaim.etiologicalTrigger !== "string" || nexusClaim.etiologicalTrigger.length < 50) {
      violation(ref, "NEXUS-ARM", "DIRECT_CAUSATION requires etiologicalTrigger (>= 50 chars)");
    }
  } else if (classification === "AGGRAVATION") {
    if (typeof nexusClaim.baselineProgression !== "string" || nexusClaim.baselineProgression.length < 50) {
      violation(ref, "NEXUS-ARM", "AGGRAVATION requires baselineProgression (>= 50 chars)");
    }
    if (typeof nexusClaim.aggravatingFactor !== "string" || nexusClaim.aggravatingFactor.length < 50) {
      violation(ref, "NEXUS-ARM", "AGGRAVATION requires aggravatingFactor (>= 50 chars)");
    }
  } else {
    if (typeof nexusClaim.associationBasis !== "string" || nexusClaim.associationBasis.length < 50) {
      violation(ref, "NEXUS-ARM", "ASSOCIATION_ONLY requires associationBasis (>= 50 chars)");
    }
    if (typeof nexusClaim.causationStatus !== "string" || nexusClaim.causationStatus.length < 50) {
      violation(ref, "NEXUS-ARM", "ASSOCIATION_ONLY requires causationStatus (>= 50 chars)");
    }
    if (causalMechanism.hypothesizedOnly !== true) {
      violation(ref, "NEXUS-ARM", "ASSOCIATION_ONLY edges must set causalMechanism.hypothesizedOnly = true");
    }
    if (evidentiaryProfile.etiologicalConsensus === "WELL_ESTABLISHED") {
      violation(ref, "NEXUS-ARM", "ASSOCIATION_ONLY edge cannot claim WELL_ESTABLISHED consensus");
    }
  }

  // --- Mechanism validity ---
  if (!MECHANISM_CATEGORIES.has(causalMechanism.mechanismCategory)) {
    violation(ref, "MECHANISM", `unknown mechanismCategory ${JSON.stringify(causalMechanism.mechanismCategory)}`);
  }
  if (typeof causalMechanism.primaryVector !== "string" || !causalMechanism.primaryVector.trim()) {
    violation(ref, "MECHANISM", "primaryVector must be a non-empty string");
  }
  if (causalMechanism.hypothesizedOnly !== undefined && typeof causalMechanism.hypothesizedOnly !== "boolean") {
    violation(ref, "MECHANISM", "hypothesizedOnly must be boolean");
  }

  // --- Consensus / alignment consistency ---
  const consensus = evidentiaryProfile.etiologicalConsensus;
  const alignment = evidentiaryProfile.vaNexusProbabilityAlignment;
  if (!CONSENSUS_TIERS.has(consensus)) {
    violation(ref, "CONSENSUS", `unknown etiologicalConsensus ${JSON.stringify(consensus)}`);
  }
  if (!ALIGNMENTS.has(alignment)) {
    violation(ref, "CONSENSUS", `unknown vaNexusProbabilityAlignment ${JSON.stringify(alignment)}`);
  }
  if (consensus === "CONTESTED_REQUIRES_SPECIFIC_EVIDENCE") {
    const alternatives = evidentiaryProfile.alternativeEtiologiesToRuleOut ?? [];
    if (!Array.isArray(alternatives) || alternatives.length < 2) {
      violation(ref, "CONSENSUS", "CONTESTED consensus requires >= 2 alternativeEtiologiesToRuleOut");
    }
    if (evidentiaryProfile.requiresSpecificDbqEvidence !== true) {
      violation(ref, "CONSENSUS", "CONTESTED consensus requires requiresSpecificDbqEvidence = true");
    }
  }
  if (consensus === "NOT_ESTABLISHED" && alignment !== "NOT_ASSERTED") {
    violation(ref, "CONSENSUS", `NOT_ESTABLISHED consensus must pair with NOT_ASSERTED alignment (got ${alignment})`);
  }
  if (consensus === "WELL_ESTABLISHED" && alignment === "NOT_ASSERTED") {
    violation(ref, "CONSENSUS", "WELL_ESTABLISHED consensus cannot pair with NOT_ASSERTED alignment");
  }
  if (classification === "ASSOCIATION_ONLY" && consensus === "PROBABLE") {
    warn(ref, "CONSENSUS", "ASSOCIATION_ONLY with PROBABLE consensus is worth qualified-human review");
  }

  // --- Guard-disclaimer honesty ---
  const scanText = [
    suggestion.rationale || "",
    nexusClaim.associationBasis || "",
    nexusClaim.causationStatus || "",
    nexusClaim.etiologicalTrigger || "",
    nexusClaim.baselineProgression || "",
    nexusClaim.aggravatingFactor || "",
  ].join(" ");
  const lowercase = scanText.toLowerCase();
  let hasDisclaimer = DISCLAIMER_PHRASES.some((phrase) =>
    lowercase.includes(phrase),
  );
  let establishIndex = lowercase.indexOf("does not establish");
  while (establishIndex !== -1 && !hasDisclaimer) {
    const tail = lowercase.slice(establishIndex + "does not establish".length);
    hasDisclaimer = !ESTABLISH_SCOPE_PATTERN.test(tail.slice(0, SCOPING_HORIZON));
    if (hasDisclaimer) break;
    establishIndex = lowercase.indexOf("does not establish", establishIndex + 1);
  }
  if (hasDisclaimer && classification !== "ASSOCIATION_ONLY") {
    violation(
      ref,
      "GUARD-HONESTY",
      `guard text disclaims individual causation but suggestion is classified ${classification} — must be ASSOCIATION_ONLY`,
    );
  }

  // --- Citation discipline ---
  for (const [i, reference] of (suggestion.sourceReferences ?? []).entries()) {
    const refLabel = `${ref}.sourceReferences[${i}]`;
    if (typeof reference.verified !== "boolean") {
      violation(refLabel, "CITATION", "verified must be boolean");
    }
    if (reference.verified === true) {
      const url = reference.sourceUrl ?? "";
      if (!/^https:\/\//.test(url) || PLACEHOLDER_PATTERN.test(url)) {
        violation(refLabel, "CITATION", `verified reference must carry a real https URL (got ${JSON.stringify(url)})`);
      }
    }
    if (reference.verificationScope === "clinical-evidence") {
      const text = `${reference.citation ?? ""} ${reference.note ?? ""}`;
      if (/38\s*C\.?F\.?R\.?|38\s+CFR/.test(text)) {
        violation(refLabel, "CITATION", "clinical-evidence reference must not cite 38 CFR (legal authority is not clinical evidence)");
      }
    }
  }

  // --- Citation-purity quarantine (draft discipline) ---
  const refs = suggestion.sourceReferences ?? [];
  if (refs.length > 0) {
    const unverified = refs.filter((r) => r.verified !== true).length;
    if ((refs.length === 1 && unverified === 1) || unverified / refs.length > 0.3) {
      if (mapping.draft !== true) {
        violation(
          ref,
          "QUARANTINE",
          `suggestion has ${unverified}/${refs.length} unverified citations but the mapping is not draft-quarantined`,
        );
      }
    }
  } else if (mapping.draft === false) {
    violation(ref, "GRAPH-EDGE-INTEGRITY", "published edge has zero source references");
  }

  // --- Mechanism / consensus coherence (CRG graph semantics) ---
  if (
    consensus === "IATROGENIC_TREATMENT_EFFECT" &&
    causalMechanism.mechanismCategory !== "PHARMACOLOGICAL_IATROGENIC" &&
    causalMechanism.mechanismCategory !== "POST_SURGICAL_OR_TREATMENT"
  ) {
    violation(
      ref,
      "GRAPH-MECHANISM-CONSENSUS",
      `IATROGENIC_TREATMENT_EFFECT consensus requires a treatment-based mechanism (got ${causalMechanism.mechanismCategory})`,
    );
  }
  if (
    causalMechanism.mechanismCategory === "NOT_ESTABLISHED" &&
    consensus !== "NOT_ESTABLISHED"
  ) {
    violation(
      ref,
      "GRAPH-MECHANISM-CONSENSUS",
      `NOT_ESTABLISHED mechanism cannot pair with ${consensus} consensus`,
    );
  }
  if (
    causalMechanism.hypothesizedOnly === false &&
    consensus === "NOT_ESTABLISHED"
  ) {
    violation(
      ref,
      "GRAPH-HYPOTHESIZED",
      "hypothesizedOnly: false contradicts NOT_ESTABLISHED consensus; a non-established cascade must be marked hypothesized",
    );
  }
  if (
    causalMechanism.mechanismCategory === "PHARMACOLOGICAL_IATROGENIC" &&
    consensus !== "IATROGENIC_TREATMENT_EFFECT" &&
    consensus !== "NOT_ESTABLISHED"
  ) {
    warn(
      ref,
      "GRAPH-PHARM-CONSENSUS",
      `PHARMACOLOGICAL_IATROGENIC mechanism with ${consensus} consensus — consider the IATROGENIC_TREATMENT_EFFECT tier or a qualified-human review`,
    );
  }
}

function auditGraph() {
  const pairs = new Map(); // primary->target -> [files]
  const publishedWithTodo = [];
  const rankCounts = new Map(); // file -> rank -> count

  for (const file of fs.readdirSync(kbRoot).filter((f) => f.endsWith(".json"))) {
    const mapping = JSON.parse(fs.readFileSync(path.join(kbRoot, file), "utf8"));
    const pair = (s, t) => {
      pairs.set(`${s}->${t}`, (pairs.get(`${s}->${t}`) ?? []).concat(file));
    };
    for (const [index, suggestion] of (mapping.suggestions ?? []).entries()) {
      const ref = `${file}::suggestions[${index}] (${suggestion.conditionId})`;
      pair(mapping.id, suggestion.conditionId);
      const rankKey = `${mapping.id}::rank-${suggestion.rank}`;
      rankCounts.set(rankKey, (rankCounts.get(rankKey) ?? 0) + 1);
      if (rankCounts.get(rankKey) > 1) {
        violation(ref, "GRAPH-RANK", `duplicate rank ${suggestion.rank} within ${mapping.id}`);
      }
      if (mapping.id === suggestion.conditionId) {
        violation(ref, "GRAPH-EDGE-INTEGRITY", "self-loop edge: primary equals secondary");
      }
      if (mapping.draft === false && Array.isArray(mapping.todo) && mapping.todo.length > 0) {
        publishedWithTodo.push(ref);
      }
    }
  }

  for (const p of pairs.keys()) {
    if (pairs.get(p).length > 1) {
      violation(p, "GRAPH-EDGE-INTEGRITY", `duplicate edge authored in ${pairs.get(p).join(", ")}`);
    }
  }

  const seenBidirectional = new Set();
  for (const p of pairs.keys()) {
    const [a, b] = p.split("->");
    if (!pairs.has(`${b}->${a}`)) continue;
    const key = [a, b].sort().join(" <-> ");
    if (seenBidirectional.has(key)) continue;
    seenBidirectional.add(key);
    warn(
      key,
      "GRAPH-BIDIRECTIONAL",
      "bidirectional edge pair present — each direction must be independently guarded for causation vs. aggravation; review required",
    );
  }

  for (const ref of publishedWithTodo) {
    violation(ref, "GRAPH-PUBLISH-INTEGRITY", "published mapping still carries TODO items; clear them before publishing");
  }
}

function main() {
  const files = fs
    .readdirSync(kbRoot)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const distribution = { DIRECT_CAUSATION: 0, AGGRAVATION: 0, ASSOCIATION_ONLY: 0 };
  const consensusDistribution = {};

  for (const file of files) {
    const mapping = JSON.parse(fs.readFileSync(path.join(kbRoot, file), "utf8"));
    for (const [index, suggestion] of (mapping.suggestions ?? []).entries()) {
      distribution[suggestion.nexusClaim?.nexusClassification] =
        (distribution[suggestion.nexusClaim?.nexusClassification] ?? 0) + 1;
      const consensus = suggestion.evidentiaryProfile?.etiologicalConsensus ?? "MISSING";
      consensusDistribution[consensus] = (consensusDistribution[consensus] ?? 0) + 1;
      auditSuggestion(file, mapping, suggestion, index);
    }
  }
  auditGraph();

  const report = {
    auditedFiles: files.length,
    suggestionsAudited,
    meRelationshipsPresent: meRelationships,
    nexusDistribution: distribution,
    consensusDistribution,
    violationCount: violations.length,
    warningCount: warnings.length,
    violations,
    warnings,
  };

  if (markdown) {
    console.log("## ME / CRG Compliance Audit");
    console.log("");
    console.log(`- Files audited: **${files.length}**`);
    console.log(`- Suggestions audited: **${suggestionsAudited}**`);
    console.log(`- ME-claimed relationships present: **${meRelationships}**`);
    console.log(`- Nexus classification: ${Object.entries(distribution).map(([k, v]) => `${k} ${v}`).join(", ")}`);
    console.log(`- Violations: **${violations.length}**${violations.length === 0 ? " — PASS" : ""}`);
    for (const w of warnings) {
      console.log(`- WARNING ${w.rule}: ${w.suggestion} — ${w.message}`);
    }
    for (const v of violations) {
      console.log(`- VIOLATION ${v.rule}: ${v.suggestion} — ${v.message}`);
    }
  } else {
    console.log(JSON.stringify(report, null, 2));
  }

  if (violations.length > 0) {
    console.error(`${violations.length} CRG compliance violation(s) found.`);
    process.exitCode = 1;
  }
}

main();