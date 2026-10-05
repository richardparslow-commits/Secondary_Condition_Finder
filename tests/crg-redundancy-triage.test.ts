import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CRG_REDUNDANCY_BASELINE } from "../scripts/audit-crg-graph";

/**
 * CRG transitive-redundancy triage contract — regression guard for the
 * qualified-human adjudication packet (docs/crg-redundancy-triage-2026-10-04.md).
 *
 * The packet itemizes the audit's standing transitive-redundancy backlog
 * (a published direct edge coexisting with a fully published authored chain).
 * The backlog is a snapshot: it moves only when an edge is added, removed, or
 * unpublished — but the register, its classes, and its review units are
 * hand-written prose that could silently drift from the live audit. This suite
 * makes the packet contract executable:
 *
 * 1. Provenance — the packet names `npm run audit:crg`; the suite runs the
 *    shipped script and pins the verdict it was written against (REVIEW, 0
 *    violations, 29 conflicts, baseline 29). If a qualified human resolves a
 *    unit and lowers the pin, this fails deliberately: supersede the dated
 *    packet with a new one and update this contract in the same change.
 * 2. Bidirectional set equality — every live conflict must appear in the
 *    register as an R-nn row with the audit's exact `direct` and `chain`
 *    strings, and no register row may describe a conflict the audit no longer
 *    reports. One live conflict, one row.
 * 3. Unit collapsing — the packet's headline claim that 29 findings group into
 *    17 review units is checked structurally: unit IDs are contiguous
 *    U-01..U-17 and every unit covers at least one finding.
 * 4. Class census — the packet's "23 Coexist, 3 Bound and 3 Collinear" census
 *    must match the classes on its own rows, so a reclassification cannot
 *    leave the headline stale.
 * 5. Guardrails — the packet must keep its read-only adjudication framing:
 *    it changes no pin or edge, it belongs to a qualified human, and the
 *    never-raise-a-pin rule is stated.
 * 6. Posture facts — each row's three edge slots (direct, chain hop 1, chain
 *    hop 2) must carry rank / guard / source-count cells in the packet's
 *    posture table that match `data/evidence/master-relationships.json`: a
 *    like-oriented published row, the same rank, the same guard state, and
 *    the same source-reference count. Identity equality alone would let the
 *    packet describe an edge whose posture moved underneath it.
 */

const TRIAGE = "docs/crg-redundancy-triage-2026-10-04.md";
/** The posture authority behind the register's adjudicated edges. */
const REGISTRY = "data/evidence/master-relationships.json";
/** The batch-92 pin the packet was written against. */
const EXPECTED_FINDINGS = 29;
/** The review units the register collapses the findings into. */
const EXPECTED_UNITS = 17;

type AuditRedundancy = { direct: string; chain: string };
type AuditReport = {
  status: string;
  counts: { redundancyConflicts: number };
  reviewDebt: { redundancyConflicts: number; redundancyBaseline: number };
  violations: unknown[];
  redundancy: AuditRedundancy[];
};

type TriageRow = {
  id: string;
  direct: string;
  chain: string;
  klass: string;
  unit: string;
  disposition: string;
};

/**
 * The shipped audit CLI is the packet's named provenance surface, so the
 * contract exercises it rather than re-implementing its extraction.
 */
function liveAuditReport(): AuditReport {
  const output = execFileSync(
    process.execPath,
    ["scripts/audit-crg-graph.js"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  return JSON.parse(output) as AuditReport;
}

/**
 * Parse the register table rows. The first three cells (ID, direct, chain) are
 * the identity of a finding; class/unit/disposition follow. Rows are matched
 * line-anchored so prose backticked edge mentions never qualify.
 */
const ROW_PATTERN =
  /^\|\s*(R-\d{2})\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*(Coexist|Bound|Collinear)\s*\|\s*(U-\d{2})\s*\|\s*(.+?)\s*\|\s*$/gm;

function parseTriageRows(doc: string): TriageRow[] {
  return [...doc.matchAll(ROW_PATTERN)].map((match) => ({
    id: match[1]!,
    direct: match[2]!,
    chain: match[3]!,
    klass: match[4]!,
    unit: match[5]!,
    disposition: match[6]!,
  }));
}

type RegistryRow = {
  relationshipId: string;
  primaryId: string;
  targetId: string;
  primaryPublicationState: string;
  rank: number;
  sourceReferenceCount: number;
  publicationGuard: {
    status: string;
    structuredGuardReviewPending: boolean;
  };
};

type PostureClaim = { rank: number; guard: "legacy" | "explicit"; sources: number };
type PostureRow = { id: string; slots: PostureClaim[] };

/**
 * Parse the posture table rows: `| R-nn | rank N / guard / N | ... | ... |`.
 * The register table's six-cell `R-nn` rows cannot match (its second cell is
 * a backticked edge, not a posture cell), so the two tables stay separable.
 */
const POSTURE_ROW_PATTERN =
  /^\|\s*(R-\d{2})\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/gm;
const POSTURE_CELL_PATTERN = /^rank (\d+) \/ (legacy|explicit) \/ (\d+)$/;

function parsePostureRows(doc: string): PostureRow[] {
  return [...doc.matchAll(POSTURE_ROW_PATTERN)].map((match) => {
    const id = match[1]!;
    return {
      id,
      slots: [match[2]!, match[3]!, match[4]!].map((cell) => {
        const parsed = POSTURE_CELL_PATTERN.exec(cell);
        if (!parsed) {
          throw new Error(
            `posture table cell on ${id} is not "rank N / legacy|explicit / N": "${cell}"`,
          );
        }
        return {
          rank: Number(parsed[1]),
          guard: parsed[2] as "legacy" | "explicit",
          sources: Number(parsed[3]),
        };
      }),
    };
  });
}

const key = (finding: AuditRedundancy) => `${finding.direct} => ${finding.chain}`;

describe("CRG redundancy triage packet", () => {
  const doc = readFileSync(join(process.cwd(), TRIAGE), "utf8");
  const report = liveAuditReport();
  const live = report.redundancy;
  const rows = parseTriageRows(doc);

  it("was written against the shipped audit's current pinned verdict", () => {
    // REVIEW with no hard violations: the packet adjudicates a ratcheted
    // backlog, never a failing gate. If the audit FAILs, fix the audit
    // failure first; the packet cannot launder it.
    expect(report.status).toBe("REVIEW");
    expect(report.violations).toEqual([]);
    // The pin and the live count are both stated as 29 in the packet header.
    // When a qualified human resolves a unit, supersede the packet and move
    // this contract deliberately — never adjust it to absorb new debt.
    expect(CRG_REDUNDANCY_BASELINE).toBe(EXPECTED_FINDINGS);
    expect(report.reviewDebt.redundancyBaseline).toBe(EXPECTED_FINDINGS);
    expect(report.reviewDebt.redundancyConflicts).toBe(EXPECTED_FINDINGS);
    expect(report.counts.redundancyConflicts).toBe(EXPECTED_FINDINGS);
    // The display list must not be truncated below the backlog size, or the
    // register would be checked against an incomplete enumeration.
    expect(live).toHaveLength(EXPECTED_FINDINGS);
  });

  it("itemizes every live conflict exactly once, with no stale rows", () => {
    const liveKeys = live.map(key).sort();
    const rowKeys = rows.map((row) => key(row)).sort();

    const missing = liveKeys.filter((candidate) => !rowKeys.includes(candidate));
    const stale = rowKeys.filter((candidate) => !liveKeys.includes(candidate));

    expect(
      missing,
      `live conflicts missing from the register: ${missing.join("; ")}. ` +
        "Every live conflict must be itemized before it can be adjudicated.",
    ).toEqual([]);
    expect(
      stale,
      `register rows with no live conflict: ${stale.join("; ")}. ` +
        "The packet is a dated snapshot: supersede it rather than letting it describe a graph that moved.",
    ).toEqual([]);
    expect(rowKeys).toHaveLength(EXPECTED_FINDINGS);
  });

  it("collapses the findings into contiguous review units", () => {
    const ids = rows.map((row) => row.id);
    expect(new Set(ids).size, `duplicate R-nn IDs: ${ids.join(", ")}`).toBe(ids.length);
    expect(ids).toEqual(
      Array.from({ length: EXPECTED_FINDINGS }, (_, index) => `R-${String(index + 1).padStart(2, "0")}`),
    );

    const units = [...new Set(rows.map((row) => row.unit))].sort();
    expect(units).toEqual(
      Array.from({ length: EXPECTED_UNITS }, (_, index) => `U-${String(index + 1).padStart(2, "0")}`),
    );
    for (const unit of units) {
      expect(
        rows.some((row) => row.unit === unit),
        `${unit} has no findings`,
      ).toBe(true);
    }
    // The headline claim and the structure must agree.
    expect(doc).toContain("29 findings group into 17 review units");
  });

  it("keeps the class census consistent with its own register rows", () => {
    const census = { Coexist: 0, Bound: 0, Collinear: 0 };
    for (const row of rows) {
      census[row.klass as keyof typeof census] += 1;
    }
    expect(census).toEqual({ Coexist: 23, Bound: 3, Collinear: 3 });
    // The headline sentence must state the same census the rows carry.
    expect(doc).toContain("23 Coexist, 3 Bound and 3 Collinear");
  });

  it("pins every row's edge posture against the relationship registry", () => {
    const registry = JSON.parse(
      readFileSync(join(process.cwd(), REGISTRY), "utf8"),
    ) as { relationships: RegistryRow[] };
    const byRelationshipId = new Map(
      registry.relationships.map((row) => [row.relationshipId, row]),
    );

    const postureRows = parsePostureRows(doc);
    expect(
      postureRows.map((row) => row.id),
      "the posture table must carry one row per register row, in register order",
    ).toEqual(rows.map((row) => row.id));
    // The posture authority is named in the packet itself.
    expect(doc).toContain(REGISTRY);

    let slotsChecked = 0;
    for (const row of rows) {
      const posture = postureRows.find((candidate) => candidate.id === row.id)!;
      const hops = row.chain.split("->");
      expect(hops, `${row.id} chain is not a two-hop path: ${row.chain}`).toHaveLength(3);

      const slots = [
        { label: "direct", edge: row.direct },
        { label: "chain hop 1", edge: `${hops[0]}->${hops[1]}` },
        { label: "chain hop 2", edge: `${hops[1]}->${hops[2]}` },
      ];
      for (const [index, slot] of slots.entries()) {
        const claim = posture.slots[index]!;
        // The registry keys authored edges as `rel-<from>-to-<to>`.
        const relationshipId = `rel-${slot.edge.split("->").join("-to-")}`;
        const registryRow = byRelationshipId.get(relationshipId);

        expect(
          registryRow,
          `${row.id} ${slot.label} cites ${relationshipId}, which is absent from ${REGISTRY}`,
        ).toBeDefined();
        if (!registryRow) continue;

        // The register's edge string must resolve to a like-oriented row, not
        // a reverse edge that happens to share one endpoint.
        expect(
          `${registryRow.primaryId}->${registryRow.targetId}`,
          `${row.id} ${slot.label} (${slot.edge}) resolves to a differently oriented registry row`,
        ).toBe(slot.edge);
        // Every adjudicated edge is published; a row over an unpublished edge
        // would describe a graph state the audit never counted.
        expect(
          registryRow.primaryPublicationState,
          `${row.id} ${slot.label} (${slot.edge}) is not published`,
        ).toBe("published");

        expect(claim.rank, `${row.id} ${slot.label} rank drifted`).toBe(registryRow.rank);
        // `legacy` collapses `legacy-rationale-boundary` + pending structured
        // review; `explicit` collapses `explicit` + no pending review. A third
        // guard state must extend the packet vocabulary deliberately.
        expect(
          claim.guard,
          `${row.id} ${slot.label} guard token does not match registry status ${registryRow.publicationGuard.status}`,
        ).toBe(
          registryRow.publicationGuard.status === "legacy-rationale-boundary"
            ? "legacy"
            : registryRow.publicationGuard.status,
        );
        expect(
          registryRow.publicationGuard.structuredGuardReviewPending,
          `${row.id} ${slot.label} structuredGuardReviewPending disagrees with the "${claim.guard}" token`,
        ).toBe(claim.guard === "legacy");
        expect(
          claim.sources,
          `${row.id} ${slot.label} source-reference count drifted`,
        ).toBe(registryRow.sourceReferenceCount);

        slotsChecked += 1;
      }
    }
    // All 29 findings x 3 edge slots were checked, not a subset.
    expect(slotsChecked).toBe(EXPECTED_FINDINGS * 3);
  });

  it("gives every row a real candidate disposition", () => {
    const placeholders = /^(?:TBD|TODO|N\/A|placeholder|none)\b/i;
    for (const row of rows) {
      expect(
        row.disposition.length,
        `${row.id} has an empty candidate disposition`,
      ).toBeGreaterThanOrEqual(20);
      expect(
        placeholders.test(row.disposition),
        `${row.id} still carries a placeholder disposition: "${row.disposition}"`,
      ).toBe(false);
    }
  });

  it("keeps the read-only adjudication guardrails honest", () => {
    // The packet prepares the decision; it never makes one.
    expect(doc).toContain("read-only adjudication packet");
    expect(doc).toContain("This packet does not change any pin or edge");
    // The escalation rule survives verbatim.
    expect(doc).toContain("never raise a pin");
    // Decisions belong to a qualified human, and the pin and provenance
    // surfaces are named so the packet stays actionable.
    expect(doc).toContain("qualified human");
    expect(doc).toContain("CRG_REDUNDANCY_BASELINE");
    expect(doc).toContain("npm run audit:crg");
    // The register is machine-checked, and the packet says so.
    expect(doc).toContain("tests/crg-redundancy-triage.test.ts");
  });
});
