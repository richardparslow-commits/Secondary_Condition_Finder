import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import {
  collectTriageRows,
  renderTriageMarkdown,
} from "../scripts/report-crg-triage";

/**
 * CRG triage generator contract (`scripts/report-crg-triage.js`,
 * `npm run crg:triage`).
 *
 * The 2026-10-04 triage packet
 * (`docs/crg-redundancy-triage-2026-10-04.md`) transcribed its register and
 * posture tables by hand. This suite makes the generator the source of truth
 * for everything machine-derivable and proves it reproduces that packet:
 *
 * 1. One `R-nn` row per live conflict, in the audit's enumeration order, with
 *    the audit's exact `direct`/`chain` strings.
 * 2. Every register row's three edge slots (direct, chain hop 1, chain hop 2,
 *    derived from the row's own `direct`/`chain` strings) resolve to a
 *    published, like-oriented registry row with matching posture (rank, guard
 *    token, guard status, pending structured-guard review, source-reference
 *    count) — 29 x 3 slots checked, not a subset.
 * 3. The emitted artifact is pinned row by row: the CLI's rendered register and
 *    posture tables and its `--json` register rows must carry exactly the
 *    master registry's rank / guard / source-count facts for each register
 *    row's three edges, so a rendering or projection drift cannot hide behind
 *    the in-memory rows.
 * 4. The generator's output reproduces the 2026-10-04 packet's register
 *    identities and posture cells exactly, so future packets can be produced
 *    rather than transcribed.
 * 5. Hard failures instead of silent omissions: a truncated audit or an
 *    unresolvable slot throws rather than emitting an incomplete register.
 * 6. The CLI emits the skeleton (stdout, `--json`, `--out`) and the generator
 *    is wired into package.json metadata, the README snapshot-generator table,
 *    and the packet's provenance.
 */

const GENERATOR = "scripts/report-crg-triage.js";
const TRIAGE = "docs/crg-redundancy-triage-2026-10-04.md";
const README = "README.md";
const PACKAGE = "package.json";
const REGISTRY = "data/evidence/master-relationships.json";
const EXPECTED_FINDINGS = 29;

type AuditReport = {
  status: string;
  counts: {
    nodes: number;
    edges: number;
    publishedEdges: number;
    redundancyConflicts: number;
  };
  reviewDebt: {
    reviewClassCount: number;
    reviewBaseline: number;
    redundancyConflicts: number;
    redundancyBaseline: number;
  };
  redundancy: Array<{ direct: string; chain: string }>;
  truncated: { cycles: boolean; redundancy: boolean };
};

type RegistryRow = {
  relationshipId: string;
  primaryId: string;
  targetId: string;
  primaryPublicationState: string;
  rank: number;
  sourceReferenceCount: number;
  publicationGuard: { status: string; structuredGuardReviewPending: boolean };
};

type Slot = {
  edge: string;
  relationshipId: string;
  rank: number;
  guard: string;
  guardStatus: string;
  structuredGuardReviewPending: boolean;
  sources: number;
  publicationState: string;
};

type TriageRow = { id: string; direct: string; chain: string; slots: Slot[] };

const read = (relativePath: string): string =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * The shipped audit CLI is the generator's named upstream, so the contract
 * exercises it rather than re-deriving its analysis.
 */
function liveAuditReport(): AuditReport {
  const output = execFileSync(process.execPath, ["scripts/audit-crg-graph.js"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  return JSON.parse(output) as AuditReport;
}

function liveRows(report: AuditReport): TriageRow[] {
  const registry = JSON.parse(read(REGISTRY)) as { relationships: RegistryRow[] };
  return collectTriageRows(report, registry.relationships) as TriageRow[];
}

/** Parse the packet's register rows: ID / direct / chain, review columns after. */
const ROW_PATTERN =
  /^\|\s*(R-\d{2})\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|/gm;
/** Parse the packet's posture rows: three `rank N / guard / N` cells. */
const POSTURE_ROW_PATTERN =
  /^\|\s*(R-\d{2})\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/gm;

const tempDirs: string[] = [];
afterAll(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("CRG triage generator", () => {
  const report = liveAuditReport();
  const rows = liveRows(report);

  it("generates one R-nn row per live conflict, in audit order, with exact strings", () => {
    expect(report.truncated.redundancy).toBe(false);
    expect(report.redundancy).toHaveLength(EXPECTED_FINDINGS);
    expect(rows).toHaveLength(EXPECTED_FINDINGS);

    expect(rows.map((row) => [row.direct, row.chain])).toEqual(
      report.redundancy.map((finding) => [finding.direct, finding.chain]),
    );
    expect(rows.map((row) => row.id)).toEqual(
      Array.from(
        { length: EXPECTED_FINDINGS },
        (_, index) => `R-${String(index + 1).padStart(2, "0")}`,
      ),
    );
  });

  it("pins every register row's three edges to published, like-oriented registry rows with matching posture", () => {
    const registry = JSON.parse(read(REGISTRY)) as { relationships: RegistryRow[] };
    const byRelationshipId = new Map(
      registry.relationships.map((row) => [row.relationshipId, row]),
    );

    let slotsChecked = 0;
    for (const row of rows) {
      const hops = row.chain.split("->");
      expect(hops, `${row.id} chain is not a two-hop path: ${row.chain}`).toHaveLength(3);
      // Derive the three edges from the register row's own strings, so the
      // registry lookup does not depend on the generator's slot construction.
      const edges = [row.direct, `${hops[0]}->${hops[1]}`, `${hops[1]}->${hops[2]}`];
      expect(row.slots, `${row.id} does not resolve three slots`).toHaveLength(3);

      for (const [index, edge] of edges.entries()) {
        const slot = row.slots[index]!;
        const relationshipId = `rel-${edge.split("->").join("-to-")}`;
        const registryRow = byRelationshipId.get(relationshipId);
        expect(
          registryRow,
          `${row.id} slot ${index + 1} cites ${relationshipId}, absent from ${REGISTRY}`,
        ).toBeDefined();
        if (!registryRow) continue;

        // The slot must describe the edge the register row names, resolve to a
        // like-oriented published row, and carry the registry's posture facts.
        expect(slot.edge).toBe(edge);
        expect(slot.relationshipId).toBe(relationshipId);
        expect(`${registryRow.primaryId}->${registryRow.targetId}`).toBe(edge);
        expect(slot.publicationState).toBe("published");
        expect(slot.rank).toBe(registryRow.rank);
        expect(slot.guardStatus).toBe(registryRow.publicationGuard.status);
        expect(slot.guard).toBe(
          registryRow.publicationGuard.status === "legacy-rationale-boundary"
            ? "legacy"
            : registryRow.publicationGuard.status,
        );
        expect(slot.structuredGuardReviewPending).toBe(
          registryRow.publicationGuard.structuredGuardReviewPending,
        );
        expect(slot.sources).toBe(registryRow.sourceReferenceCount);
        slotsChecked += 1;
      }
    }
    expect(slotsChecked).toBe(EXPECTED_FINDINGS * 3);
  });

  it("pins each emitted register row's rank, guard status and source counts against the master registry", () => {
    const stdout = execFileSync(process.execPath, [GENERATOR], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    const machine = JSON.parse(
      execFileSync(process.execPath, [GENERATOR, "--json"], {
        cwd: process.cwd(),
        encoding: "utf8",
      }),
    ) as { register: Array<{ id: string; direct: string; chain: string; slots: Slot[] }> };

    const registry = JSON.parse(read(REGISTRY)) as { relationships: RegistryRow[] };
    const byRelationshipId = new Map(
      registry.relationships.map((row) => [row.relationshipId, row]),
    );

    const slotLabels = ["direct", "chain hop 1", "chain hop 2"] as const;

    /** Resolve one edge named by the emitted register row, failing with its ID. */
    const resolve = (id: string, label: string, edge: string): RegistryRow => {
      const relationshipId = `rel-${edge.split("->").join("-to-")}`;
      const registryRow = byRelationshipId.get(relationshipId);
      expect(
        registryRow,
        `${id} ${label} cites ${relationshipId}, which is absent from ${REGISTRY}`,
      ).toBeDefined();
      if (!registryRow) throw new Error(`${id} ${label}: ${relationshipId} unresolved`);
      expect(
        `${registryRow.primaryId}->${registryRow.targetId}`,
        `${id} ${label} resolves to a differently oriented registry row`,
      ).toBe(edge);
      expect(registryRow.primaryPublicationState, `${id} ${label} is not published`).toBe(
        "published",
      );
      const token =
        registryRow.publicationGuard.status === "legacy-rationale-boundary"
          ? "legacy"
          : registryRow.publicationGuard.status;
      expect(
        ["legacy", "explicit"],
        `${id} ${label} guard status "${registryRow.publicationGuard.status}" is outside the packet vocabulary`,
      ).toContain(token);
      return registryRow;
    };

    /** The register row's three edges, derived from its own strings. */
    const edgesOf = (id: string, direct: string, chain: string): string[] => {
      const hops = chain.split("->");
      expect(hops, `${id} chain is not a two-hop path: ${chain}`).toHaveLength(3);
      return [direct, `${hops[0]}->${hops[1]}`, `${hops[1]}->${hops[2]}`];
    };

    // (a) The rendered register and posture tables. Each register row's three
    // posture cells must state the registry's own facts for that row's edges.
    const renderedRows = [...stdout.matchAll(ROW_PATTERN)].map((match) => ({
      id: match[1]!,
      direct: match[2]!,
      chain: match[3]!,
    }));
    const renderedPosture = new Map(
      [...stdout.matchAll(POSTURE_ROW_PATTERN)].map((match) => [
        match[1]!,
        [match[2]!.trim(), match[3]!.trim(), match[4]!.trim()],
      ]),
    );
    expect(renderedRows.map((row) => row.id)).toEqual(rows.map((row) => row.id));
    expect([...renderedPosture.keys()]).toEqual(rows.map((row) => row.id));

    let renderedSlots = 0;
    for (const rendered of renderedRows) {
      const cells = renderedPosture.get(rendered.id)!;
      for (const [index, edge] of edgesOf(
        rendered.id,
        rendered.direct,
        rendered.chain,
      ).entries()) {
        const registryRow = resolve(rendered.id, slotLabels[index]!, edge);
        const token =
          registryRow.publicationGuard.status === "legacy-rationale-boundary"
            ? "legacy"
            : registryRow.publicationGuard.status;
        expect(
          cells[index],
          `${rendered.id} ${slotLabels[index]} posture cell does not state the registry's facts`,
        ).toBe(`rank ${registryRow.rank} / ${token} / ${registryRow.sourceReferenceCount}`);
        renderedSlots += 1;
      }
    }
    expect(renderedSlots).toBe(EXPECTED_FINDINGS * 3);

    // (b) The machine register rows (`--json`): the same registry facts pinned
    // per register row, so the machine form cannot drift from the rendering.
    expect(machine.register.map((row) => row.id)).toEqual(rows.map((row) => row.id));

    let machineSlots = 0;
    for (const row of machine.register) {
      expect(row.slots, `${row.id} does not carry three slots`).toHaveLength(3);
      for (const [index, edge] of edgesOf(row.id, row.direct, row.chain).entries()) {
        const slot = row.slots[index]!;
        const registryRow = resolve(row.id, slotLabels[index]!, edge);
        expect(slot.edge, `${row.id} ${slotLabels[index]} edge drifted`).toBe(edge);
        expect(slot.relationshipId).toBe(`rel-${edge.split("->").join("-to-")}`);
        expect(slot.publicationState).toBe("published");
        expect(slot.rank).toBe(registryRow.rank);
        expect(slot.guardStatus).toBe(registryRow.publicationGuard.status);
        expect(slot.guard).toBe(
          registryRow.publicationGuard.status === "legacy-rationale-boundary"
            ? "legacy"
            : registryRow.publicationGuard.status,
        );
        expect(slot.structuredGuardReviewPending).toBe(
          registryRow.publicationGuard.structuredGuardReviewPending,
        );
        expect(slot.sources).toBe(registryRow.sourceReferenceCount);
        machineSlots += 1;
      }
    }
    expect(machineSlots).toBe(EXPECTED_FINDINGS * 3);
  });

  it("reproduces the 2026-10-04 packet's register and posture tables exactly", () => {
    const doc = read(TRIAGE);
    const docRows = [...doc.matchAll(ROW_PATTERN)].map((match) => ({
      id: match[1]!,
      direct: match[2]!,
      chain: match[3]!,
    }));
    const docPosture = [...doc.matchAll(POSTURE_ROW_PATTERN)].map((match) => ({
      id: match[1]!,
      cells: [match[2]!.trim(), match[3]!.trim(), match[4]!.trim()],
    }));

    const generated = rows.map((row) => ({
      id: row.id,
      direct: row.direct,
      chain: row.chain,
    }));
    expect(generated).toEqual(docRows);

    expect(docPosture.map((entry) => entry.id)).toEqual(rows.map((row) => row.id));
    const generatedPosture = rows.map((row) => ({
      id: row.id,
      cells: row.slots.map((slot) => `rank ${slot.rank} / ${slot.guard} / ${slot.sources}`),
    }));
    expect(generatedPosture).toEqual(docPosture);

    // The packet names its generator as the provenance surface.
    expect(doc).toContain("npm run crg:triage");
    expect(doc).toContain(GENERATOR);
  });

  it("emits a markdown skeleton with live ratchet context and review-layer placeholders", () => {
    const markdown = renderTriageMarkdown({ report, rows });

    expect(markdown).toContain("# CRG transitive-redundancy triage — generated register");
    expect(markdown).toContain("## The finding register");
    expect(markdown).toContain("## Posture facts by edge slot");
    expect(markdown).toContain("| ID | Direct | Chain | Class | Unit | Candidate disposition |");
    expect(markdown).toContain("| R-01 |");
    expect(markdown).toContain("—");
    // Live ratchet context comes from the audit, not a hardcoded string.
    expect(markdown).toContain(
      `redundancy conflicts ${report.reviewDebt.redundancyConflicts} / baseline ${report.reviewDebt.redundancyBaseline}`,
    );
    expect(markdown).toContain(`graph nodes ${report.counts.nodes}, edges ${report.counts.edges}`);
    expect(markdown).toContain("Never raise a pin to make CI green.");
    expect(markdown).toContain("qualified human");
  });

  it("fails loudly instead of emitting an incomplete register", () => {
    expect(() =>
      collectTriageRows({ redundancy: [], truncated: { redundancy: true } }, []),
    ).toThrow(/truncated/);

    expect(() =>
      collectTriageRows(
        { redundancy: [{ direct: "a->c", chain: "a->b->c" }], truncated: { redundancy: false } },
        [],
      ),
    ).toThrow(/absent from/);
  });

  it("runs the CLI to stdout, as --json, and with --out writing identical content", () => {
    const stdout = execFileSync(process.execPath, [GENERATOR], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(stdout).toContain("## The finding register");
    expect(stdout).toContain("| R-01 |");
    expect(stdout).toContain(`| R-${String(EXPECTED_FINDINGS).padStart(2, "0")} |`);

    const machine = JSON.parse(
      execFileSync(process.execPath, [GENERATOR, "--json"], {
        cwd: process.cwd(),
        encoding: "utf8",
      }),
    ) as { status: string; register: TriageRow[] };
    expect(machine.status).toBe("REVIEW");
    expect(machine.register).toHaveLength(EXPECTED_FINDINGS);
    expect(machine.register.every((row) => row.slots.length === 3)).toBe(true);

    const dir = mkdtempSync(join(os.tmpdir(), "crg-triage-"));
    tempDirs.push(dir);
    const outPath = join(dir, "triage.md");
    execFileSync(process.execPath, [GENERATOR, "--out", outPath], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(readFileSync(outPath, "utf8")).toBe(stdout);
  });

  it("is wired into the npm scripts, the README generator table, and the packet", () => {
    const pkg = JSON.parse(read(PACKAGE)) as {
      scripts: Record<string, string>;
      snapshotGenerators: Record<string, string>;
    };
    expect(pkg.scripts["crg:triage"]).toContain(GENERATOR);
    expect(pkg.snapshotGenerators["crg:triage"]).toBe(
      "CRG transitive-redundancy triage register and posture tables",
    );
    expect(read(README)).toContain("`npm run crg:triage`");
  });
});
