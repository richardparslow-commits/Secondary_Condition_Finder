import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { conditionCatalogSchema } from "@/lib/catalog/schema";
import { loadKbGraph, loadKbGraphFromDir, resetKbGraphCache } from "@/lib/kb/graph";
import { loadKnowledgeBase } from "@/lib/kb/load";
import {
  conditionMappingSchema,
  knowledgeBaseSchema,
  quarantinePointerSchema,
  type KnowledgeBase,
} from "@/lib/kb/schema";
import {
  assertNoQuarantinedPointerGraphNodes,
  validateKnowledgeBaseAgainstCatalog,
} from "@/lib/kb/validate";

import {
  buildCausalMechanism,
  buildEvidentiaryProfile,
  buildNexusClaim,
} from "./helpers/crg-fixtures";
import { node } from "./helpers/pathway-fixtures";

/**
 * Fail-closed guard for quarantined pointer identities (canonical-identity
 * reconciliation, docs/modeling-debt-dispositions.md): a pointer record may
 * never author suggestions, own an adjacency node, or be the target of a
 * suggestion or edge, so no claim can be filed under a retired identity. The
 * guard is enforced at four layers, each exercised here:
 *
 *   1. schema parse (`conditionMappingSchema`),
 *   2. runtime knowledge-base validation (`validateKnowledgeBaseAgainstCatalog`),
 *   3. runtime graph loading (`loadKbGraphFromDir` → `assertNoQuarantinedPointerGraphNodes`),
 *   4. the CI corpus validator (scripts/validate-knowledge-base.js; run as `npm run kb:validate`).
 */

const POINTER_MARKER = {
  status: "pointer",
  canonicalId: "canonical-identity",
  recordedOn: "2026-09-28",
  record: "docs/modeling-debt-dispositions.md",
} as const;

function catalogFixture(ids: readonly string[]) {
  return conditionCatalogSchema.parse(
    ids.map((id) => ({
      id,
      name: `Fixture ${id}`,
      aliases: [],
      bodySystem: "Test",
      ratingSchedule: [],
      reviewNotes: ["test fixture"],
    })),
  );
}

function suggestionFixture(conditionId: string) {
  return {
    conditionId,
    rank: 1,
    nexusClaim: buildNexusClaim(),
    causalMechanism: buildCausalMechanism(),
    evidentiaryProfile: buildEvidentiaryProfile(),
    rationale: "test fixture",
    evidenceGaps: ["test fixture"],
    sourceReferences: [{ citation: "test", note: "test", verified: false }],
  };
}

function pointerMappingFixture(id: string, canonicalId: string) {
  return {
    id,
    draft: true,
    todo: ["fixture: quarantined pointer record, no authoring"],
    quarantine: { ...POINTER_MARKER, canonicalId },
    suggestions: [],
  };
}

function authoringMappingFixture(id: string, target: string) {
  return {
    id,
    draft: true,
    todo: ["fixture: draft mapping pending review"],
    suggestions: [suggestionFixture(target)],
  };
}

const tempDirs: string[] = [];

function fixtureDir(files: Record<string, unknown>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kb-pointer-guard-"));
  tempDirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), JSON.stringify(content));
  }
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  resetKbGraphCache();
});

describe("quarantine marker schema", () => {
  it("refuses a quarantined pointer that authors a suggestion", () => {
    const parsed = conditionMappingSchema.safeParse({
      ...pointerMappingFixture("pointer-identity", "canonical-identity"),
      suggestions: [suggestionFixture("canonical-identity")],
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("expected the schema to refuse a pointer-authored suggestion");
    expect(parsed.error.issues.some((issue) => /cannot author suggestions/i.test(issue.message))).toBe(true);
  });

  it("refuses a pointer whose canonical identity is itself", () => {
    const parsed = conditionMappingSchema.safeParse(
      pointerMappingFixture("pointer-identity", "pointer-identity"),
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("expected the schema to refuse a self-canonical pointer");
    expect(parsed.error.issues.some((issue) => /different canonical identity/i.test(issue.message))).toBe(true);
  });

  it("keeps the marker strict: unknown fields and non-pointer statuses are refused", () => {
    expect(quarantinePointerSchema.safeParse({ ...POINTER_MARKER, extra: true }).success).toBe(false);
    expect(quarantinePointerSchema.safeParse({ ...POINTER_MARKER, status: "open" }).success).toBe(false);
    expect(quarantinePointerSchema.safeParse({ ...POINTER_MARKER, canonicalId: "Not Kebab" }).success).toBe(false);
  });
});

describe("runtime knowledge-base guard", () => {
  it("refuses a pointer record that authors suggestions (defense in depth)", () => {
    const catalog = catalogFixture(["pointer-identity", "canonical-identity"]);
    const kb = [
      {
        ...pointerMappingFixture("pointer-identity", "canonical-identity"),
        suggestions: [suggestionFixture("canonical-identity")],
      },
    ] as unknown as KnowledgeBase;

    expect(() => validateKnowledgeBaseAgainstCatalog(catalog, kb)).toThrow(
      /Quarantined pointer "pointer-identity" authors suggestions/,
    );
  });

  it("refuses a suggestion filed under a quarantined pointer identity", () => {
    const catalog = catalogFixture(["authoring-home", "pointer-identity", "canonical-identity"]);
    const kb = knowledgeBaseSchema.parse([
      authoringMappingFixture("authoring-home", "pointer-identity"),
      pointerMappingFixture("pointer-identity", "canonical-identity"),
    ]);

    expect(() => validateKnowledgeBaseAgainstCatalog(catalog, kb)).toThrow(
      /Mapping "authoring-home" files a claim under quarantined pointer identity "pointer-identity"; author it under the canonical identity "canonical-identity"/,
    );
  });

  it("refuses an unknown canonical target and a pointer chain", () => {
    const missing = knowledgeBaseSchema.parse([
      pointerMappingFixture("pointer-identity", "missing-canonical"),
    ]);
    expect(() =>
      validateKnowledgeBaseAgainstCatalog(catalogFixture(["pointer-identity"]), missing),
    ).toThrow(/names canonical identity "missing-canonical" which has no matching condition/);

    const chain = knowledgeBaseSchema.parse([
      pointerMappingFixture("pointer-identity", "second-pointer"),
      pointerMappingFixture("second-pointer", "canonical-identity"),
    ]);
    expect(() =>
      validateKnowledgeBaseAgainstCatalog(
        catalogFixture(["pointer-identity", "second-pointer", "canonical-identity"]),
        chain,
      ),
    ).toThrow(/points at quarantined pointer "second-pointer"; pointer chains are refused/);
  });
});

describe("graph guard", () => {
  const pointers = knowledgeBaseSchema.parse([
    pointerMappingFixture("pointer-identity", "canonical-identity"),
  ]);

  it("refuses an adjacency node owned by a pointer and an edge targeting one", () => {
    expect(() =>
      assertNoQuarantinedPointerGraphNodes(pointers, [
        node("pointer-identity", ["canonical-identity", 1]),
      ]),
    ).toThrow(/Node "pointer-identity" is a quarantined pointer identity/);

    expect(() =>
      assertNoQuarantinedPointerGraphNodes(pointers, [
        node("authoring-home", ["pointer-identity", 1]),
      ]),
    ).toThrow(/files a claim under quarantined pointer identity "pointer-identity"/);
  });

  it("refuses pointer nodes through the graph loader (runtime path)", () => {
    const pointerNodeDir = fixtureDir({
      "tmj-dysfunction.json": node("tmj-dysfunction", ["tmj-disorder", 1]),
    });
    expect(() => loadKbGraphFromDir(pointerNodeDir)).toThrow(
      /Node "tmj-dysfunction" is a quarantined pointer identity/,
    );

    const pointerTargetDir = fixtureDir({
      "gout.json": node("gout", ["tmj-dysfunction", 1]),
    });
    expect(() => loadKbGraphFromDir(pointerTargetDir)).toThrow(
      /files a claim under quarantined pointer identity "tmj-dysfunction"/,
    );
  });
});

describe("shipped corpus", () => {
  const kb = loadKnowledgeBase();
  const pointers = kb.filter((mapping) => mapping.quarantine?.status === "pointer");

  it("declares exactly the three reconciled pointer records, each without suggestions", () => {
    expect(pointers.map((mapping) => mapping.id).sort()).toEqual([
      "rotator-cuff-tear",
      "skier-s-thumb",
      "tmj-dysfunction",
    ]);
    for (const pointer of pointers) {
      expect(pointer.suggestions).toEqual([]);
      expect(pointer.quarantine?.canonicalId).not.toBe(pointer.id);
      const notes = [...pointer.todo, ...(pointer.governanceNotes ?? [])].join(" ");
      expect(notes).toMatch(/This file is (RETIRED|retained) as a quarantined pointer record/i);
    }
    expect(pointers.map((mapping) => mapping.quarantine?.canonicalId).sort()).toEqual([
      "gamekeeper-s-thumb",
      "rotator-cuff-injury",
      "tmj-disorder",
    ]);
  });

  it("files no suggestion under a pointer identity", () => {
    const pointerIds = new Set(pointers.map((mapping) => mapping.id));
    for (const mapping of kb) {
      for (const suggestion of mapping.suggestions) {
        expect(
          pointerIds.has(suggestion.conditionId),
          `${mapping.id} files a claim under pointer ${suggestion.conditionId}`,
        ).toBe(false);
      }
    }
  });

  it("loads no adjacency node for a pointer and no edge targeting one", () => {
    const graph = loadKbGraph();
    const pointerIds = new Set(pointers.map((mapping) => mapping.id));
    for (const [nodeId, graphNode] of graph) {
      expect(pointerIds.has(nodeId), `graph node ${nodeId} is a pointer`).toBe(false);
      for (const edge of graphNode.outgoingEdges) {
        expect(
          pointerIds.has(edge.targetConditionId),
          `${nodeId} -> ${edge.targetConditionId} targets a pointer`,
        ).toBe(false);
      }
    }
  });
});
