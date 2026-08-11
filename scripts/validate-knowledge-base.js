/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const repoRoot = process.cwd();
const kbDir = path.join(repoRoot, "data/knowledge-base");
const catalogDir = path.join(repoRoot, "data/conditions");

const errors = [];
const warnings = [];

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

    if (typeof suggestion.prevalence !== "string" || !suggestion.prevalence.trim()) {
      errors.push(`${prefix}: prevalence must be a non-empty string`);
    }

    if (typeof suggestion.rationale !== "string" || !suggestion.rationale.trim()) {
      errors.push(`${prefix}: rationale must be a non-empty string`);
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

  kbSuggestionTargets.set(data.id, targets);
}

for (const [id, { file }] of catalogById) {
  if (!kbIds.has(id)) {
    warnings.push(`catalog condition '${id}' from ${file} has no knowledge-base mapping`);
  }
}

const report = {
  knowledgeBaseFiles: kbFiles.length,
  catalogFiles: catalogFiles.length,
  catalogConditions: catalogById.size,
  mappedConditions: kbIds.size,
  unmappedCatalogConditions: warnings.length,
  errors,
  warnings,
};

console.log(JSON.stringify(report, null, 2));

if (errors.length > 0) {
  process.exitCode = 1;
}
