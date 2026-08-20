import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertMasterResolution2026CurrentState } from "./helpers/master-resolution-2026-current";

type Row = { primaryId: string; targetId: string; pmid: string; publicationGuard: string };
type Ledger = {
  ledgerStatus: string;
  implementationAuthorization: string;
  implementationResult: {
    relationshipEdgesAdded: number;
    sourceRowsAdded: number;
    sourceRowsVerified: number;
    remoteWritesPerformed: boolean;
    individualCausationClaimed: boolean;
  };
  rows: Row[];
};
type SourceReference = { citation?: string; sourceUrl?: string; verified?: boolean; verificationScope?: string };
type Suggestion = { conditionId: string; rank: number; rationale?: string; pathwayIntelligence?: unknown; sourceReferences?: SourceReference[] };
type Mapping = { draft: boolean; suggestions?: Suggestion[] };

const root = process.cwd();
const kbDir = path.join(root, "data", "knowledge-base");
const ledgerPath = path.join(root, "docs", "mapping-expansion-me1-approved-implementation-ledger.json");
const loadLedger = (): Ledger => JSON.parse(fs.readFileSync(ledgerPath, "utf8")) as Ledger;
const loadMapping = (id: string): Mapping => JSON.parse(fs.readFileSync(path.join(kbDir, `${id}.json`), "utf8")) as Mapping;
const stringTreeContains = (value: unknown, needle: string): boolean => {
  if (typeof value === "string") return value.includes(needle);
  if (Array.isArray(value)) return value.some((item) => stringTreeContains(item, needle));
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).some((item) => stringTreeContains(item, needle));
  return false;
};

describe("Mapping Expansion Batch ME-1", () => {
  it("records exactly five locally implemented approved relationships without citation promotion", () => {
    const d = loadLedger();
    expect(d.ledgerStatus).toBe("APPROVED-AND-IMPLEMENTED-LOCALLY");
    expect(d.implementationAuthorization).toBe("I approve");
    expect(d.rows).toHaveLength(5);
    expect(d.implementationResult.relationshipEdgesAdded).toBe(5);
    expect(d.implementationResult.sourceRowsAdded).toBe(5);
    expect(d.implementationResult.sourceRowsVerified).toBe(0);
    expect(d.implementationResult.remoteWritesPerformed).toBe(false);
    expect(d.implementationResult.individualCausationClaimed).toBe(false);
  });

  it("adds each approved edge with one unverified clinical source and exact approved guard", () => {
    const d = loadLedger();
    for (const row of d.rows) {
      const mapping = loadMapping(row.primaryId);
      expect(mapping.draft).toBe(false);
      const suggestion = (mapping.suggestions ?? []).find((s) => s.conditionId === row.targetId);
      expect(suggestion).toBeTruthy();
      if (!suggestion) throw new Error(`missing ME-1 suggestion ${row.primaryId}->${row.targetId}`);
      expect(suggestion.pathwayIntelligence).toBeUndefined();
      expect(suggestion.sourceReferences).toHaveLength(1);
      const source = suggestion.sourceReferences?.[0];
      expect(source?.verified).toBe(false);
      expect(source?.verificationScope).toBe("clinical-evidence");
      expect(source?.citation ?? "").toContain(`PMID ${row.pmid}`);
      expect(source?.sourceUrl).toBe(`https://pubmed.ncbi.nlm.nih.gov/${row.pmid}/`);
      expect(stringTreeContains(suggestion, row.publicationGuard)).toBe(true);
    }
  });

  it("pins the expected 178-edge / 186-reference pre-verification global state", () => {
    const files = fs.readdirSync(kbDir).filter((name) => name.endsWith(".json"));
    const mappings = files.map((name) => JSON.parse(fs.readFileSync(path.join(kbDir, name), "utf8")) as Mapping);
    expect(files).toHaveLength(311);
    expect(mappings.filter((m) => m.draft === false)).toHaveLength(139);
    expect(mappings.filter((m) => m.draft === true)).toHaveLength(172);
    const edges = mappings.reduce((sum, m) => sum + (m.suggestions ?? []).length, 0);
    expect(edges).toBe(178);
    expect(mappings.filter((m) => m.draft === false && (m.suggestions ?? []).length === 1)).toHaveLength(116);
    expect(mappings.filter((m) => m.draft === false && (m.suggestions ?? []).length >= 2)).toHaveLength(23);
    const refs = mappings.flatMap((m) => (m.suggestions ?? []).flatMap((s) => s.sourceReferences ?? []));
    expect(refs).toHaveLength(186);
    expect(refs.filter((r) => r.verified === true)).toHaveLength(181);
    expect(refs.filter((r) => r.verified === false)).toHaveLength(5);
  });

  it("preserves the completed Master Resolution citation-verification state for the prior 39 rows", () => {
    assertMasterResolution2026CurrentState();
  });
});
