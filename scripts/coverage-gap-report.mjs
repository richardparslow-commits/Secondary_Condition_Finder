#!/usr/bin/env node
/**
 * Report — and persist — the coverage-gap ranking for the identities that carry
 * no authored secondary-condition mappings at all.
 *
 *   npm run coverage:gaps            # refresh docs/coverage-gap-report-<date>.{json,md}
 *
 * `docs/mapping-coverage.md` answers "how much of the catalog is mapped". This
 * answers the next question a reviewer asks: of the identities that are still
 * blank, which ones are being asked for, and how thin is the coverage they
 * already have from other primaries?
 *
 * Two measured axes, deliberately not the same metric:
 *
 * - `requestedAsSecondary` — how often the identity is named as the SECONDARY
 *   condition in an authored CRG request packet under `docs/`. That is demand
 *   recorded by a human, not inferred from the KB it is supposed to inform.
 * - `inboundEdges` — how many authored relationships in `data/knowledge-base`
 *   already name the identity as a secondary. That is existing coverage.
 *
 * A blank identity with high demand and low inbound coverage is the top of the
 * list: the repository is already pointing at it and cannot grow from it.
 *
 * Counts here are generated rather than transcribed; the universe is read from
 * the same `scripts/lib/kb-coverage.js` definition the ledger and the validator
 * use, so the 245 cannot drift from `docs/mapping-coverage-ledger.json`.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import kbCoverage from "./lib/kb-coverage.js";

const { computeMappingCoverage } = kbCoverage;

const ROOT = process.cwd();
const REPORT_ID = "coverage-gap-report-2026-10-06";
const JSON_PATH = `docs/${REPORT_ID}.json`;
const MD_PATH = `docs/${REPORT_ID}.md`;

const CATALOG_DIR = "data/conditions";
const KNOWLEDGE_BASE_DIR = "data/knowledge-base";
const GRAPH_DIR = "data/knowledge-base/graph";

const readJson = (file) => JSON.parse(readFileSync(join(ROOT, file), "utf8"));

/**
 * Desktop-sync fork copies ("tinnitus 2.json") are byte-identical siblings that
 * are untracked and would otherwise double-count every edge twice. They are not
 * repository data, and tests/checkout-fork-hygiene.test.ts fails the build when
 * one appears, so a reader that silently counted them would inflate coverage.
 */
const SYNC_FORK = /(^|\/)[^/]* \d+(\.[^/]*)?$/;
const readDir = (dir) =>
  readdirSync(join(ROOT, dir)).filter(
    (name) => name.endsWith(".json") && !SYNC_FORK.test(name),
  );

/* ─── catalog: identity ↔ name/alias ──────────────────────────────────────── */

const catalog = new Map();
const nameIndex = new Map();

const normalize = (text) =>
  String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ");

for (const file of readDir(CATALOG_DIR)) {
  for (const condition of readJson(`${CATALOG_DIR}/${file}`).conditions ?? []) {
    catalog.set(condition.id, condition);
    for (const key of [condition.name, condition.id, ...(condition.aliases ?? [])]) {
      if (!key) continue;
      const normalized = normalize(key);
      if (!nameIndex.has(normalized)) nameIndex.set(normalized, condition.id);
    }
  }
}

const byNameLength = [...nameIndex.keys()].sort((a, b) => b.length - a.length);

/**
 * Authored packets name the secondary condition in prose — "Acquired flatfoot
 * (pes planus with hindfoot valgus) due to rheumatoid arthritis" — so exact
 * lookup is not enough. Candidate keys are the phrase itself, the phrase without
 * parentheticals, each parenthetical on its own, and the phrase truncated before
 * its qualifying clause. A key resolves when it equals a catalog name/alias or
 * contains one on a word boundary; the longest catalog name wins.
 */
function candidateKeys(text) {
  const base = normalize(text);
  const keys = new Set([base]);
  const withoutParens = base.replace(/\s*\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (withoutParens) keys.add(withoutParens);
  for (const match of base.matchAll(/\(([^)]*)\)/g)) {
    const inner = match[1].trim();
    if (inner) keys.add(inner);
  }
  const clause =
    /\b(due to|associated with|complicated by|complicating|secondary to|following|after|from|aggravated by|in a veteran with|with|and)\b/;
  for (const key of [...keys]) {
    const match = key.match(clause);
    if (match && match.index > 0) keys.add(key.slice(0, match.index).trim());
  }
  return [...keys].filter(Boolean);
}

function resolveSecondaryName(text) {
  const keys = candidateKeys(text);
  for (const key of keys) if (nameIndex.has(key)) return { id: nameIndex.get(key), via: "exact" };
  for (const key of keys) {
    for (const name of byNameLength) {
      if (name.length < 8) continue;
      const padded = ` ${key} `;
      const needle = ` ${name} `;
      if (padded.includes(needle)) return { id: nameIndex.get(name), via: `contained:${name}` };
    }
  }
  return null;
}

/* ─── knowledge base: inbound edges, publication state ────────────────────── */

const inboundEdges = new Map();
const outboundEdges = new Map();
const draftFlag = new Map();
const kbFileIds = new Set();

for (const file of readDir(KNOWLEDGE_BASE_DIR)) {
  const entry = readJson(`${KNOWLEDGE_BASE_DIR}/${file}`);
  if (!entry.id) continue;
  kbFileIds.add(entry.id);
  draftFlag.set(entry.id, entry.draft === true);
  const suggestions = entry.suggestions ?? [];
  outboundEdges.set(entry.id, suggestions.length);
  for (const suggestion of suggestions) {
    if (!suggestion.conditionId) continue;
    inboundEdges.set(suggestion.conditionId, (inboundEdges.get(suggestion.conditionId) ?? 0) + 1);
  }
}

const graphInboundEdges = new Map();
let graphNodes = 0;
try {
  for (const file of readDir(GRAPH_DIR)) {
    const node = readJson(`${GRAPH_DIR}/${file}`);
    if (!node.nodeId) continue;
    graphNodes += 1;
    for (const edge of node.outgoingEdges ?? []) {
      graphInboundEdges.set(
        edge.targetConditionId,
        (graphInboundEdges.get(edge.targetConditionId) ?? 0) + 1,
      );
    }
  }
} catch {
  // The adjacency store is optional at report time; absent means zero, not an error.
}

/* ─── demand corpus: authored CRG request packets under docs/ ─────────────── */

const { execFileSync } = await import("node:child_process");
/**
 * Source packets only. `docs/crg-staging-2026-10-06/` is a compiled projection of
 * the wave packets (every staged proposal cites the packet and row it came from),
 * so counting it alongside its inputs would record the same request twice.
 */
const trackedDocs = execFileSync("git", ["ls-files", "docs"], { cwd: ROOT, encoding: "utf8" })
  .trim()
  .split("\n")
  .filter((line) => /^docs\/crg.*\.json$/.test(line))
  .filter((line) => !line.startsWith("docs/crg-staging-2026-10-06/"));

const requestedAsSecondary = new Map();
const requestFilesBy = new Map();
const unresolvedNames = [];
let requestRows = 0;

for (const file of trackedDocs) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(join(ROOT, file), "utf8"));
  } catch {
    continue;
  }
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed.rows ?? parsed.proposals ?? parsed.mappings ?? [];
  if (!Array.isArray(rows)) continue;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const named =
      row.secondaryCondition ??
      row.secondaryConditionName ??
      row.targetCondition ??
      row.secondaryId ??
      row.secondary ??
      null;
    if (!named) continue;
    requestRows += 1;
    const resolved = resolveSecondaryName(named);
    if (!resolved) {
      unresolvedNames.push({ file, named });
      continue;
    }
    requestedAsSecondary.set(
      resolved.id,
      (requestedAsSecondary.get(resolved.id) ?? 0) + 1,
    );
    if (!requestFilesBy.has(resolved.id)) requestFilesBy.set(resolved.id, new Set());
    requestFilesBy.get(resolved.id).add(file);
  }
}

/* ─── the universe: identities with no authored mappings ──────────────────── */

const coverage = computeMappingCoverage(ROOT);
const blanks = [...coverage.withoutSuggestionsIds].sort();

const rows = blanks.map((id) => {
  const requested = requestedAsSecondary.get(id) ?? 0;
  const inbound = inboundEdges.get(id) ?? 0;
  const condition = catalog.get(id);
  return {
    id,
    name: condition?.name ?? id,
    bodySystem: condition?.bodySystem ?? "Unassigned",
    requestedAsSecondary: requested,
    requestFiles: [...(requestFilesBy.get(id) ?? [])].sort(),
    inboundEdges: inbound,
    graphInboundEdges: graphInboundEdges.get(id) ?? 0,
    gapScore: Number(((1 + requested) / (1 + inbound)).toFixed(4)),
  };
});

rows.sort((a, b) => {
  if (b.gapScore !== a.gapScore) return b.gapScore - a.gapScore;
  if (b.requestedAsSecondary !== a.requestedAsSecondary)
    return b.requestedAsSecondary - a.requestedAsSecondary;
  return a.id.localeCompare(b.id);
});
rows.forEach((row, index) => {
  row.rank = index + 1;
});

/* ─── rollups ─────────────────────────────────────────────────────────────── */

const bodySystems = [];
{
  const bySystem = new Map();
  for (const row of rows) {
    const system = bySystem.get(row.bodySystem) ?? {
      bodySystem: row.bodySystem,
      blankIdentities: 0,
      requestedAsSecondary: 0,
      inboundEdges: 0,
      zeroInbound: 0,
    };
    system.blankIdentities += 1;
    system.requestedAsSecondary += row.requestedAsSecondary;
    system.inboundEdges += row.inboundEdges;
    if (row.inboundEdges === 0) system.zeroInbound += 1;
    bySystem.set(row.bodySystem, system);
  }
  bodySystems.push(
    ...[...bySystem.values()].sort((a, b) =>
      b.blankIdentities - a.blankIdentities || a.bodySystem.localeCompare(b.bodySystem),
    ),
  );
}

const isTied = (row) => row.requestedAsSecondary === 0 && row.inboundEdges === 0;
const tieStart = rows.findIndex(isTied);
let tieEnd = tieStart;
while (tieEnd >= 0 && tieEnd + 1 < rows.length && isTied(rows[tieEnd + 1])) tieEnd += 1;

const summary = {
  blankIdentities: rows.length,
  withRecordedDemand: rows.filter((row) => row.requestedAsSecondary > 0).length,
  noDemandAndNoInbound: rows.filter(isTied).length,
  noDemandAndNoInboundBlock:
    tieStart === -1
      ? null
      : { firstRank: rows[tieStart].rank, lastRank: rows[tieEnd].rank },
  noDemandAndNoInboundContiguous:
    tieStart !== -1 && tieEnd - tieStart + 1 === rows.filter(isTied).length,
  withInboundCoverage: rows.filter((row) => row.inboundEdges > 0).length,
  withNoInboundCoverage: rows.filter((row) => row.inboundEdges === 0).length,
  withGraphInboundCoverage: rows.filter((row) => row.graphInboundEdges > 0).length,
  maxInboundEdges: rows.reduce((max, row) => Math.max(max, row.inboundEdges), 0),
  requestRowsScanned: requestRows,
  requestFilesScanned: trackedDocs.length,
  unresolvedRequestNames: unresolvedNames.length,
  distinctRequestedSecondaries: requestedAsSecondary.size,
  publishedIdentitiesWithMappings: coverage.published,
  draftIdentitiesWithMappings: coverage.draft,
  suggestionEdges: coverage.suggestionEdges,
  catalogIdentities: coverage.catalogIdentities,
};

const report = {
  version: 1,
  generatedBy: "npm run coverage:gaps",
  description:
    "The identities with no authored secondary-condition mappings at all, ranked by recorded " +
    "demand as a secondary condition against the inbound coverage they already have. " +
    "'requestedAsSecondary' counts authored CRG request rows under docs/ that name the identity " +
    "as the secondary; 'inboundEdges' counts authored relationships in data/knowledge-base that " +
    "already name it as a secondary. gapScore = (1 + requestedAsSecondary) / (1 + inboundEdges).",
  universe:
    "scripts/lib/kb-coverage.js computeMappingCoverage().withoutSuggestionsIds, the same " +
    "definition docs/mapping-coverage-ledger.json and the validator report",
  summary,
  bodySystems,
  rows,
  unresolvedRequestNames: unresolvedNames,};

writeFileSync(join(ROOT, JSON_PATH), `${JSON.stringify(report, null, 2)}\n`);

/* ─── markdown ────────────────────────────────────────────────────────────── */

const pct = (part, whole) => `${((part / whole) * 100).toFixed(1)}%`;
const cell = (text) => String(text).replace(/\|/g, "\\|");

const requestedRows = rows
  .filter((row) => row.requestedAsSecondary > 0)
  .sort(
    (a, b) =>
      b.requestedAsSecondary - a.requestedAsSecondary ||
      a.inboundEdges - b.inboundEdges ||
      a.id.localeCompare(b.id),
  );

const md = [];

md.push(`# Coverage gap report — the ${summary.blankIdentities} identities with no authored mappings`);
md.push("");
md.push(
  "Generated by `npm run coverage:gaps` (`scripts/coverage-gap-report.mjs`) from `data/conditions`,",
  "`data/knowledge-base`, `data/knowledge-base/graph`, and the authored CRG request packets under",
  "`docs/`. Machine-readable companion: `docs/" + REPORT_ID + ".json`.",
);
md.push("");
md.push("## What is measured");
md.push("");
md.push(
  "`docs/mapping-coverage.md` reports how much of the catalog is mapped. This report covers the",
  "opposite face: the identities that carry **no** authored suggestion of their own, so the",
  "repository can learn nothing from them, and asks which of them the repository is already",
  "pointing at.",
);
md.push("");
md.push("| Column | Definition |");
md.push("| --- | --- |");
md.push(
  `| \`requestedAsSecondary\` | Times the identity is named as the **secondary** condition in an authored CRG request row under \`docs/\` (${summary.requestRowsScanned} rows across ${summary.requestFilesScanned} packet files). Recorded demand, measured outside the knowledge base it informs. |`,
);
md.push(
  "| `inboundEdges` | Authored relationships in `data/knowledge-base/*.json` that already name the identity as a secondary. Existing coverage. |",
);
md.push(
  "| `graphInboundEdges` | The same count restricted to the adjacency store `data/knowledge-base/graph/`, which currently holds " +
    `${graphNodes} nodes. |`,
);
md.push(
  "| `gapScore` | `(1 + requestedAsSecondary) / (1 + inboundEdges)` — demand carried against coverage already present. Rows are ordered by it, then by recorded demand, then by id. |",
);
md.push("");
md.push("## Current state");
md.push("");
md.push(
  `- Catalog: **${summary.catalogIdentities}** identities, **${summary.suggestionEdges}** authored relationship edges.`,
);
md.push(
  `- With authored mappings: **${coverage.withAuthoredSuggestions}** — ${summary.publishedIdentitiesWithMappings} published, ${summary.draftIdentitiesWithMappings} draft.`,
);
md.push(`- **Blank: ${summary.blankIdentities}** — the subject of this report.`);
md.push(
  `- Of those, **${summary.withRecordedDemand}** (${pct(summary.withRecordedDemand, summary.blankIdentities)}) are named as a secondary in at least one authored request, and **${summary.withNoInboundCoverage}** (${pct(summary.withNoInboundCoverage, summary.blankIdentities)}) have no inbound edge at all — nothing in the repository points at them.`,
);
md.push(
  `- Only **${summary.withGraphInboundCoverage}** have an inbound edge in the adjacency store, which is the stricter artifact.`,
);
md.push("");
md.push("## Ranked gaps");
md.push("");
md.push("| # | Identity | Body system | Requested as secondary | Inbound edges | Gap score |");
md.push("| ---: | --- | --- | ---: | ---: | ---: |");
for (const row of rows) {
  md.push(
    `| ${row.rank} | \`${row.id}\` — ${cell(row.name)} | ${cell(row.bodySystem)} | ${row.requestedAsSecondary} | ${row.inboundEdges} | ${row.gapScore.toFixed(2)} |`,
  );
}
md.push("");
if (summary.noDemandAndNoInboundContiguous && summary.noDemandAndNoInboundBlock) {
  md.push(
    `Ranks ${summary.noDemandAndNoInboundBlock.firstRank}–${summary.noDemandAndNoInboundBlock.lastRank} (${summary.noDemandAndNoInbound} rows) carry no recorded demand and no inbound edge, so they are tied on both columns and are listed in id order. The rank number there is a stable enumeration, not a priority: no measured difference separates those rows from each other. Every row outside that block is ordered by a measured difference.`,
  );
} else {
  md.push(
    `${summary.noDemandAndNoInbound} rows carry no recorded demand and no inbound edge, so they are tied on both columns; within a tie the order is by id and carries no priority. Every row above or below them is ordered by a measured difference.`,
  );
}
md.push("");
md.push("## Highest recorded demand");
md.push("");
md.push(
  "The same set, ordered the other way: how commonly they are *asked for* as a secondary, which is",
  "the reading to use when the question is popularity rather than gap.",
);
md.push("");
md.push("| Identity | Body system | Requested as secondary | Inbound edges | Request packets |");
md.push("| --- | --- | ---: | ---: | ---: |");
for (const row of requestedRows) {
  md.push(
    `| \`${row.id}\` — ${cell(row.name)} | ${cell(row.bodySystem)} | ${row.requestedAsSecondary} | ${row.inboundEdges} | ${row.requestFiles.length} |`,
  );
}
md.push("");
md.push("## By body system");
md.push("");
md.push("| Body system | Blank identities | Requested as secondary | Inbound edges | No inbound edge |");
md.push("| --- | ---: | ---: | ---: | ---: |");
for (const system of bodySystems) {
  md.push(
    `| ${cell(system.bodySystem)} | ${system.blankIdentities} | ${system.requestedAsSecondary} | ${system.inboundEdges} | ${system.zeroInbound} |`,
  );
}
md.push("");
md.push("## Limitations");
md.push("");
md.push(
  `- Demand is recorded demand only. It is read from ${summary.requestFilesScanned} authored CRG request packets in \`docs/\`; this repository holds no field data on how often a secondary claim actually arises in claims processing, so \`requestedAsSecondary\` measures what reviewers asked for, not what claimants file.`,
);
md.push(
  `- **${summary.unresolvedRequestNames}** request rows name a secondary condition that does not resolve to a catalog identity (descriptive phrases such as "Posterior subcapsular cataract (corticosteroid-induced)"). Those rows contribute no demand to any identity, so demand is undercounted; the full list is in the JSON companion under \`unresolvedRequestNames\`.`,
);
md.push(
  "- `inboundEdges` counts edges whose host file may itself still be `draft: true`. An inbound edge is coverage of the target only in the sense that some primary already proposes it.",
);
md.push(
  "- A blank identity is not a defect on its own: several carry `todo` notes recording that evidence was sought and no compatible downstream condition was found. This report ranks where to look next; it does not assert that every blank identity has mappings to author.",
);
md.push("");

writeFileSync(join(ROOT, MD_PATH), `${md.join("\n")}`);

console.log(
  `${MD_PATH} and ${JSON_PATH} refreshed: ${summary.blankIdentities} blank identities, ` +
    `${summary.withRecordedDemand} with recorded demand, ${summary.withNoInboundCoverage} with no inbound edge`,
);
