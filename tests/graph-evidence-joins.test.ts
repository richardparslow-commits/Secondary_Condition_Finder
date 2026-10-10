import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { buildClientCorpus, parseClientCorpus } from "@/lib/client-corpus";
import { mappingAnchorResolver, projectGraphPathway } from "@/lib/engine/graph-pathway-projection";
import { generateClaimPathways } from "@/lib/engine/pathway-generator";
import { loadKbGraph, loadKbGraphFromDir, resetKbGraphCache } from "@/lib/kb/graph";
import { loadKnowledgeBase } from "@/lib/kb/load";
import type { KnowledgeBase } from "@/lib/kb/schema";

import { node } from "./helpers/pathway-fixtures";

const temporary: string[] = [];
const freshDirectory = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "graph-evidence-"));
  temporary.push(directory);
  return directory;
};
const source = "liver-cancer";
const target = "sarcopenia";
const validNode = () => node(source, [target, 1, "ASSOCIATION_ONLY"]);
const kbFixture = (): KnowledgeBase => structuredClone(loadKnowledgeBase().filter(mapping => mapping.id === source));
const fixtureGraph = (graphNode = validNode()) => new Map([[source, graphNode]]);

afterEach(() => {
  vi.restoreAllMocks();
  resetKbGraphCache();
  for (const directory of temporary.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("graph evidence joins (ARCH-01)", () => {
  it.each(["missing mapping", "missing suggestion", "empty citations", "classification mismatch"])(
    "refuses %s while constructing a public corpus",
    defect => {
      const kb = kbFixture();
      const graphNode = validNode();
      if (defect === "missing mapping") kb.length = 0;
      if (defect === "missing suggestion") kb[0].suggestions = [];
      if (defect === "empty citations") kb[0].suggestions[0].sourceReferences = [];
      if (defect === "classification mismatch") {
        // Both records are individually schema-valid, but make different claims.
        graphNode.outgoingEdges = node(source, [target, 1]).outgoingEdges;
      }
      expect(() => buildClientCorpus(loadConditionCatalog(), kb, [graphNode])).toThrow(
        defect === "classification mismatch" ? /Nexus classification mismatch.*liver-cancer.*sarcopenia/ : /Missing authored evidence.*liver-cancer.*sarcopenia/,
      );
    },
  );

  it("retains draft research edges without publishing drafts or altering verification flags", () => {
    const kb = kbFixture();
    const original = structuredClone(kb);
    const corpus = buildClientCorpus(loadConditionCatalog(), kb, [validNode()]);
    expect(corpus.graph).toHaveLength(1);
    expect(corpus.publishedMappings).toEqual([]);
    expect(corpus.graphAnchors[0].anchors).toHaveLength(3);
    expect(corpus.graphAnchors[0].anchors.every(anchor => anchor.verified)).toBe(true);
    expect(kb).toEqual(original);
  });

  it("rejects a graph edge with no authored suggestion through the real loader", () => {
    const directory = freshDirectory();
    fs.writeFileSync(path.join(directory, "hypertension.json"), JSON.stringify(node("hypertension", ["sleep-apnea", 1])));
    expect(() => loadKbGraphFromDir(directory)).toThrow(/Missing authored evidence.*hypertension.*sleep-apnea/);
  });

  it("does not cache a rejected classification, and retries after the source is repaired", () => {
    const read = fs.readFileSync.bind(fs);
    const spy = vi.spyOn(fs, "readFileSync").mockImplementation((file, options) => {
      if (String(file) === path.join(process.cwd(), "data/knowledge-base/graph/liver-cancer.json")) {
        return JSON.stringify(node(source, [target, 1]));
      }
      return read(file, options);
    });
    expect(() => loadKbGraph()).toThrow(/Nexus classification mismatch.*liver-cancer.*sarcopenia/);
    spy.mockRestore();
    const repaired = loadKbGraph();
    expect(repaired.get(source)?.outgoingEdges[0].nexusClaim.nexusClassification).toBe("ASSOCIATION_ONLY");
    expect(loadKbGraph()).toBe(repaired);
  });

  it("refuses to project a pathway without authored citation anchors", () => {
    const pathway = generateClaimPathways(source, fixtureGraph())[0];
    expect(() => projectGraphPathway(pathway, id => id, mappingAnchorResolver(new Map()))).toThrow(/Missing authored evidence.*liver-cancer.*sarcopenia/);
    expect(() => projectGraphPathway(pathway, id => id, () => [])).toThrow(/Missing authored evidence.*liver-cancer.*sarcopenia/);
  });

  it.each(["missing", "empty", "duplicate"])("rejects a %s client anchor entry", defect => {
    const corpus = buildClientCorpus(loadConditionCatalog(), kbFixture(), [validNode()]);
    if (defect === "missing") corpus.graphAnchors = [];
    if (defect === "empty") corpus.graphAnchors[0].anchors = [];
    if (defect === "duplicate") corpus.graphAnchors.push(structuredClone(corpus.graphAnchors[0]));
    expect(() => parseClientCorpus(corpus)).toThrow(/graph.*anchor/i);
  });

  it.each([
    "missing suggestion",
    "empty citations",
    "classification mismatch",
    "edge source mismatch",
    "unknown mapping key",
    "valid draft",
  ])(
    "tests the delivered generator CLI against %s without overwriting good output on refusal",
    defect => {
      const directory = freshDirectory();
      fs.mkdirSync(path.join(directory, "data/conditions"), { recursive: true });
      fs.mkdirSync(path.join(directory, "data/knowledge-base/graph"), { recursive: true });
      fs.mkdirSync(path.join(directory, "public/kb"), { recursive: true });
      fs.writeFileSync(path.join(directory, "data/conditions/fixture.json"), JSON.stringify({ conditions: loadConditionCatalog().filter(condition => [source, target].includes(condition.id)) }));
      const kb = kbFixture();
      const graphNode = validNode();
      if (defect === "missing suggestion") kb[0].suggestions = [];
      if (defect === "empty citations") kb[0].suggestions[0].sourceReferences = [];
      if (defect === "classification mismatch") graphNode.outgoingEdges = node(source, [target, 1]).outgoingEdges;
      // An edge whose source disagrees with its file's root node: schema-invalid
      // input that the join alone could otherwise evaluate against the *wrong*
      // authored record and report PASS.
      if (defect === "edge source mismatch") graphNode.outgoingEdges[0].sourceConditionId = "some-other-condition";
      if (defect === "unknown mapping key") (kb[0] as Record<string, unknown>).extraKey = "not permitted";
      fs.writeFileSync(path.join(directory, `data/knowledge-base/${source}.json`), JSON.stringify(kb[0]));
      fs.writeFileSync(path.join(directory, `data/knowledge-base/graph/${source}.json`), JSON.stringify(graphNode));
      const output = path.join(directory, "public/kb/client-corpus.json");
      fs.writeFileSync(output, "previous-good-artifact");
      const run = spawnSync(process.execPath, [path.join(process.cwd(), "scripts/build-client-corpus.mjs")], { cwd: directory, encoding: "utf8" });
      if (defect === "valid draft") {
        expect(run.status, run.stderr).toBe(0);
        const corpus = parseClientCorpus(JSON.parse(fs.readFileSync(output, "utf8")));
        expect(corpus.publishedMappings).toEqual([]);
        expect(corpus.graphAnchors[0].anchors).toHaveLength(3);
      } else {
        expect(run.status).toBe(1);
        // Where the refusal comes from is part of the contract. The authored
        // schema runs before the join, so input it rejects never reaches the
        // join's own messages — the citation-less case included, because the
        // schema already requires at least one citation. The join's
        // empty-citation branch stays covered by the in-memory
        // `buildClientCorpus` case above, which constructs the object directly.
        const expectedError =
          defect === "classification mismatch"
            ? /Nexus classification mismatch/
            : defect === "edge source mismatch"
              ? /not a valid adjacency node/
              : defect === "empty citations" || defect === "unknown mapping key"
                ? /not a valid authored mapping/
                : /Missing authored evidence/;
        expect(run.stderr).toMatch(expectedError);
        expect(fs.readFileSync(output, "utf8")).toBe("previous-good-artifact");
      }
    },
  );
});
