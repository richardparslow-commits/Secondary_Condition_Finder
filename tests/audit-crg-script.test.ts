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
 *   - an all-causation cycle    → hard failure (a violation everywhere)
 *   - a review-class shape      → hard failure until a recorded disposition
 *                                 exists in the governance ledger (audit A08)
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

  it("hard-fails a pure-causation cycle in adjacency files", () => {
    const edge = (sourceConditionId: string, targetConditionId: string) =>
      KbEdgeSchema.parse({
        sourceConditionId,
        targetConditionId,
        rank: 1,
        // Canonical graph-edge shape: ASSOCIATION_ONLY literals materialize
        // from defaults; a causation cycle is a violation in every point.
        nexusClaim: { nexusClassification: "DIRECT_CAUSATION" },
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
    expect(result.stderr).toContain("CRG-PURE-CAUSATION-CYCLE");
  });

  it("holds an association-only reciprocal pair for a recorded disposition instead of rejecting a defensible direction", () => {
    // The A08 repro shape: this pair used to be rejected as a cycle by the gate
    // while the runtime loader accepted it. Both directions are legitimate, so
    // the gate now admits the shape once a qualified human records the decision
    // — and fails closed until then, so it cannot land unreviewed either.
    const ungoverned = run(fixtureDir(reciprocalAssociationPairFiles()));
    expect(ungoverned.status).toBe(1);
    expect(ungoverned.stderr).toContain("CRG-ADJACENCY-REVIEW-UNGOVERNED");
    expect(ungoverned.stderr).toContain("alpha<->beta");
    // Not a blanket "circular" rejection: the pair is legitimate, the review is
    // what is missing.
    expect(ungoverned.stderr).not.toContain("circular");

    const withLedger = fixtureDir({
      ...reciprocalAssociationPairFiles("graph/"),
      ...authoredAssociationPairCorpus(),
      "ledger.json": {
        version: 1,
        reviewedCycles: [],
        reviewedBidirectionalPairs: [
          { pair: ["alpha", "beta"], disposition: "Synthetic recorded decision for the gate contract." },
        ],
      },
    });

    const governed = run(path.join(withLedger, "graph"), [
      `--kb-root=${withLedger}`,
      `--governance=${path.join(withLedger, "ledger.json")}`,
    ]);
    // Admitted end to end: the pair is legitimate, the record exists, and the
    // authored join still has to hold.
    expect(governed.status, governed.stderr).toBe(0);
    expect(governed.stdout).toContain("reviewed pair alpha<->beta");
    expect(governed.stdout).toContain("ARCH-01");
  });

  it("fails a ledger entry that describes no live finding, even on a currently clean graph", () => {
    // Otherwise the last resolved finding's entry would linger unexamined and
    // the record would quietly stop describing the graph it governs.
    const associationOnly = {
      version: 1,
      reviewedCycles: [],
      reviewedBidirectionalPairs: [
        { pair: ["gone-a", "gone-b"], disposition: "Resolved; entry left behind." },
      ],
    };
    const dir = fixtureDir({
      "graph/alpha.json": KbNodeMappingSchema.parse({
        nodeId: "alpha",
        outgoingEdges: [edgeSchema("alpha", "beta")],
      }),
      "ledger.json": associationOnly,
    });
    const result = run(path.join(dir, "graph"), [
      `--governance=${path.join(dir, "ledger.json")}`,
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("CRG-ADJACENCY-GOVERNANCE-STALE");
    expect(result.stderr).toContain("gone-a<->gone-b");
  });
});

/**
 * Minimal parsed graph edge for the governance cases. Association-only edges
 * carry the canonical hypothesized shape, mirroring the shared traversal
 * fixtures; a causation edge carries the asserted shape.
 */
function edgeSchema(
  sourceConditionId: string,
  targetConditionId: string,
  classification: "DIRECT_CAUSATION" | "AGGRAVATION" | "ASSOCIATION_ONLY" = "DIRECT_CAUSATION",
) {
  const associationOnly = classification === "ASSOCIATION_ONLY";
  return KbEdgeSchema.parse({
    sourceConditionId,
    targetConditionId,
    rank: 1,
    nexusClaim: { nexusClassification: classification },
    causalMechanism: {
      mechanismCategory: associationOnly ? "NOT_ESTABLISHED" : "PSYCHOPHYSIOLOGICAL",
      primaryVector: "Synthetic fixture vector for the adjacency gate governance contract.",
      hypothesizedOnly: associationOnly,
    },
    evidentiaryProfile: {
      etiologicalConsensus: associationOnly ? "NOT_ESTABLISHED" : "PROBABLE",
      vaNexusProbabilityAlignment: associationOnly ? "NOT_ASSERTED" : "AT_LEAST_AS_LIKELY_AS_NOT",
      conservativeRationale: "Synthetic fixture rationale for the adjacency gate governance contract.",
      evidenceGaps: "Synthetic fixture gap.",
      alternativeEtiologiesToRuleOut: ["Synthetic alternative"],
      requiresSpecificDbqEvidence: false,
    },
    rationale: "Synthetic fixture edge used only to exercise governance entry reconciliation.",
    evidenceGaps: ["Synthetic fixture gap for governance reconciliation."],
  });
}

/** A reciprocal association-only pair — the A08 repro shape, as adjacency files. */
function reciprocalAssociationPairFiles(prefix = "") {
  return {
    [`${prefix}alpha.json`]: KbNodeMappingSchema.parse({
      nodeId: "alpha",
      outgoingEdges: [edgeSchema("alpha", "beta", "ASSOCIATION_ONLY")],
    }),
    [`${prefix}beta.json`]: KbNodeMappingSchema.parse({
      nodeId: "beta",
      outgoingEdges: [edgeSchema("beta", "alpha", "ASSOCIATION_ONLY")],
    }),
  };
}

/**
 * Authored evidence for the pair above: cloned from a real published-association
 * record (three citations, ASSOCIATION_ONLY) with fixture identities only, so
 * the join runs against evidence the shipped corpus actually carries rather than
 * a hand-written suggestion. `beta.json` carries the reciprocal suggestion so
 * each direction is its own authored claim, which is what the corpus audit's
 * governance-note rule and this gate's ledger both model.
 */
function authoredAssociationPairCorpus() {
  const base = loadKnowledgeBase().find((mapping) => mapping.id === "liver-cancer");
  if (!base) throw new Error("Fixture base mapping liver-cancer is missing from the shipped corpus.");
  const alpha = structuredClone(base);
  alpha.id = "alpha";
  alpha.suggestions = alpha.suggestions.map((suggestion) => ({ ...suggestion, conditionId: "beta" }));
  const beta = structuredClone(base);
  beta.id = "beta";
  beta.suggestions = beta.suggestions.map((suggestion) => ({ ...suggestion, conditionId: "alpha" }));
  return { "alpha.json": alpha, "beta.json": beta };
}

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
