import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ADJUDICATION_PACKETS,
  collectKbSuggestions,
} from "./helpers/adjudication-packets";

/**
 * Cirrhosis-of-the-liver → sarcopenia redundancy adjudication contract —
 * record-specific half.
 *
 * The record's identity and posture (the adjudicated `liver-cancer` →
 * `sarcopenia` premise pair with its relationship id, the forbidden
 * `liver-cancer` ↔ `cirrhosis-of-the-liver` and `cirrhosis-of-the-liver` →
 * `sarcopenia` pairs, the read-only adjudication status, the supersession
 * trigger marker, and the design/row-504/checklist wiring) are pinned by the
 * shared harness: the record is registered in `ADJUDICATION_PACKETS`
 * (`tests/helpers/adjudication-packets.ts`) and the shared suite
 * (`tests/adjudication-packets-contract.test.ts`) keeps it tied to the live
 * corpus. This suite keeps the contracts only this record can carry:
 *
 * 1. The recorded determination: the Coexist prospective classification, the
 *    conditions on future authoring, and the supersession trigger's substance.
 * 2. The tripwire: the future `cirrhosis-of-the-liver` → `sarcopenia` window is
 *    NOT yet authored, and the direct edge is still the only suggestion
 *    targeting `sarcopenia`. Both go stale the moment the graph moves, which is
 *    exactly when the record must be superseded (with this test updated in the
 *    same change — the dated-snapshot discipline of the CRG triage packet).
 * 3. The audit's live verdict contains no finding naming these conditions, so
 *    the claimed direct-versus-chain conflict is not live, and the redundancy
 *    count still sits on its pinned baseline.
 */

const RECORD =
  "docs/cirrhosis-of-the-liver-sarcopenia-redundancy-adjudication-2026-disposition.md";
const KB_DIR = "data/knowledge-base";

const read = (relativePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

/** The tripwire walker is the harness's collector, so the two cannot drift. */
function collectSuggestionTargets() {
  return collectKbSuggestions(path.join(process.cwd(), KB_DIR));
}

type AuditReport = {
  status: string;
  counts: { redundancyConflicts: number };
  reviewDebt: { redundancyBaseline: number };
  redundancy: Array<{ direct: string; chain: string }>;
};

function liveAuditReport(): AuditReport {
  const output = execFileSync(process.execPath, ["scripts/audit-crg-graph.js"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  return JSON.parse(output) as AuditReport;
}

describe("cirrhosis-of-the-liver → sarcopenia redundancy adjudication", () => {
  it("records the determination, prospective classification, conditions and supersession trigger", () => {
    const record = read(RECORD);

    expect(record).toContain(
      "Cirrhosis-of-the-liver → sarcopenia redundancy adjudication",
    );
    expect(record).toContain("Coexist");
    expect(record).toContain("cannot compose");
    expect(record).toContain("`liver-cancer` → `cirrhosis-of-the-liver`");
    expect(record).toContain("relationship row exists in either orientation");
    // Conditions on any future authoring: own anchors, no reuse of the direct edge's.
    expect(record).toContain("PMID 37274463");
    expect(record).toContain("reuse none of the direct edge's");
    // Read-only scope: nothing moves, the pin stays.
    expect(record).toContain("`CRG_REDUNDANCY_BASELINE` stays 29");
    expect(record).toContain("Supersession trigger");
  });

  it("keeps the record's tripwires honest: the future window is not yet authored", () => {
    const suggestions = collectSuggestionTargets();

    // Exactly one mapping targets sarcopenia today: the direct edge. When the future
    // cirrhosis window lands, this fails and the record must be superseded.
    const intoSarcopenia = suggestions.filter(
      (suggestion) => suggestion.targetId === "sarcopenia",
    );
    expect(intoSarcopenia).toEqual([{ sourceId: "liver-cancer", targetId: "sarcopenia" }]);
    expect(
      suggestions.some(
        (suggestion) =>
          suggestion.sourceId === "cirrhosis-of-the-liver" &&
          suggestion.targetId === "sarcopenia",
      ),
    ).toBe(false);
  });

  it("pins the adjudication to the audit's live verdict: no such conflict is live", () => {
    const report = liveAuditReport();

    expect(report.status).toBe("REVIEW");
    expect(report.counts.redundancyConflicts).toBe(report.reviewDebt.redundancyBaseline);
    for (const finding of report.redundancy) {
      for (const edge of [finding.direct, finding.chain]) {
        expect(edge).not.toContain("sarcopenia");
        expect(edge).not.toContain("cirrhosis-of-the-liver");
        expect(edge).not.toContain("liver-cancer");
      }
    }
  });

  it("is registered in the shared adjudication-packet harness", () => {
    expect(ADJUDICATION_PACKETS.some((spec) => spec.packetPath === RECORD)).toBe(true);
  });
});
