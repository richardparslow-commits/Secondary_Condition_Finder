import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";
import { KbEdgeSchema, KbNodeMappingSchema } from "@/lib/kb/schema";

import { node } from "./helpers/pathway-fixtures";

/**
 * End-to-end contracts for scripts/audit-crg.ts (the CRG adjacency cycle gate).
 *
 * The script previously exited 0 ("not migrated yet") whenever nothing parsed
 * as a KbNodeMapping — including when every file was corrupt JSON, a
 * schema-invalid adjacency file, or an arbitrary object. It now distinguishes:
 *
 *   - no .json files            → explicit vacuous pass (transitional state)
 *   - authored mapping files    → explicit vacuous pass (transitional state)
 *   - invalid JSON              → hard failure
 *   - adjacency keys + bad body → hard failure
 *   - non-mapping JSON objects  → hard failure
 *   - a real cycle              → hard failure
 */

const SCRIPT = path.join(process.cwd(), "scripts", "audit-crg.ts");
const tempDirs: string[] = [];

function fixtureDir(files: Record<string, unknown>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-crg-"));
  tempDirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(dir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(
      target,
      typeof content === "string" ? content : JSON.stringify(content),
    );
  }
  return dir;
}

function run(dir: string, extraArgs: string[] = []): { status: number; stdout: string; stderr: string } {
  // spawnSync captures both streams on success too: the vacuous-migration
  // notice is deliberately emitted on stderr as a warning.
  const result = spawnSync(
    process.execPath,
    ["--no-warnings", SCRIPT, `--kb-dir=${dir}`, ...extraArgs],
    { encoding: "utf8" },
  );
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("audit-crg.ts fail-closed behavior", () => {
  it("passes explicitly (vacuous) when the directory has no JSON files", () => {
    const result = run(fixtureDir({}));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("no .json files found");
  });

  it("treats a missing graph directory as the vacuous pre-migration state", () => {
    const missing = path.join(os.tmpdir(), `audit-crg-missing-${process.pid}-${Date.now()}`);
    const result = run(missing);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("no .json files found");
  });

  it("passes explicitly (vacuous) for valid authored mapping files", () => {
    // The shipped pre-migration corpus: authored mapping objects with no
    // nodeId/outgoingEdges keys.
    const result = run(
      fixtureDir({
        "ptsd.json": {
          id: "ptsd",
          draft: true,
          todo: ["awaiting authoring"],
          suggestions: [],
        },
      }),
    );
    expect(result.status).toBe(0);
    // The vacuous state is deliberately a warning (stderr), not a silent log.
    expect(result.stderr).toContain("VACUOUS PASS");
  });

  it("hard-fails invalid JSON instead of treating it as a migration state", () => {
    const result = run(fixtureDir({ "broken.json": "{not-json" }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("not valid JSON");
  });

  it("hard-fails a file carrying adjacency keys but failing the schema", () => {
    const result = run(
      fixtureDir({ "node.json": { nodeId: "ptsd", outgoingEdges: "not-an-array" } }),
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("adjacency-file keys");
  });

  it("hard-fails unrecognized JSON objects when nothing else parses", () => {
    const result = run(fixtureDir({ "junk.json": { hello: "world" } }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("neither KbNodeMapping adjacency files nor valid authored");
  });

  it("detects a real multi-hop cycle in adjacency files", () => {
    const edge = (sourceConditionId: string, targetConditionId: string) =>
      KbEdgeSchema.parse({
        sourceConditionId,
        targetConditionId,
        rank: 1,
        // Canonical graph-edge shape: ASSOCIATION_ONLY literals materialize
        // from defaults; any cycle is a failure regardless of classification.
        nexusClaim: { nexusClassification: "ASSOCIATION_ONLY" },
        causalMechanism: {
          mechanismCategory: "NOT_ESTABLISHED",
          primaryVector: "Synthetic fixture vector for adjacency gate coverage.",
          hypothesizedOnly: true,
        },
        evidentiaryProfile: {
          etiologicalConsensus: "NOT_ESTABLISHED",
          vaNexusProbabilityAlignment: "NOT_ASSERTED",
          conservativeRationale:
            "Synthetic fixture rationale used only to exercise the adjacency gate.",
          evidenceGaps: "Synthetic fixture gap.",
          alternativeEtiologiesToRuleOut: ["Synthetic alternative"],
          requiresSpecificDbqEvidence: false,
        },
        rationale: "Synthetic fixture edge used only to exercise the adjacency gate.",
        evidenceGaps: ["Synthetic fixture gap for the adjacency gate test."],
      });
    const nodeA = KbNodeMappingSchema.parse({
      nodeId: "alpha",
      outgoingEdges: [edge("alpha", "beta")],
    });
    const nodeB = KbNodeMappingSchema.parse({
      nodeId: "beta",
      outgoingEdges: [edge("beta", "alpha")],
    });

    const result = run(fixtureDir({ "alpha.json": nodeA, "beta.json": nodeB }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("circular");
  });
});

/**
 * ARCH-01: the adjacency gate also refuses unsupported edges.
 *
 * Acyclicity and authored support are independent failures, and the gate is
 * where CI should attribute the second one — otherwise a graph edge that no
 * authored record backs is only discovered by whichever test happens to load
 * the graph, and a review that only reads this gate's verdict would see a
 * green "acyclic" on a claim nothing supports.
 */
describe("audit-crg.ts authored-evidence join (ARCH-01)", () => {
  const SOURCE = "liver-cancer";
  const TARGET = "sarcopenia";
  // A real authored mapping: supports liver-cancer → sarcopenia with three
  // citations and an ASSOCIATION_ONLY classification.
  const authored = () =>
    structuredClone(loadKnowledgeBase().find((mapping) => mapping.id === SOURCE)!);
  const matchingNode = () => node(SOURCE, [TARGET, 1, "ASSOCIATION_ONLY"]);

  function stagedGraph(nodeMapping: unknown, mapping: unknown): string {
    return fixtureDir({
      [`${SOURCE}.json`]: mapping,
      [`graph/${SOURCE}.json`]: nodeMapping,
    });
  }

  it("passes an acyclic graph whose edges have matching authored evidence", () => {
    const dir = stagedGraph(matchingNode(), authored());
    const result = run(path.join(dir, "graph"), [`--kb-root=${dir}`]);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("acyclic");
    expect(result.stdout).toContain("ARCH-01");
  });

  it("fails an acyclic edge with no authored suggestion", () => {
    const mapping = authored();
    mapping.suggestions = [];
    const dir = stagedGraph(matchingNode(), mapping);
    const result = run(path.join(dir, "graph"), [`--kb-root=${dir}`]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Missing authored evidence");
    expect(result.stderr).toContain(`${SOURCE} -> ${TARGET}`);
  });

  it("fails an acyclic edge whose classification disagrees with the authored suggestion", () => {
    // Both records are individually valid; they just claim different nexuses.
    const dir = stagedGraph(node(SOURCE, [TARGET, 1]), authored());
    const result = run(path.join(dir, "graph"), [`--kb-root=${dir}`]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Nexus classification mismatch");
  });

  it("fails an acyclic edge with no authored evidence, as evidence rather than as a cycle", () => {
    const mapping = authored();
    mapping.suggestions = [];
    const dir = stagedGraph(matchingNode(), mapping);
    const result = run(path.join(dir, "graph"), [`--kb-root=${dir}`]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Missing authored evidence");
    expect(result.stderr).not.toContain("circular");
  });

  it("fails loudly on a malformed evidence record instead of skipping it", () => {
    // The join's own empty-citation branch is unreachable through this path
    // because the authored schema refuses a citation-less suggestion first.
    // What matters is that the refusal happens: a malformed record must not be
    // dropped from the corpus and let the gate report PASS.
    const mapping = authored();
    mapping.suggestions[0].sourceReferences = [];
    const dir = stagedGraph(matchingNode(), mapping);
    const result = run(path.join(dir, "graph"), [`--kb-root=${dir}`]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("not a valid condition mapping");
  });

  it("fails closed when no authored corpus can be located", () => {
    // A fixture graph outside the project must not make the gate read an
    // arbitrary parent directory, and it must not silently skip the join.
    const dir = stagedGraph(matchingNode(), authored());
    const result = run(path.join(dir, "graph"));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no authored corpus directory was found");
    expect(result.stderr).toContain("--kb-root");
  });

  it("fails closed when the authored corpus holds no mappings", () => {
    const dir = fixtureDir({
      [`graph/${SOURCE}.json`]: matchingNode(),
      // Not a mapping: kb:validate's business, so the join must not treat it as
      // evidence — but its absence of mappings must not pass either.
      "notes.json": { hello: "world" },
    });
    const result = run(path.join(dir, "graph"), [`--kb-root=${dir}`]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no authored condition mappings");
  });
});
