#!/usr/bin/env node
/**
 * Emits the public client corpus consumed by the browser-local secondary
 * workflow (PRIV-01, accepted 2026-10-07).
 *
 *   npm run build:client-corpus
 *
 * Public authored content only: catalog conditions, PUBLISHED (non-draft)
 * mappings, adjacency-graph nodes, and the public graph-anchor index (the
 * citation anchors the /pathways explorer already renders to every visitor).
 * Workflow state never belongs here. The generator fails loud on structurally
 * invalid data (unreadable JSON, a mapping whose id does not match its
 * filename, or a duplicate graph node id) rather than emitting a corpus the
 * browser cannot trust.
 *
 * tests/privacy-browser-context.test.ts proves this artifact is identical to
 * `buildClientCorpus()` over the live loaders, so client and server outputs
 * cannot drift.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CATALOG_DIR = join(ROOT, "data", "conditions");
const KB_DIR = join(ROOT, "data", "knowledge-base");
const GRAPH_DIR = join(KB_DIR, "graph");
const OUT_DIR = join(ROOT, "public", "kb");
const OUT = join(OUT_DIR, "client-corpus.json");

const VERSION = 2;

// Mirrors `anchorLabel()` in src/lib/engine/graph-pathway-projection.ts. The
// parity test (tests/privacy-browser-context.test.ts) fails if this drifts
// from buildClientCorpus() over the live loaders.
const PUBMED_URL_PATTERN = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i;
const anchorLabel = (reference) => {
  const pmid = reference.sourceUrl?.match(PUBMED_URL_PATTERN)?.[1];
  if (pmid) return `PMID ${pmid}`;
  if (reference.sourceUrl) {
    try {
      return new URL(reference.sourceUrl).hostname;
    } catch {
      // Fall through to the generic label for an unparsable URL.
    }
  }
  return "Citation";
};

const jsonFiles = (directory) =>
  readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort();

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const conditions = [];
for (const file of jsonFiles(CATALOG_DIR)) {
  const parsed = readJson(join(CATALOG_DIR, file));
  const entries = Array.isArray(parsed?.conditions) ? parsed.conditions : [];
  if (entries.length === 0) throw new Error(`${file}: no conditions`);
  for (const condition of entries) conditions.push(condition);
}

const mappings = [];
for (const file of jsonFiles(KB_DIR)) {
  const parsed = readJson(join(KB_DIR, file));
  const expectedId = file.replace(/\.json$/, "");
  if (parsed?.id !== expectedId) {
    throw new Error(`${file}: mapping id "${parsed?.id}" does not match its filename`);
  }
  mappings.push(parsed);
}
// Drafts stay out of the shipped corpus; the anchor join below still reads the
// full authored corpus, exactly like the server-rendered /pathways explorer.
const publishedMappings = mappings.filter((mapping) => mapping.draft !== true);

const graph = [];
const seenNodeIds = new Set();
for (const file of jsonFiles(GRAPH_DIR)) {
  const parsed = readJson(join(GRAPH_DIR, file));
  const expectedId = file.replace(/\.json$/, "");
  if (parsed?.nodeId !== expectedId) {
    throw new Error(`${file}: nodeId "${parsed?.nodeId}" does not match its filename`);
  }
  if (seenNodeIds.has(parsed.nodeId)) {
    throw new Error(`${file}: duplicate graph nodeId "${parsed.nodeId}"`);
  }
  seenNodeIds.add(parsed.nodeId);
  graph.push(parsed);
}

const graphAnchors = [];
const mappingById = new Map(mappings.map((mapping) => [mapping.id, mapping]));
for (const node of graph) {
  for (const edge of node.outgoingEdges ?? []) {
    const suggestion = mappingById
      .get(edge.sourceConditionId)
      ?.suggestions?.find((candidate) => candidate.conditionId === edge.targetConditionId);
    const anchors = (suggestion?.sourceReferences ?? []).map((reference) => ({
      label: anchorLabel(reference),
      sourceUrl: reference.sourceUrl,
      verified: reference.verified,
    }));
    if (anchors.length === 0) continue;
    graphAnchors.push({
      sourceConditionId: edge.sourceConditionId,
      targetConditionId: edge.targetConditionId,
      anchors,
    });
  }
}

const corpus = { version: VERSION, conditions, publishedMappings, graph, graphAnchors };
const serialized = JSON.stringify(corpus);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, serialized);

console.log(
  `wrote public/kb/client-corpus.json — ${conditions.length} conditions, ` +
    `${publishedMappings.length} published mappings, ${graph.length} graph nodes, ` +
    `${graphAnchors.length} anchored graph edges, ` +
    `${(serialized.length / 1024).toFixed(0)} KB`,
);
