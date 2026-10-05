/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Coverage of the mapping layer, computed from the data rather than reported.
 *
 * `unmappedCatalogConditions` in the validator's summary counts "has a
 * knowledge-base file", which is every condition once the catalog import runs —
 * so it read 0 while 555 conditions had no suggestions at all. That is the metric
 * this module replaces: presence of a file is structural, authoring is the work.
 *
 * One definition, three consumers: the validator's report, the ledger the ratchet
 * test audits, and the CLI. A second copy of these rules would drift, and a
 * coverage number that drifts is worse than no number.
 */
const fs = require("fs");
const path = require("path");

const CATALOG_DIR = "data/conditions";
const KNOWLEDGE_BASE_DIR = "data/knowledge-base";

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

/** Every catalog identity, with the body system it is filed under. */
function readCatalog(root) {
  const catalog = new Map();
  const catalogDir = path.join(root, CATALOG_DIR);
  for (const file of fs.readdirSync(catalogDir).filter((n) => n.endsWith(".json"))) {
    for (const condition of readJson(path.join(catalogDir, file)).conditions ?? []) {
      catalog.set(condition.id, condition.bodySystem || "Unassigned");
    }
  }
  return catalog;
}

/**
 * A condition counts as mapped when its knowledge-base file carries at least one
 * authored suggestion. `draft: true` still counts: the authored relationship
 * exists and is awaiting qualified-human publication review, which is a different
 * state from never having been researched.
 */
function computeMappingCoverage(root = process.cwd()) {
  const catalog = readCatalog(root);
  const knowledgeBaseDir = path.join(root, KNOWLEDGE_BASE_DIR);
  const bodySystems = new Map();
  const withoutSuggestions = [];
  const withoutKnowledgeBaseFile = [];
  let withAuthoredSuggestions = 0;
  let published = 0;
  let draft = 0;
  let suggestionEdges = 0;

  for (const [id, bodySystem] of [...catalog].sort(([a], [b]) => a.localeCompare(b))) {
    const file = path.join(knowledgeBaseDir, `${id}.json`);
    const suggestions = fs.existsSync(file) ? readJson(file).suggestions ?? [] : null;
    const system = bodySystems.get(bodySystem) ?? {
      bodySystem,
      catalogIdentities: 0,
      withAuthoredSuggestions: 0,
      published: 0,
      draft: 0,
      withoutSuggestions: 0,
    };

    system.catalogIdentities += 1;
    if (suggestions === null) {
      withoutKnowledgeBaseFile.push(id);
      system.withoutSuggestions += 1;
      withoutSuggestions.push(id);
    } else if (suggestions.length === 0) {
      withoutSuggestions.push(id);
      system.withoutSuggestions += 1;
    } else {
      withAuthoredSuggestions += 1;
      suggestionEdges += suggestions.length;
      system.withAuthoredSuggestions += 1;
      if (readJson(file).draft === true) {
        draft += 1;
        system.draft += 1;
      } else {
        published += 1;
        system.published += 1;
      }
    }
    bodySystems.set(bodySystem, system);
  }

  return {
    catalogIdentities: catalog.size,
    withAuthoredSuggestions,
    published,
    draft,
    withoutSuggestions: withoutSuggestions.length,
    suggestionEdges,
    withoutKnowledgeBaseFile,
    bodySystems: [...bodySystems.values()].sort((a, b) =>
      a.bodySystem.localeCompare(b.bodySystem),
    ),
    withoutSuggestionsIds: withoutSuggestions,
  };
}

module.exports = { computeMappingCoverage };
