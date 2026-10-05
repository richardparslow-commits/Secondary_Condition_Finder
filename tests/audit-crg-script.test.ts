import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { KbEdgeSchema, KbNodeMappingSchema } from "@/lib/kb/schema";

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
    fs.writeFileSync(
      path.join(dir, name),
      typeof content === "string" ? content : JSON.stringify(content),
    );
  }
  return dir;
}

function run(dir: string): { status: number; stdout: string; stderr: string } {
  // spawnSync captures both streams on success too: the vacuous-migration
  // notice is deliberately emitted on stderr as a warning.
  const result = spawnSync(
    process.execPath,
    ["--no-warnings", SCRIPT, `--kb-dir=${dir}`],
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
