import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { generateCatalogClaimPathways } from "@/lib/engine/graph-pathways";
import { generateClaimPathways } from "@/lib/engine/pathway-generator";
import { loadKbGraph, loadKbGraphFromDir, resetKbGraphCache } from "@/lib/kb/graph";
import { KB_GRAPH_DIR_RELATIVE } from "@/lib/kb/graph-layout";

import { node } from "./helpers/pathway-fixtures";

/**
 * Contracts for the adjacency-graph loader (`src/lib/kb/graph.ts`) and its
 * generator entry point (`src/lib/engine/graph-pathways.ts`).
 *
 * The loader is the runtime data path for the multi-hop traversal, so its
 * failures must be loud and specific: invalid JSON, schema-invalid nodes,
 * filename/nodeId drift, duplicate nodes, and catalog-unknown nodes or targets
 * all throw instead of degrading to a partial graph. The traversal fixture
 * uses the authored hypertension → CKD → anemia route with matching classes
 * because the loader validates evidence joins too, and the end-to-end case runs
 * a loaded fixture graph through the path generator.
 */

const tempDirs: string[] = [];

function fixtureDir(files: Record<string, unknown>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kb-graph-"));
  tempDirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(
      path.join(dir, name),
      typeof content === "string" ? content : JSON.stringify(content),
    );
  }
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  resetKbGraphCache();
});

describe("adjacency-graph loader", () => {
  it("keeps the runtime filesystem anchor literal and aligned with the shared layout (REL-03)", () => {
    // Turbopack must see every segment at the filesystem callsite; an imported
    // relative-directory constant previously expanded traces to the project root.
    // A production-build trace inspection is still required beyond this guard.
    const source = fs.readFileSync(path.join(process.cwd(), "src/lib/kb/graph.ts"), "utf8");
    const literal = source.match(
      /const KB_GRAPH_DIR = path\.join\(process\.cwd\(\), "([^"]+)", "([^"]+)", "([^"]+)"\);/,
    );
    expect(literal, "runtime graph path must be statically anchored").not.toBeNull();
    expect(literal?.slice(1).join("/")).toBe(KB_GRAPH_DIR_RELATIVE);
  });

  it("preserves the uncached default-directory tooling seam", () => {
    const first = loadKbGraphFromDir();
    const second = loadKbGraphFromDir();
    expect(first).not.toBe(second);
    expect([...first]).toEqual([...second]);
    expect([...first]).toEqual([...loadKbGraph()]);
  });

  it("loads the shipped graph directory and caches the result", () => {
    const graphDir = path.join(process.cwd(), KB_GRAPH_DIR_RELATIVE);
    const fileCount = fs
      .readdirSync(graphDir)
      .filter((name) => name.endsWith(".json")).length;

    const graph = loadKbGraph();
    expect(graph.size).toBe(fileCount);
    expect(graph.size).toBeGreaterThan(0);
    expect(graph.has("liver-cancer")).toBe(true);
    // The shipped graph's first real authored edge (2026-10-03).
    const liverCancer = graph.get("liver-cancer");
    expect(liverCancer?.outgoingEdges).toHaveLength(1);
    expect(liverCancer?.outgoingEdges[0]?.targetConditionId).toBe("sarcopenia");
    // The second authored node (Stage 3a, 2026-10-04): alcohol-use-disorder ->
    // chronic-liver-disease, registered in lockstep with the authored-corpus
    // suggestion and the registry rows.
    expect(graph.has("alcohol-use-disorder")).toBe(true);
    const aud = graph.get("alcohol-use-disorder");
    expect(aud?.outgoingEdges).toHaveLength(1);
    expect(aud?.outgoingEdges[0]?.targetConditionId).toBe("chronic-liver-disease");
    // The third authored node (Stage 3c, 2026-10-04): bruxism-awake-sleep ->
    // tmj-disorder, the signed ME-34 reopening, registered in lockstep with the
    // authored-corpus suggestion and the registry rows.
    expect(graph.has("bruxism-awake-sleep")).toBe(true);
    const bruxism = graph.get("bruxism-awake-sleep");
    expect(bruxism?.outgoingEdges).toHaveLength(1);
    expect(bruxism?.outgoingEdges[0]?.targetConditionId).toBe("tmj-disorder");

    // Cached: the same map instance is returned until the cache is reset.
    expect(loadKbGraph()).toBe(graph);
  });

  it("emits the authored shipped-graph pathway and nothing for unknown origins", () => {
    // The graph's first real edge (authored 2026-10-03): liver-cancer ->
    // sarcopenia at ASSOCIATION_ONLY. This proves the on-disk adjacency file
    // reaches the generator end-to-end; the association-only hop is emitted
    // for transparency with the chain marked broken, and an origin with no
    // adjacency node still yields no mapping rather than an error.
    const pathways = generateCatalogClaimPathways("liver-cancer");
    expect(pathways.map((pathway) => pathway.terminalConditionId)).toEqual(["sarcopenia"]);
    expect(pathways[0]?.hops).toHaveLength(1);
    expect(pathways[0]?.hops[0]?.edge.targetConditionId).toBe("sarcopenia");
    expect(pathways[0]?.compositeNexus).toBe("ASSOCIATION_ONLY_CHAIN_BROKEN");
    // The second authored node (Stage 3a) reaches the generator the same way.
    const audPathways = generateCatalogClaimPathways("alcohol-use-disorder");
    expect(audPathways.map((pathway) => pathway.terminalConditionId)).toEqual(["chronic-liver-disease"]);
    expect(audPathways[0]?.hops).toHaveLength(1);
    expect(audPathways[0]?.compositeNexus).toBe("ASSOCIATION_ONLY_CHAIN_BROKEN");
    // The third authored node (Stage 3c) reaches the generator the same way.
    const bruxismPathways = generateCatalogClaimPathways("bruxism-awake-sleep");
    expect(bruxismPathways.map((pathway) => pathway.terminalConditionId)).toEqual(["tmj-disorder"]);
    expect(bruxismPathways[0]?.hops).toHaveLength(1);
    expect(bruxismPathways[0]?.compositeNexus).toBe("ASSOCIATION_ONLY_CHAIN_BROKEN");
    expect(generateCatalogClaimPathways("not-a-real-condition")).toEqual([]);
  });

  it("parses a fixture graph through the loader into generator pathways", () => {
    const dir = fixtureDir({
      "hypertension.json": node("hypertension", ["chronic-kidney-disease", 1]),
      "chronic-kidney-disease.json": node("chronic-kidney-disease", ["anemia", 1, "ASSOCIATION_ONLY"]),
    });

    const graph = loadKbGraphFromDir(dir);
    expect([...graph.keys()].sort()).toEqual(["chronic-kidney-disease", "hypertension"]);

    const pathways = generateClaimPathways("hypertension", graph);
    expect(pathways.map((pathway) => pathway.terminalConditionId)).toEqual([
      "chronic-kidney-disease",
      "anemia",
    ]);
  });

  it("treats a missing or empty graph directory as the empty pre-migration state", () => {
    const missing = path.join(os.tmpdir(), `kb-graph-missing-${process.pid}-${Date.now()}`);
    expect(loadKbGraphFromDir(missing).size).toBe(0);

    const empty = fixtureDir({});
    expect(loadKbGraphFromDir(empty).size).toBe(0);

    // Non-JSON files are not adjacency files and do not make the directory
    // ambiguous.
    const withExtra = fixtureDir({ "notes.txt": "not a graph node" });
    expect(loadKbGraphFromDir(withExtra).size).toBe(0);
  });

  it("fails loud on invalid JSON without disclosing parser diagnostics", () => {
    const sentinel = "SYNTHETIC-GRAPH-PARSER-SECRET";
    const dir = fixtureDir({ "ptsd.json": `{"private":"${sentinel}"` });
    let thrown: unknown;
    try {
      loadKbGraphFromDir(dir);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe("[kb-graph] Invalid JSON in ptsd.json.");
    expect(String(thrown)).not.toContain(sentinel);
  });

  it("fails loud on a schema-invalid node mapping without disclosing validation details", () => {
    const sentinel = "SYNTHETIC-GRAPH-SCHEMA-SECRET";
    const dir = fixtureDir({
      "ptsd.json": { id: sentinel, draft: true, suggestions: [] },
    });
    let thrown: unknown;
    try {
      loadKbGraphFromDir(dir);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe("[kb-graph] Invalid node mapping in ptsd.json.");
    expect(String(thrown)).not.toContain(sentinel);
  });

  it("fails loud when the file name disagrees with nodeId", () => {
    const dir = fixtureDir({
      "hypertension.json": node("ptsd", ["hypertension", 1]),
    });
    expect(() => loadKbGraphFromDir(dir)).toThrowError("[kb-graph] Node id mismatch in hypertension.json.");
  });

  it("fails loud on a nodeId that is not a catalog identity", () => {
    const dir = fixtureDir({
      "not-a-real-condition.json": node("not-a-real-condition", ["ptsd", 1]),
    });
    expect(() => loadKbGraphFromDir(dir)).toThrowError(
      "[kb-graph] A node has no matching condition in the catalog.",
    );
  });

  it("fails loud on an edge target that is not a catalog identity", () => {
    const dir = fixtureDir({
      "ptsd.json": node("ptsd", ["not-a-real-condition", 1]),
    });
    expect(() => loadKbGraphFromDir(dir)).toThrowError(
      "[kb-graph] An edge targets an unknown condition.",
    );
  });
});
