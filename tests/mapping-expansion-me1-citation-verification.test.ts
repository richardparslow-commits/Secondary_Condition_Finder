import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Row = {
  primaryId: string;
  targetId: string;
  decision: string;
  current: { pmid: string; citation: string; sourceUrl: string; publicationGuard: string };
  finalApproved: { pmid: string; citation: string; sourceUrl: string; publicationGuard: string };
};
type Ledger = {
  ledgerStatus: string;
  qualifiedHumanApproval: string;
  approvalState: { rowsReviewed: number; asImplemented: number; guardChanges: number; replacements: number; finalUniquePmids: number };
  implementationResult: { sourceRowsVerified: number; individualCausationClaimed: boolean; remoteWritesPerformed: boolean };
  rows: Row[];
};
type Ref = { citation?: string; sourceUrl?: string; sourceLocator?: string; verified?: boolean; verificationScope?: string };
type Sug = { conditionId: string; pathwayIntelligence?: unknown; sourceReferences?: Ref[] };
type Map = { suggestions?: Sug[] };
const root = process.cwd();
const ledgerPath = path.join(root, "docs", "mapping-expansion-me1-citation-verification-approved-ledger.json");
const ledger = (): Ledger => JSON.parse(fs.readFileSync(ledgerPath, "utf8")) as Ledger;
const load = (id: string): Map => JSON.parse(fs.readFileSync(path.join(root, "data", "knowledge-base", `${id}.json`), "utf8")) as Map;
const contains = (v: unknown, n: string): boolean => typeof v === "string" ? v.includes(n) : Array.isArray(v) ? v.some((x) => contains(x, n)) : Boolean(v && typeof v === "object" && Object.values(v as Record<string, unknown>).some((x) => contains(x, n)));

describe("ME-1 Citation Verification", () => {
  it("records the exact five-row approval with no replacements or guard changes", () => {
    const d = ledger();
    expect(d.ledgerStatus).toBe("APPROVED-AND-IMPLEMENTED-LOCALLY");
    expect(d.qualifiedHumanApproval).toBe("I approve Recommended approval scope: approve all 5 ME-1 citations as implemented for qualified-human citation promotion, with no source replacements and no further guard changes");
    expect(d.approvalState.rowsReviewed).toBe(5);
    expect(d.approvalState.asImplemented).toBe(5);
    expect(d.approvalState.guardChanges).toBe(0);
    expect(d.approvalState.replacements).toBe(0);
    expect(d.approvalState.finalUniquePmids).toBe(5);
  });

  it("marks all five implemented sources verified without citation, URL, or guard substitution", () => {
    for (const row of ledger().rows) {
      expect(row.decision).toBe("as-implemented");
      expect(row.current.pmid).toBe(row.finalApproved.pmid);
      expect(row.current.citation).toBe(row.finalApproved.citation);
      expect(row.current.sourceUrl).toBe(row.finalApproved.sourceUrl);
      expect(row.current.publicationGuard).toBe(row.finalApproved.publicationGuard);
      const s = (load(row.primaryId).suggestions ?? []).find((x) => x.conditionId === row.targetId);
      expect(s).toBeTruthy();
      expect(s?.pathwayIntelligence).toBeUndefined();
      const r = s?.sourceReferences?.[0];
      expect(r?.verified).toBe(true);
      expect(r?.verificationScope).toBe("clinical-evidence");
      expect(r?.citation).toBe(row.finalApproved.citation);
      expect(r?.sourceUrl).toBe(row.finalApproved.sourceUrl);
      expect(contains(s, row.finalApproved.publicationGuard)).toBe(true);
      expect(r?.sourceLocator ?? "").toContain("qualified-human-approved Mapping Expansion Batch ME-1 Citation Verification");
    }
  });

  it("records promotion without individual-causation or remote-write claims", () => {
    const d = ledger();
    expect(d.implementationResult.sourceRowsVerified).toBe(5);
    expect(d.implementationResult.individualCausationClaimed).toBe(false);
    expect(d.implementationResult.remoteWritesPerformed).toBe(false);
  });
});
