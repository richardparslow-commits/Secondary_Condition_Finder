import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertMasterResolution2026CurrentState } from "./helpers/master-resolution-2026-current";

type Row = {
  primaryId: string;
  targetId: string;
  decision: "as-written" | "narrowed" | "replacement";
  current: { pmid: string };
  finalApproved: { pmid: string; sourceUrl: string; publicationGuard: string };
};

type Ledger = {
  ledgerStatus: string;
  qualifiedHumanApproval: string;
  approvedLedgerSha256: string;
  approvalState: {
    rowsReviewed: number;
    asWritten: number;
    narrowed: number;
    replacements: number;
    rejected: number;
    unresolved: number;
    finalUniquePmids: number;
  };
  implementationResult: {
    sourceRowsVerified: number;
    individualCausationClaimed: boolean;
    remoteWritesPerformed: boolean;
  };
  rows: Row[];
};

type SourceReference = {
  citation?: string;
  sourceUrl?: string;
  sourceLocator?: string;
  verified?: boolean;
};

type Suggestion = { conditionId: string; sourceReferences?: SourceReference[] };
type Mapping = { suggestions?: Suggestion[] };

const root = process.cwd();
const ledgerPath = path.join(root, "docs", "clinical-mapping-master-resolution-citation-verification-2026-approved-ledger.json");
const loadLedger = (): Ledger => JSON.parse(fs.readFileSync(ledgerPath, "utf8")) as Ledger;
const loadMapping = (id: string): Mapping => JSON.parse(fs.readFileSync(path.join(root, "data", "knowledge-base", `${id}.json`), "utf8")) as Mapping;
const stringTreeContains = (value: unknown, needle: string): boolean => {
  if (typeof value === "string") return value.includes(needle);
  if (Array.isArray(value)) return value.some((item) => stringTreeContains(item, needle));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => stringTreeContains(item, needle));
  }
  return false;
};

describe("Clinical Mapping Master Resolution Citation Verification 2026", () => {
  it("implements exactly 23 as-written, 14 narrowed, and 2 replacement rows", () => {
    const d = loadLedger();
    expect(d.ledgerStatus).toBe("APPROVED-AND-IMPLEMENTED-LOCALLY");
    expect(d.qualifiedHumanApproval).toBe(
      "I approve of the consolidated implementation ledger first, then use it as the fail-closed specification for the actual citation promotion.",
    );
    expect(d.approvalState.rowsReviewed).toBe(39);
    expect(d.approvalState.asWritten).toBe(23);
    expect(d.approvalState.narrowed).toBe(14);
    expect(d.approvalState.replacements).toBe(2);
    expect(d.approvalState.rejected).toBe(0);
    expect(d.approvalState.unresolved).toBe(0);
    expect(d.approvalState.finalUniquePmids).toBe(36);
  });

  it("marks every approved Master Resolution source row verified with the final PMID and exact approved guard", () => {
    const d = loadLedger();
    for (const row of d.rows) {
      const mapping = loadMapping(row.primaryId);
      const suggestion = (mapping.suggestions ?? []).find((s) => s.conditionId === row.targetId);
      expect(suggestion).toBeTruthy();
      if (!suggestion) throw new Error(`missing ${row.primaryId}->${row.targetId}`);
      expect(suggestion.sourceReferences).toHaveLength(1);
      const source = suggestion.sourceReferences?.[0];
      expect(source?.verified).toBe(true);
      expect(source?.citation ?? "").toContain(`PMID ${row.finalApproved.pmid}`);
      expect(source?.sourceUrl).toBe(row.finalApproved.sourceUrl);
      expect(stringTreeContains(suggestion, row.finalApproved.publicationGuard)).toBe(true);
    }
  });

  it("removes superseded unverified PMIDs from live citation/URL while preserving sourceLocator provenance", () => {
    const d = loadLedger();
    const replacements = d.rows.filter((r) => r.decision === "replacement");
    expect(replacements).toHaveLength(2);
    for (const row of replacements) {
      const mapping = loadMapping(row.primaryId);
      const suggestion = (mapping.suggestions ?? []).find((s) => s.conditionId === row.targetId);
      if (!suggestion) throw new Error(`missing replacement ${row.primaryId}->${row.targetId}`);
      const source = suggestion.sourceReferences?.[0];
      expect(source?.citation ?? "").not.toContain(`PMID ${row.current.pmid}`);
      expect(source?.sourceUrl ?? "").not.toContain(`/${row.current.pmid}/`);
      expect(source?.citation ?? "").toContain(`PMID ${row.finalApproved.pmid}`);
      expect(source?.sourceUrl ?? "").toContain(`/${row.finalApproved.pmid}/`);
      expect(source?.sourceLocator ?? "").toContain(`supersedes unverified PMID ${row.current.pmid}`);
    }
  });

  it("pins the exact current global Master Resolution state", () => {
    assertMasterResolution2026CurrentState();
  });

  it("records approval without claiming an individual medical nexus or remote write", () => {
    const d = loadLedger();
    expect(d.implementationResult.sourceRowsVerified).toBe(39);
    expect(d.implementationResult.individualCausationClaimed).toBe(false);
    expect(d.implementationResult.remoteWritesPerformed).toBe(false);
  });
});
