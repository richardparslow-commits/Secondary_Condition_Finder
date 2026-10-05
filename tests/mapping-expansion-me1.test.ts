import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertMasterResolution2026CurrentState } from "./helpers/master-resolution-2026-current";

type ImplLedger = {
  ledgerStatus: string;
  implementationResult: { relationshipEdgesAdded: number; sourceRowsAdded: number; sourceRowsVerified: number };
  rows: Array<{ primaryId: string; targetId: string; pmid: string; publicationGuard: string }>;
};
type VerifyLedger = { ledgerStatus: string; implementationResult: { sourceRowsVerified: number; guardChanges: number; replacements: number } };
type Ref = { citation?: string; sourceUrl?: string; verified?: boolean; verificationScope?: string };
type Sug = { conditionId: string; rank: number; pathwayIntelligence?: unknown; sourceReferences?: Ref[] };
type Map = { draft: boolean; suggestions?: Sug[] };
const root = process.cwd();
const kb = path.join(root, "data", "knowledge-base");
const impl = (): ImplLedger => JSON.parse(fs.readFileSync(path.join(root, "docs", "mapping-expansion-me1-approved-implementation-ledger.json"), "utf8")) as ImplLedger;
const ver = (): VerifyLedger => JSON.parse(fs.readFileSync(path.join(root, "docs", "mapping-expansion-me1-citation-verification-approved-ledger.json"), "utf8")) as VerifyLedger;
const load = (id: string): Map => JSON.parse(fs.readFileSync(path.join(kb, `${id}.json`), "utf8")) as Map;
const contains = (v: unknown, n: string): boolean => typeof v === "string" ? v.includes(n) : Array.isArray(v) ? v.some((x) => contains(x, n)) : Boolean(v && typeof v === "object" && Object.values(v as Record<string, unknown>).some((x) => contains(x, n)));

describe("Mapping Expansion Batch ME-1", () => {
  it("preserves implementation-phase history and records separate citation verification", () => {
    const d = impl();
    expect(d.ledgerStatus).toBe("APPROVED-AND-IMPLEMENTED-LOCALLY");
    expect(d.implementationResult.relationshipEdgesAdded).toBe(5);
    expect(d.implementationResult.sourceRowsAdded).toBe(5);
    expect(d.implementationResult.sourceRowsVerified).toBe(0);
    const v = ver();
    expect(v.ledgerStatus).toBe("APPROVED-AND-IMPLEMENTED-LOCALLY");
    expect(v.implementationResult.sourceRowsVerified).toBe(5);
    expect(v.implementationResult.guardChanges).toBe(0);
    expect(v.implementationResult.replacements).toBe(0);
  });

  it("keeps all five approved edges and guards while sources are verified", () => {
    for (const row of impl().rows) {
      const m = load(row.primaryId);
      const s = (m.suggestions ?? []).find((x) => x.conditionId === row.targetId);
      expect(s).toBeTruthy();
      expect(s?.pathwayIntelligence).toBeUndefined();
      expect(s?.sourceReferences).toHaveLength(1);
      const r = s?.sourceReferences?.[0];
      expect(r?.verified).toBe(true);
      expect(r?.verificationScope).toBe("clinical-evidence");
      expect(r?.citation ?? "").toContain(`PMID ${row.pmid}`);
      expect(r?.sourceUrl).toBe(`https://pubmed.ncbi.nlm.nih.gov/${row.pmid}/`);
      expect(contains(s, row.publicationGuard)).toBe(true);
    }
  });

  it("preserves the ME-1 closed baseline while allowing later approved expansion batches", () => {
    const files = fs.readdirSync(kb).filter((n) => n.endsWith(".json"));
    const maps = files.map((n) => JSON.parse(fs.readFileSync(path.join(kb, n), "utf8")) as Map);
    expect(files).toHaveLength(819);
    expect(maps.filter((m) => m.draft === false)).toHaveLength(140);
    expect(maps.filter((m) => m.draft === true)).toHaveLength(679);
    expect(maps.reduce((n, m) => n + (m.suggestions ?? []).length, 0)).toBeGreaterThanOrEqual(178);
    const refs = maps.flatMap((m) => (m.suggestions ?? []).flatMap((s) => s.sourceReferences ?? []));
    expect(refs.length).toBeGreaterThanOrEqual(186);
    for (const row of impl().rows) {
      const m = load(row.primaryId);
      const s = (m.suggestions ?? []).find((x) => x.conditionId === row.targetId);
      expect(s?.sourceReferences?.[0]?.verified).toBe(true);
    }
  });

  it("preserves the completed Master Resolution state", () => {
    assertMasterResolution2026CurrentState();
  });
});
