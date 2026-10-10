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
 * It also joins the owner's approval ledgers against the authored corpus. The
 * `docs/mapping-expansion-me<N>-approved-implementation-ledger.json` files are
 * the record of which relationships a qualified human approved for each ME
 * batch, so the audit answers two questions about them and fails closed on
 * either:
 *
 *   1. **Can every ledger be read and attributed at all?** Before this
 *      contract the join read only `ledger.rows` and skipped an unparsable
 *      ledger with `catch { continue; }`. Fourteen ledgers store their approved
 *      rows under `relationships`/`mappings` instead, and the ME-20 ledger's
 *      committed JSON carried a raw newline inside a string so `JSON.parse`
 *      threw: 15 of 39 ledgers and 71 of 191 approved relationships were absent
 *      from the audit while it reported a green `meRelationshipsPresent`. A
 *      ledger that is unreadable, or that holds pair rows under a shape this
 *      audit does not recognize, is now a violation rather than a silent skip.
 *   2. **Is every approved relationship still in the corpus?** The join is
 *      two-way: a declared pair that is absent from the authored corpus is
 *      reported. Only a pair named in ME_LEDGER_ABSENT_ALLOWLIST may be absent,
 *      so an approved relationship that disappears cannot lower a count in
 *      silence.
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

function violation(suggestionRef, rule, message) {
  violations.push({ suggestion: suggestionRef, rule, message });
}

function warn(suggestionRef, rule, message) {
  warnings.push({ suggestion: suggestionRef, rule, message });
}

/* ------------------------------------------------------------------ *
 * ME approval-ledger join (see the header contract)
 * ------------------------------------------------------------------ */

const ME_LEDGER_FILE_PATTERN =
  /^mapping-expansion-(me\d+)-approved-implementation-ledger\.json$/;

/**
 * Ledger keys that carry approved relationship rows.
 *
 * The batches are not uniform: ME-1..ME-25 number their approvals in `rows`,
 * ME-26..ME-28 in `mappings`, and ME-29..ME-39 in `relationships`. All three are
 * read here so the join covers every ledger rather than the shape one batch
 * happened to use.
 */
const LEDGER_PAIR_KEYS = ["rows", "relationships", "mappings"];

/**
 * Approved relationships that may be absent from the authored corpus, written
 * as `"<ledger> <primaryId>-><targetId>"`.
 *
 * This is an exact-pair allowance, not a count: a *different* absent approved
 * relationship fails the gate even when the number of absences is unchanged,
 * and an entry here can only be removed by editing this file, which is
 * reviewable. It replaces the previous behaviour, where an absent relationship
 * was simply never reported and `meRelationshipsPresent` dropped silently.
 *
 *   - `ME17 tinnitus->depressive-disorder` (rank 1, PMID 30909841): the
 *     **committed** corpus carries it — `data/knowledge-base/tinnitus.json` at
 *     HEAD is `depressive-disorder` rank 1 plus `insomnia` rank 2. The local
 *     working tree carries an uncommitted rewrite of that same file, fused
 *     with the REL-01 enum/pathway repair, which keeps only a rank-1
 *     `migraine-headaches` edge and thereby drops the ME-17 approval. The
 *     unrelated dirty file is left untouched, so the absence is recorded here
 *     and reported as a warning instead of failing the gate on someone else's
 *     in-flight edit. Delete this entry when that rewrite lands or reverts: if
 *     the rewrite lands as authored, the ME-17 relationship needs an owner
 *     disposition, because it is currently in neither the corpus nor a
 *     retirement record.
 */
const ME_LEDGER_ABSENT_ALLOWLIST = new Set([
  "ME17 tinnitus->depressive-disorder",
]);

/** A ledger row declares an approved relationship when it names both endpoints. */
function isPairRow(row) {
  return (
    Boolean(row) &&
    typeof row === "object" &&
    !Array.isArray(row) &&
    typeof row.primaryId === "string" &&
    typeof row.targetId === "string"
  );
}

/**
 * Splits one parsed ledger into its recognized pair arrays and any array that
 * holds pair rows under a key this audit does not know.
 *
 * The unrecognized half is the point: a future ledger written with a new
 * top-level key must fail the gate, because the alternative is the failure this
 * contract exists to prevent — approved relationships that nothing reads.
 */
function readLedgerPairs(ledger) {
  const recognized = [];
  const unrecognized = [];
  for (const [key, value] of Object.entries(ledger)) {
    if (!Array.isArray(value)) continue;
    const rows = value.filter(isPairRow);
    if (rows.length === 0) continue;
    if (LEDGER_PAIR_KEYS.includes(key)) recognized.push({ key, rows });
    else unrecognized.push({ key, count: rows.length });
  }
  return { recognized, unrecognized };
}

/**
 * Every implementation ledger under `rootDir`, or a violation explaining why
 * one could not be read. Never throws and never skips: an unreadable approval
 * ledger is a governance-artifact failure, not a file to step over.
 */
function loadMeLedgerPairs({ rootDir = ledgerRoot } = {}) {
  const ledgers = [];
  const ledgerViolations = [];
  let files;
  try {
    files = fs.readdirSync(rootDir).sort();
  } catch (error) {
    return {
      ledgers,
      violations: [
        {
          ledger: "(ledger directory)",
          rule: "ME-LEDGER-UNREADABLE",
          message: `cannot read the approval-ledger directory ${rootDir} — ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }

  for (const file of files) {
    const match = file.match(ME_LEDGER_FILE_PATTERN);
    if (!match) continue;
    const ledger = match[1].toUpperCase();
    const full = path.join(rootDir, file);

    let raw;
    try {
      raw = fs.readFileSync(full, "utf8");
    } catch (error) {
      ledgerViolations.push({
        ledger,
        rule: "ME-LEDGER-UNREADABLE",
        message: `${file}: cannot be read — ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      ledgerViolations.push({
        ledger,
        rule: "ME-LEDGER-UNREADABLE",
        message: `${file}: is not valid JSON — ${error instanceof Error ? error.message : String(error)}. An approval ledger that cannot be parsed cannot be audited, so the gate fails closed instead of skipping it.`,
      });
      continue;
    }

    const { recognized, unrecognized } = readLedgerPairs(parsed);
    for (const unknown of unrecognized) {
      ledgerViolations.push({
        ledger,
        rule: "ME-LEDGER-SHAPE",
        message: `${file}: holds ${unknown.count} approved relationship row(s) under "${unknown.key}", which this audit does not recognize — add that key to LEDGER_PAIR_KEYS deliberately, or those approvals are audited by nothing.`,
      });
    }
    if (recognized.length === 0) {
      ledgerViolations.push({
        ledger,
        rule: "ME-LEDGER-SHAPE",
        message: `${file}: declares no approved relationship rows in any recognized shape (${LEDGER_PAIR_KEYS.join(", ")}) — the ledger cannot be attributed to the corpus.`,
      });
      continue;
    }

    ledgers.push({
      ledger,
      file,
      shapes: recognized.map((entry) => entry.key),
      rows: recognized.flatMap((entry) =>
        entry.rows.map((row) => ({
          ledger,
          file,
          shape: entry.key,
          pair: `${row.primaryId}->${row.targetId}`,
          rank: Number.isInteger(row.rank) ? row.rank : null,
          pmid: typeof row.pmid === "string" ? row.pmid : null,
        })),
      ),
    });
  }

  return { ledgers, violations: ledgerViolations };
}

/** `"primary->target"` for every authored corpus edge under `kbDir`. */
function liveCorpusPairs(kbDir = kbRoot) {
  const pairs = new Map();
  for (const file of fs.readdirSync(kbDir).filter((f) => f.endsWith(".json"))) {
    const mapping = JSON.parse(fs.readFileSync(path.join(kbDir, file), "utf8"));
    for (const suggestion of mapping.suggestions ?? []) {
      if (typeof suggestion?.conditionId !== "string") continue;
      const pair = `${mapping.id}->${suggestion.conditionId}`;
      if (!pairs.has(pair)) pairs.set(pair, file);
    }
  }
  return pairs;
}

/**
 * Two-way join of the approval ledgers against the authored corpus.
 *
 * `present` and `absent` are per ledger row, so a relationship declared by two
 * batches appears in both; `uniquePairs` counts the distinct relationships.
 */
function joinMeLedgersToCorpus(ledgers, livePairs) {
  const present = [];
  const absent = [];
  const uniquePairs = new Set();
  for (const ledger of ledgers) {
    for (const row of ledger.rows) {
      uniquePairs.add(row.pair);
      (livePairs.has(row.pair) ? present : absent).push(row);
    }
  }
  return { present, absent, uniquePairs: uniquePairs.size };
}

/**
 * Splits absent approved relationships into the named allowance and everything
 * else. Keyed by `"<ledger> <pair>"`, so the allowance is an exact pair rather
 * than a count: one approved relationship cannot be swapped for another.
 */
function classifyAbsentRelationships(absent, allowlist = ME_LEDGER_ABSENT_ALLOWLIST) {
  const allowlisted = [];
  const unexpected = [];
  for (const row of absent) {
    if (allowlist.has(`${row.ledger} ${row.pair}`)) allowlisted.push(row);
    else unexpected.push(row);
  }
  return { allowlisted, unexpected };
}

function auditSuggestion(fileName, mapping, suggestion, index) {
  const ref = `${fileName}::suggestions[${index}] (${suggestion.conditionId})`;
  suggestionsAudited += 1;
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

  // --- ME approval-ledger join ---
  const { ledgers, violations: ledgerViolations } = loadMeLedgerPairs();
  for (const ledgerViolation of ledgerViolations) {
    violation(ledgerViolation.ledger, ledgerViolation.rule, ledgerViolation.message);
  }
  const joined = joinMeLedgersToCorpus(ledgers, liveCorpusPairs());
  const absence = classifyAbsentRelationships(joined.absent);
  for (const row of absence.allowlisted) {
    warn(
      `${row.ledger} ${row.pair}`,
      "ME-LEDGER-ABSENT-ALLOWLISTED",
      `approved by ${row.file} (${row.shape}${row.pmid ? `, PMID ${row.pmid}` : ""}) but absent from the authored corpus; permitted only by the named ME_LEDGER_ABSENT_ALLOWLIST entry`,
    );
  }
  for (const row of absence.unexpected) {
    violation(
      `${row.ledger} ${row.pair}`,
      "ME-LEDGER-ABSENT",
      `declared by ${row.file} (${row.shape}${row.pmid ? `, PMID ${row.pmid}` : ""}) as an approved relationship, but no corpus edge matches \`${row.pair}\`. Re-author the edge or record its disposition; an approved relationship must not disappear unreported.`,
    );
  }

  const report = {
    auditedFiles: files.length,
    suggestionsAudited,
    meLedgersAudited: ledgers.length,
    meLedgerShapes: Object.fromEntries(
      [...new Set(ledgers.flatMap((ledger) => ledger.shapes))].sort().map((shape) => [
        shape,
        ledgers.filter((ledger) => ledger.shapes.includes(shape)).length,
      ]),
    ),
    meRelationshipsDeclared: ledgers.reduce((sum, ledger) => sum + ledger.rows.length, 0),
    meRelationshipsPresent: joined.present.length,
    meUniqueRelationshipsPresent: joined.uniquePairs,
    meRelationshipsAbsent: joined.absent.map((row) => ({
      ledger: row.ledger,
      pair: row.pair,
      rank: row.rank,
      pmid: row.pmid,
      file: row.file,
    })),
    meRelationshipsAbsentAllowlisted: absence.allowlisted.map((row) => `${row.ledger} ${row.pair}`),
    meRelationshipsAbsentUnexpected: absence.unexpected.map((row) => `${row.ledger} ${row.pair}`),
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
    console.log(`- ME ledgers audited: **${ledgers.length}**`);
    console.log(
      `- ME relationships declared/present/absent: **${report.meRelationshipsDeclared}/${report.meRelationshipsPresent}/${report.meRelationshipsAbsent.length}**`,
    );
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

if (require.main === module) {
  main();
}

module.exports = {
  LEDGER_PAIR_KEYS,
  ME_LEDGER_ABSENT_ALLOWLIST,
  ME_LEDGER_FILE_PATTERN,
  classifyAbsentRelationships,
  isPairRow,
  readLedgerPairs,
  loadMeLedgerPairs,
  liveCorpusPairs,
  joinMeLedgersToCorpus,
};