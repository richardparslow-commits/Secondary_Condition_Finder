/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { auditSource, validateExplicitMetadata, validateSuggestionMetadata } = require("./lib/evidence-architecture");
const { computeMappingCoverage } = require("./lib/kb-coverage");

const repoRoot = process.cwd();
const kbDir = path.join(repoRoot, "data/knowledge-base");
const catalogDir = path.join(repoRoot, "data/conditions");

const errors = [];
const warnings = [];
const unmappedCatalogConditions = [];

const readJsonFiles = directory =>
  fs.readdirSync(directory)
    .filter(file => file.endsWith(".json"))
    .sort()
    .map(file => ({
      file,
      path: path.join(directory, file),
      data: JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")),
    }));

const catalogFiles = readJsonFiles(catalogDir);
const kbFiles = readJsonFiles(kbDir);

const catalogById = new Map();
for (const { file, data } of catalogFiles) {
  if (!Array.isArray(data.conditions)) {
    errors.push(`${file}: conditions must be an array`);
    continue;
  }

  for (const condition of data.conditions) {
    if (!condition || typeof condition !== "object" || typeof condition.id !== "string" || !condition.id.trim()) {
      errors.push(`${file}: every condition must have a non-empty id`);
      continue;
    }

    if (catalogById.has(condition.id)) {
      errors.push(`${file}: duplicate catalog condition id '${condition.id}' (already defined in ${catalogById.get(condition.id).file})`);
      continue;
    }

    const bodySystem = condition.bodySystem || data.bodySystem || data.systemName;
    if (!bodySystem) {
      errors.push(`${file}#${condition.id}: missing body system`);
    }

    if (condition.aliases !== undefined && !Array.isArray(condition.aliases)) {
      errors.push(`${file}#${condition.id}: aliases must be an array`);
    }

    if (condition.ratingSchedule !== undefined && !Array.isArray(condition.ratingSchedule)) {
      errors.push(`${file}#${condition.id}: ratingSchedule must be an array`);
    }

    catalogById.set(condition.id, { file, bodySystem });
  }
}

const kbIds = new Set();
const kbSuggestionTargets = new Map();
// Quarantined pointer identities (canonical-identity reconciliation): the
// machine-readable `quarantine` marker declares that claims are authored under
// `canonicalId`, never under the pointer. The guards below refuse authored
// suggestions, adjacency nodes, and edges that would file a claim under a
// pointer.
const pointerById = new Map();
const SELF_DECLARED_POINTER = /This file is (RETIRED|retained) as a quarantined pointer record/i;

for (const { file, data } of kbFiles) {
  const expectedId = file.replace(/\.json$/, "");

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    errors.push(`${file}: root must be an object`);
    continue;
  }

  if (data.id !== expectedId) {
    errors.push(`${file}: id '${data.id}' does not match filename '${expectedId}'`);
  }

  if (typeof data.draft !== "boolean") {
    errors.push(`${file}: draft must be boolean`);
  }

  if (!Array.isArray(data.suggestions)) {
    errors.push(`${file}: suggestions must be an array`);
    continue;
  }

  if (kbIds.has(data.id)) {
    errors.push(`${file}: duplicate knowledge-base id '${data.id}'`);
  }
  kbIds.add(data.id);

  if (!catalogById.has(data.id)) {
    errors.push(`${file}: primary condition '${data.id}' is not present in data/conditions`);
  }

  // Fail-closed quarantine declaration: the marker and the self-declared
  // pointer wording must agree, so a new pointer cannot be smuggled in (or
  // silently un-declared) by editing only one of them.
  const mappingText = [
    ...(Array.isArray(data.todo) ? data.todo : []),
    ...(Array.isArray(data.governanceNotes) ? data.governanceNotes : []),
  ].join(" ");
  const selfDeclaredPointer = SELF_DECLARED_POINTER.test(mappingText);
  let declaredPointer = false;
  if (data.quarantine !== undefined) {
    const quarantine = data.quarantine;
    if (!quarantine || typeof quarantine !== "object" || Array.isArray(quarantine)) {
      errors.push(`${file}: quarantine must be an object`);
    } else if (quarantine.status !== "pointer") {
      errors.push(`${file}: quarantine.status must be 'pointer'`);
    } else if (typeof quarantine.canonicalId !== "string" || !/^[a-z0-9-]+$/.test(quarantine.canonicalId)) {
      errors.push(`${file}: quarantine.canonicalId must be a kebab-case condition id`);
    } else if (typeof quarantine.recordedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(quarantine.recordedOn)) {
      errors.push(`${file}: quarantine.recordedOn must be an ISO date`);
    } else if (typeof quarantine.record !== "string" || !quarantine.record.trim()) {
      errors.push(`${file}: quarantine.record must be a non-empty disposition reference`);
    } else {
      declaredPointer = true;
      pointerById.set(data.id, quarantine.canonicalId);
    }
  }
  if (selfDeclaredPointer && !declaredPointer) {
    errors.push(`${file}: self-declared quarantined pointer record without the machine-readable quarantine marker`);
  }
  if (declaredPointer && !selfDeclaredPointer) {
    errors.push(`${file}: quarantine marker without the pointer-record wording in todo/governanceNotes`);
  }
  if (declaredPointer && data.suggestions.length > 0) {
    errors.push(`${file}: quarantined pointer identity must not author suggestions — claims are filed under '${data.quarantine.canonicalId}'`);
  }

  const ranks = new Set();
  const targets = new Set();

  for (let index = 0; index < data.suggestions.length; index += 1) {
    const suggestion = data.suggestions[index];
    const prefix = `${file}: suggestions[${index}]`;

    if (!suggestion || typeof suggestion !== "object" || Array.isArray(suggestion)) {
      errors.push(`${prefix}: must be an object`);
      continue;
    }

    if (typeof suggestion.conditionId !== "string" || !suggestion.conditionId.trim()) {
      errors.push(`${prefix}: conditionId must be a non-empty string`);
    } else {
      if (suggestion.conditionId === data.id) {
        errors.push(`${prefix}: self-recommendation '${data.id}' is not allowed`);
      }
      if (targets.has(suggestion.conditionId)) {
        errors.push(`${prefix}: duplicate suggestion target '${suggestion.conditionId}'`);
      }
      targets.add(suggestion.conditionId);
      if (!catalogById.has(suggestion.conditionId)) {
        errors.push(`${prefix}: target '${suggestion.conditionId}' is not present in data/conditions`);
      }
    }

    if (!Number.isInteger(suggestion.rank) || suggestion.rank < 1) {
      errors.push(`${prefix}: rank must be a positive integer`);
    } else if (ranks.has(suggestion.rank)) {
      errors.push(`${prefix}: duplicate rank ${suggestion.rank}`);
    } else {
      ranks.add(suggestion.rank);
    }

    // CRG (Causal Relational Graph) required fields. Prevalence is removed;
    // every edge must declare a nexus pathway, a causal mechanism, and an
    // etiological consensus profile honest to the evidence.
    const nexus = suggestion.nexusClaim;
    if (!nexus || typeof nexus !== "object" || !["DIRECT_CAUSATION", "AGGRAVATION", "ASSOCIATION_ONLY"].includes(nexus.nexusClassification)) {
      errors.push(`${prefix}: nexusClaim.nexusClassification must be DIRECT_CAUSATION, AGGRAVATION, or ASSOCIATION_ONLY`);
    } else if (nexus.nexusClassification === "DIRECT_CAUSATION" && (!nexus.etiologicalTrigger || nexus.etiologicalTrigger.trim().length < 50)) {
      errors.push(`${prefix}: DIRECT_CAUSATION requires etiologicalTrigger of at least 50 characters`);
    } else if (nexus.nexusClassification === "AGGRAVATION" && ((!nexus.baselineProgression || nexus.baselineProgression.trim().length < 50) || (!nexus.aggravatingFactor || nexus.aggravatingFactor.trim().length < 50))) {
      errors.push(`${prefix}: AGGRAVATION requires baselineProgression and aggravatingFactor of at least 50 characters each`);
    } else if (nexus.nexusClassification === "ASSOCIATION_ONLY" && ((!nexus.associationBasis || nexus.associationBasis.trim().length < 50) || (!nexus.causationStatus || nexus.causationStatus.trim().length < 50))) {
      errors.push(`${prefix}: ASSOCIATION_ONLY requires associationBasis and causationStatus of at least 50 characters each`);
    }

    const mechanism = suggestion.causalMechanism;
    if (!mechanism || typeof mechanism !== "object") {
      errors.push(`${prefix}: causalMechanism is required`);
    } else {
      if (typeof mechanism.mechanismCategory !== "string" || !mechanism.mechanismCategory.trim()) {
        errors.push(`${prefix}: causalMechanism.mechanismCategory is required`);
      }
      if (typeof mechanism.primaryVector !== "string" || mechanism.primaryVector.trim().length < 50) {
        errors.push(`${prefix}: causalMechanism.primaryVector must be at least 50 characters`);
      }
      if (mechanism.hypothesizedOnly === true && nexus && nexus.nexusClassification !== "ASSOCIATION_ONLY") {
        errors.push(`${prefix}: causalMechanism.hypothesizedOnly is only valid for ASSOCIATION_ONLY edges`);
      }
    }

    const profile = suggestion.evidentiaryProfile;
    if (!profile || typeof profile !== "object") {
      errors.push(`${prefix}: evidentiaryProfile is required`);
    } else {
      const validTiers = ["WELL_ESTABLISHED", "PROBABLE", "CONTESTED_REQUIRES_SPECIFIC_EVIDENCE", "IATROGENIC_TREATMENT_EFFECT", "NOT_ESTABLISHED"];
      if (!validTiers.includes(profile.etiologicalConsensus)) {
        errors.push(`${prefix}: evidentiaryProfile.etiologicalConsensus must be one of ${validTiers.join(", ")}`);
      }
      if (nexus && nexus.nexusClassification === "ASSOCIATION_ONLY" && profile.etiologicalConsensus === "WELL_ESTABLISHED") {
        errors.push(`${prefix}: an ASSOCIATION_ONLY edge cannot claim WELL_ESTABLISHED etiological consensus`);
      }
      if (profile.etiologicalConsensus === "CONTESTED_REQUIRES_SPECIFIC_EVIDENCE") {
        if (!Array.isArray(profile.alternativeEtiologiesToRuleOut) || profile.alternativeEtiologiesToRuleOut.length < 2) {
          errors.push(`${prefix}: CONTESTED_REQUIRES_SPECIFIC_EVIDENCE mappings must list at least 2 alternative etiologies to rule out`);
        }
        if (profile.requiresSpecificDbqEvidence !== true) {
          errors.push(`${prefix}: CONTESTED_REQUIRES_SPECIFIC_EVIDENCE mappings require requiresSpecificDbqEvidence: true`);
        }
      }
    }

    if (typeof suggestion.rationale !== "string" || !suggestion.rationale.trim()) {
      errors.push(`${prefix}: rationale must be a non-empty string`);
    }

    for (const metadataError of validateSuggestionMetadata(suggestion)) {
      errors.push(`${prefix}: ${metadataError}`);
    }

    if (!Array.isArray(suggestion.evidenceGaps)) {
      errors.push(`${prefix}: evidenceGaps must be an array`);
    } else if (suggestion.evidenceGaps.some(gap => typeof gap !== "string" || !gap.trim())) {
      errors.push(`${prefix}: evidenceGaps entries must be non-empty strings`);
    }

    if (!Array.isArray(suggestion.sourceReferences) || suggestion.sourceReferences.length === 0) {
      errors.push(`${prefix}: sourceReferences must be a non-empty array`);
    } else {
      for (let sourceIndex = 0; sourceIndex < suggestion.sourceReferences.length; sourceIndex += 1) {
        const source = suggestion.sourceReferences[sourceIndex];
        const sourcePrefix = `${prefix}.sourceReferences[${sourceIndex}]`;

        if (!source || typeof source !== "object" || Array.isArray(source)) {
          errors.push(`${sourcePrefix}: must be an object`);
          continue;
        }

        if (typeof source.citation !== "string" || !source.citation.trim()) {
          errors.push(`${sourcePrefix}: citation must be a non-empty string`);
        }
        if (typeof source.note !== "string" || !source.note.trim()) {
          errors.push(`${sourcePrefix}: note must be a non-empty string`);
        }
        if (typeof source.verified !== "boolean") {
          errors.push(`${sourcePrefix}: verified must be boolean`);
        }
        if (source.verified === true && typeof source.sourceCheckedOn !== "string") {
          errors.push(`${sourcePrefix}: verified sources require sourceCheckedOn`);
        }

        for (const metadataError of validateExplicitMetadata(source)) {
          errors.push(`${sourcePrefix}: ${metadataError}`);
        }

        const hasV2SourceMetadata = [
          "authorityCategory",
          "propositionRole",
          "federalRegisterType",
          "bindingStatus",
          "effectiveDate",
          "applicability",
          "ruleVersion",
        ].some(key => Object.prototype.hasOwnProperty.call(source, key));
        const hasV2SuggestionMetadata =
          Object.prototype.hasOwnProperty.call(suggestion, "claimTheories") ||
          Object.prototype.hasOwnProperty.call(suggestion, "nexusRequirement");

        for (const issue of auditSource(source, {
          claimTheories: suggestion.claimTheories,
          nexusRequirement: suggestion.nexusRequirement,
        })) {
          const formatted = `${sourcePrefix}: [${issue.code}] ${issue.message}`;
          if (issue.severity === "error") errors.push(formatted);
          else if (issue.severity === "warning" && (hasV2SourceMetadata || hasV2SuggestionMetadata)) warnings.push(formatted);
        }
      }
    }
  }

  if (ranks.size > 0) {
    const sortedRanks = [...ranks].sort((a, b) => a - b);
    const expectedRanks = Array.from({ length: sortedRanks.length }, (_, index) => index + 1);
    if (JSON.stringify(sortedRanks) !== JSON.stringify(expectedRanks)) {
      errors.push(`${file}: ranks must be contiguous starting at 1`);
    }
  }

  // Pillar 4 quarantine: citation purity threshold. A mapping with > 30%
  // unverified citations must be forced to draft and excluded from published
  // recommendation output, and a mapping whose only citation is unverified is
  // immediately quarantined.
  for (let index = 0; index < data.suggestions.length; index += 1) {
    const suggestion = data.suggestions[index];
    const refs = suggestion.sourceReferences || [];
    const unverifiedCount = refs.filter(reference => reference.verified === false).length;
    if (refs.length === 1 && refs[0] && refs[0].verified === false) {
      if (data.draft !== true) {
        errors.push(`${file}: suggestions[${index}] relies on a single unverified citation and must be quarantined — set the mapping draft: true until the citation is verified`);
      }
      warnings.push(`${file}: suggestions[${index}] is quarantined behind a single unverified citation (draft-only)`);
    } else if (data.draft !== true && unverifiedCount / refs.length > 0.3) {
      errors.push(`${file}: suggestions[${index}] has ${unverifiedCount}/${refs.length} unverified citations (> 30% threshold) and must be quarantined — set the mapping draft: true until citation debt is cleared`);
    }
  }

  kbSuggestionTargets.set(data.id, targets);
}

// Fail-closed cross-file quarantine checks: a pointer's canonical target must
// exist and must not be another pointer, and no mapping may file a suggestion
// under a pointer ID.
for (const [pointerId, canonicalId] of pointerById) {
  if (canonicalId === pointerId) {
    errors.push(`knowledge-base/${pointerId}.json: quarantine.canonicalId must differ from the pointer id`);
  }
  if (!catalogById.has(canonicalId)) {
    errors.push(`knowledge-base/${pointerId}.json: quarantine.canonicalId '${canonicalId}' is not present in data/conditions`);
  }
  if (pointerById.has(canonicalId)) {
    errors.push(`knowledge-base/${pointerId}.json: quarantine.canonicalId '${canonicalId}' is itself a quarantined pointer — pointer chains are refused`);
  }
}
for (const { file, data } of kbFiles) {
  if (!data || typeof data !== "object" || !Array.isArray(data.suggestions)) continue;
  for (let index = 0; index < data.suggestions.length; index += 1) {
    const target = data.suggestions[index] && data.suggestions[index].conditionId;
    if (typeof target === "string" && pointerById.has(target)) {
      errors.push(`${file}: suggestions[${index}] files a claim under quarantined pointer '${target}' — author it under '${pointerById.get(target)}'`);
    }
  }
}

// Fail-closed adjacency-graph guard: a quarantined pointer may neither own a
// node file nor appear as an edge source or target.
const graphDir = path.join(kbDir, "graph");
if (fs.existsSync(graphDir)) {
  const graphFiles = fs.readdirSync(graphDir).filter(name => name.endsWith(".json")).sort();
  for (const file of graphFiles) {
    let node;
    try {
      node = JSON.parse(fs.readFileSync(path.join(graphDir, file), "utf8"));
    } catch (error) {
      errors.push(`graph/${file}: invalid JSON (${error.message})`);
      continue;
    }
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      errors.push(`graph/${file}: root must be an object`);
      continue;
    }
    if (typeof node.nodeId === "string" && pointerById.has(node.nodeId)) {
      errors.push(`graph/${file}: node '${node.nodeId}' is a quarantined pointer — author adjacency under '${pointerById.get(node.nodeId)}'`);
    }
    const edges = Array.isArray(node.outgoingEdges) ? node.outgoingEdges : [];
    for (const edge of edges) {
      if (!edge || typeof edge !== "object") continue;
      for (const [side, id] of [["sourceConditionId", edge.sourceConditionId], ["targetConditionId", edge.targetConditionId]]) {
        if (typeof id === "string" && pointerById.has(id)) {
          errors.push(`graph/${file}: edge ${side} '${id}' is a quarantined pointer — author it under '${pointerById.get(id)}'`);
        }
      }
    }
  }
}

for (const [id, { file }] of catalogById) {
  if (!kbIds.has(id)) {
    const warning = `catalog condition '${id}' from ${file} has no knowledge-base mapping`;
    unmappedCatalogConditions.push(warning);
    warnings.push(warning);
  }
}

// Structural presence is not coverage. `mappedConditions`/`unmappedCatalogConditions`
// below count knowledge-base *files*, which every catalog identity has — so they read
// 813/0 while 555 conditions still had no suggestions, and that is the number a reader
// of this summary would have taken for "mapping is done". The authored counts come from
// the same module the coverage ledger and its ratchet test use, so the three cannot
// describe different states of the repository.
const coverage = computeMappingCoverage(process.cwd());

const report = {
  knowledgeBaseFiles: kbFiles.length,
  catalogFiles: catalogFiles.length,
  catalogConditions: catalogById.size,
  mappedConditions: kbIds.size,
  unmappedCatalogConditions: unmappedCatalogConditions.length,
  conditionsWithAuthoredSuggestions: coverage.withAuthoredSuggestions,
  conditionsWithoutAuthoredSuggestions: coverage.withoutSuggestions,
  publishedMappings: coverage.published,
  draftMappingsWithAuthoredSuggestions: coverage.draft,
  relationshipEdges: coverage.suggestionEdges,
  errors,
  warnings,
};

console.log(JSON.stringify(report, null, 2));

if (errors.length > 0) {
  process.exitCode = 1;
}
