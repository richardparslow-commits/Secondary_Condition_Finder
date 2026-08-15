import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("clinical program completion controls", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("records the Batch-23 citation baseline and completed expansion accounting", () => {
    const tracker = read("docs/kb-coverage-tracker.md");
    expect(tracker).toMatch(/20 published-evidence-led|published.*\*\*20\*\*/i);
    expect(tracker).toMatch(/intentionally draft after Batch 23:\s*\*\*87\*\*/i);
    expect(tracker).toMatch(/promotion candidates remaining:\s*\*\*0\*\*/i);
    expect(tracker).toMatch(/live references:\s*\*\*70\*\*/i);
    expect(tracker).toMatch(/published-unverified review findings:\s*\*\*60\*\*/i);
    expect(tracker).toMatch(/live clinical-evidence references with canonical URLs:\s*\*\*65\*\*/i);
    expect(tracker).toMatch(/Type 1 diabetes|diabetes-mellitus-type-1/i);
  });

  it("keeps the three v2 modeling dispositions safe without deleting stable identities", () => {
    const modeling = read("docs/modeling-debt-dispositions.md");
    for (const id of ["contralateral-knee-condition", "micro-tbi", "cerebral-palsy"]) {
      expect(modeling).toContain(id);
      expect(byId.has(id), `missing stable KB identity ${id}`).toBe(true);
    }
    expect(byId.get("micro-tbi")?.draft).toBe(true);
    expect(byId.get("micro-tbi")?.suggestions).toEqual([]);
    expect(byId.get("cerebral-palsy")?.draft).toBe(true);
  });

  it("exposes the exact qualified-human published citation queue without auto-verifying sources", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["citations:queue"]).toContain("report-citation-verification-queue.js");
    const script = read("scripts/report-citation-verification-queue.js");
    expect(script).toMatch(/verified === true/);
    expect(script).toMatch(/reviewerDecision:\s*"PENDING"/);
    expect(script).toMatch(/qualified human/i);
    const instructions = read("docs/qualified-human-citation-verification-queue.md");
    expect(instructions).toMatch(/60 live unverified published references/i);
    expect(instructions).toMatch(/62 live unverified references/i);
    expect(instructions).toMatch(/cannot.*qualified-human|not.*qualified-human|only a qualified human/i);
  });

  it("keeps external and human-only gates explicitly open rather than fabricating completion", () => {
    const gates = read("docs/external-manual-gates-status.md");
    expect(gates).toMatch(/Issue #189[\s\S]*OPEN \/ EXTERNALLY BLOCKED/i);
    expect(gates).toMatch(/Issue #195[\s\S]*OPEN \/ HUMAN-ONLY/i);
    expect(gates).toMatch(/Issue #213[\s\S]*COMPLETE \/ CLOSED/i);
    expect(gates).toMatch(/must not close #189/i);
    expect(gates).toMatch(/must not close #195/i);
  });
});
