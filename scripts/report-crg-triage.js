#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * CRG transitive-redundancy triage generator (npm run crg:triage).
 *
 * `npm run audit:crg` itemizes the standing transitive-redundancy backlog (a
 * published direct edge coexisting with a fully published authored chain) and
 * `data/evidence/master-relationships.json` carries each edge's posture. The
 * 2026-10-04 triage packet transcribed both by hand — the register's `R-nn`
 * rows, the exact `direct`/`chain` strings and every `rank / guard / sources`
 * posture cell. Hand transcription is exactly the drift this generator
 * removes: the review layer (classification, review units, candidate
 * dispositions and unit notes) is judgment and stays with the qualified human,
 * but everything machine-derivable is emitted here from live sources.
 *
 * Data flow, single code path:
 *
 *   buildReport()  (scripts/audit-crg-graph.js — the same analysis
 *                   `npm run audit:crg` ships, no re-implementation)
 *        |
 *        +-- report.redundancy[]  -> R-nn rows, audit enumeration order
 *        |
 *   data/evidence/master-relationships.json
 *        +-- rel-<from>-to-<to>   -> rank / guard / source count per slot
 *
 * Usage:
 *   node scripts/report-crg-triage.js                 # markdown to stdout
 *   node scripts/report-crg-triage.js --json          # machine form
 *   node scripts/report-crg-triage.js --out <path>    # write instead of print
 *
 * The generated register leaves `Class`, `Unit` and `Candidate disposition`
 * as `—` review-layer columns; a packet author fills them and adds unit notes.
 * Regeneration is read-only with respect to the corpus: no pin, edge, or
 * registry row is written.
 */

const fs = require("node:fs");
const path = require("node:path");

const {
  buildReport,
  CRG_REVIEW_BASELINE,
  CRG_REDUNDANCY_BASELINE,
} = require("./audit-crg-graph");

const REGISTRY_PATH = "data/evidence/master-relationships.json";
const PACKET_TEMPLATE = "docs/crg-redundancy-triage-<date>.md";

/** Read the posture authority (the relationship registry). */
function loadRelationships(root = process.cwd()) {
  const registry = JSON.parse(fs.readFileSync(path.join(root, REGISTRY_PATH), "utf8"));
  return registry.relationships || [];
}

/**
 * Collapse a registry PublicationGuard.status into the packet's posture
 * vocabulary: `legacy-rationale-boundary` renders as `legacy` (boundary text
 * preserved, structured guard review pending); everything else renders as its
 * status (`explicit`). A third status must extend this deliberately.
 */
function guardToken(row) {
  const status = row.publicationGuard && row.publicationGuard.status;
  return status === "legacy-rationale-boundary" ? "legacy" : status;
}

/** Split an audit chain (`A->B->C`) into its two hop edges. */
function chainHops(chain) {
  const nodes = chain.split("->");
  if (nodes.length !== 3) {
    throw new Error(`audit chain is not a two-hop path: "${chain}"`);
  }
  return [`${nodes[0]}->${nodes[1]}`, `${nodes[1]}->${nodes[2]}`];
}

/**
 * Build the triage rows: one `R-nn` per live redundancy conflict in audit
 * enumeration order, each resolved against three published, like-oriented
 * registry rows (direct, chain hop 1, chain hop 2). Any unresolved or
 * misoriented slot is a hard error — a register that silently dropped a
 * finding would be worse than a failed generation.
 */
function collectTriageRows(report, relationships) {
  if (report.truncated && report.truncated.redundancy) {
    throw new Error(
      "the audit's redundancy display list is truncated; the register cannot be complete. " +
        "Raise MAX_REPORTED_REDUNDANCY deliberately in scripts/audit-crg-graph.js or resolve the backlog first.",
    );
  }
  const byRelationshipId = new Map(
    relationships.map((row) => [row.relationshipId, row]),
  );
  return (report.redundancy || []).map((finding, index) => {
    const id = `R-${String(index + 1).padStart(2, "0")}`;
    const edges = [finding.direct, ...chainHops(finding.chain)];
    const slots = edges.map((edge) => {
      const relationshipId = `rel-${edge.split("->").join("-to-")}`;
      const row = byRelationshipId.get(relationshipId);
      if (!row) {
        throw new Error(`${id} cites ${relationshipId}, which is absent from ${REGISTRY_PATH}`);
      }
      if (`${row.primaryId}->${row.targetId}` !== edge) {
        throw new Error(
          `${id} cites ${edge}, which resolves to a differently oriented registry row ` +
            `(${row.relationshipId}: ${row.primaryId}->${row.targetId})`,
        );
      }
      return {
        edge,
        relationshipId,
        rank: row.rank,
        guard: guardToken(row),
        guardStatus: row.publicationGuard.status,
        structuredGuardReviewPending: row.publicationGuard.structuredGuardReviewPending === true,
        sources: row.sourceReferenceCount,
        publicationState: row.primaryPublicationState,
      };
    });
    return { id, direct: finding.direct, chain: finding.chain, slots };
  });
}

/** Render the review-layer matrix; Class/Unit/disposition stay for the human. */
function renderRegisterTable(rows) {
  return [
    "| ID | Direct | Chain | Class | Unit | Candidate disposition |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.id} | \`${row.direct}\` | \`${row.chain}\` | — | — | — |`),
  ].join("\n");
}

/** Render the posture facts table: three `rank / guard / sources` cells per row. */
function renderPostureTable(rows) {
  const cell = (slot) => `rank ${slot.rank} / ${slot.guard} / ${slot.sources}`;
  return [
    "| ID | Direct (A -> C) | Chain hop 1 (A -> B) | Chain hop 2 (B -> C) |",
    "| --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.id} | ${cell(row.slots[0])} | ${cell(row.slots[1])} | ${cell(row.slots[2])} |`,
    ),
  ].join("\n");
}

/**
 * Render the full packet skeleton: live ratchet context, the generated
 * register, the generated posture table, and the standing review guardrails.
 */
function renderTriageMarkdown({ report, rows }) {
  const debt = report.reviewDebt || {};
  const counts = report.counts || {};
  return [
    "# CRG transitive-redundancy triage — generated register",
    "",
    "**Status:** machine-generated skeleton — the review layer (classification, review units and candidate dispositions) is completed by a qualified human.",
    `**Provenance:** generated by \`npm run crg:triage\` (\`scripts/report-crg-triage.js\`) from \`npm run audit:crg\` (\`scripts/audit-crg-graph.js\`) and \`${REGISTRY_PATH}\`.`,
    `**Ratchet context:** audit verdict ${report.status}; redundancy conflicts ${counts.redundancyConflicts} / baseline ${debt.redundancyBaseline}; review-class findings ${debt.reviewClassCount} / baseline ${debt.reviewBaseline}; graph nodes ${counts.nodes}, edges ${counts.edges}, published edges ${counts.publishedEdges}.`,
    "",
    "## The finding register",
    "",
    "Rows follow the audit's enumeration order and are regenerated, never transcribed; `Class`, `Unit` and `Candidate disposition` are review layer.",
    "",
    renderRegisterTable(rows),
    "",
    "## Posture facts by edge slot",
    "",
    `One row per finding, three cells in direct-then-chain-hop order; each cell is \`rank / guard / sources\` resolved against \`${REGISTRY_PATH}\` (published, like-oriented rows). \`legacy\` means \`publicationGuard.status\` is \`legacy-rationale-boundary\` with \`structuredGuardReviewPending: true\`; \`explicit\` means a structured explicit guard.`,
    "",
    renderPostureTable(rows),
    "",
    "## Review guardrails",
    "",
    "- Read-only generator: it emits tables and changes no pin, edge, or registry row.",
    "- Every classification and disposition belongs to a qualified human; the generated IDs and posture cells are machine-checked, the judgment is not.",
    "- Never raise a pin to make CI green. When the backlog moves, supersede the dated packet rather than editing it in place.",
    `- Regenerate into a new dated packet: \`node scripts/report-crg-triage.js --out ${PACKET_TEMPLATE}\`.`,
    "",
  ].join("\n");
}

function machineOutput(report, rows) {
  return {
    status: report.status,
    counts: report.counts,
    reviewDebt: report.reviewDebt,
    register: rows,
  };
}

function parseArgs(argv) {
  const outIndex = argv.indexOf("--out");
  if (outIndex >= 0 && !argv[outIndex + 1]) {
    throw new Error("--out requires a file path");
  }
  return {
    json: argv.includes("--json"),
    outPath: outIndex >= 0 ? argv[outIndex + 1] : null,
  };
}

function main() {
  const { json, outPath } = parseArgs(process.argv.slice(2));
  const report = buildReport({ reviewBaseline: CRG_REVIEW_BASELINE, redundancyBaseline: CRG_REDUNDANCY_BASELINE });
  const rows = collectTriageRows(report, loadRelationships());
  const output = json
    ? `${JSON.stringify(machineOutput(report, rows), null, 2)}\n`
    : renderTriageMarkdown({ report, rows });

  if (outPath) {
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(outPath, output);
    return;
  }
  process.stdout.write(output);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(String(error instanceof Error ? error.message : error));
    process.exitCode = 1;
  }
}

module.exports = {
  collectTriageRows,
  guardToken,
  chainHops,
  loadRelationships,
  renderRegisterTable,
  renderPostureTable,
  renderTriageMarkdown,
  machineOutput,
  REGISTRY_PATH,
};
