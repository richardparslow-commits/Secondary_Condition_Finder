import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Graph-pathway anchor citation queue (Stages 3a–3c) — regression guard for
 * the qualified-human citation-verification queue section that indexes the
 * nine anchors authored by the 2026-10 graph-adjacency stages.
 *
 * Three routes were registered on the ordinary draft path, each carrying
 * three authored citation anchors: `alcohol-use-disorder` ->
 * `chronic-liver-disease` (Stage 3a), `liver-cancer` -> `sarcopenia`
 * (Stage 3b) and `bruxism-awake-sleep` -> `tmj-disorder` (Stage 3c). This
 * suite pins four surfaces so the refresh cannot silently drift:
 *
 * 1. Live knowledge-base state — three references per route with their PMIDs,
 *    check dates and verification flags (the six pending anchors stay
 *    `verified: false`; the Stage 3b anchors stay verified).
 * 2. The queue doc's index table — every anchor appears with its worksheet row
 *    id and live decision state, and the Stage 3b state cells point at the
 *    recorded disposition record.
 * 3. The machine queue — the pending anchors are present in the
 *    `--include-drafts` row set and absent from the default published queue.
 * 4. The D1 packet worksheets — pending rows keep their pending state line,
 *    and the reviewed Stage 3b rows carry the recorded state instead of a
 *    stale pending decision.
 */

const QUEUE = "docs/qualified-human-citation-verification-queue.md";
const PACKET = "docs/d1-citation-verification-packet-2026-09.md";
const DISPOSITION =
  "docs/liver-cancer-sarcopenia-citation-verification-2026-disposition.md";
const KB_DIR = "data/knowledge-base";
const SECTION_HEADING = "## Graph-pathway anchor review (Stages 3a–3c, 2026-10)";

const read = (relativePath: string): string =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

type SourceReference = {
  citation?: string;
  sourceUrl?: string;
  verified?: boolean;
  sourceCheckedOn?: string;
};

type Suggestion = {
  conditionId: string;
  sourceReferences?: SourceReference[];
};

type Mapping = {
  id: string;
  draft?: boolean;
  suggestions?: Suggestion[];
};

type RouteSpec = {
  stage: "3a" | "3b" | "3c";
  file: string;
  source: string;
  target: string;
  rows: Array<{ row: string; pmid: string; state: string }>;
};

const ROUTES: RouteSpec[] = [
  {
    stage: "3a",
    file: "alcohol-use-disorder.json",
    source: "alcohol-use-disorder",
    target: "chronic-liver-disease",
    rows: [
      { row: "505.1", pmid: "30080255", state: "PENDING (draft-quarantined)" },
      { row: "505.2", pmid: "36926309", state: "PENDING (draft-quarantined)" },
      { row: "505.3", pmid: "20636661", state: "PENDING (draft-quarantined)" },
    ],
  },
  {
    stage: "3b",
    file: "liver-cancer.json",
    source: "liver-cancer",
    target: "sarcopenia",
    rows: [
      { row: "504.1", pmid: "37274463", state: "VERIFIED 2026-10-04 (with narrowing)" },
      { row: "504.2", pmid: "36590214", state: "VERIFIED 2026-10-04 (with narrowing)" },
      { row: "504.3", pmid: "26266324", state: "VERIFIED 2026-10-04 (as written)" },
    ],
  },
  {
    stage: "3c",
    file: "bruxism-awake-sleep.json",
    source: "bruxism-awake-sleep",
    target: "tmj-disorder",
    rows: [
      { row: "506.1", pmid: "37474733", state: "PENDING (draft-quarantined)" },
      { row: "506.2", pmid: "27796166", state: "PENDING (draft-quarantined)" },
      { row: "506.3", pmid: "9758394", state: "PENDING (draft-quarantined)" },
    ],
  },
];

const PENDING_ROUTES = ROUTES.filter((route) => route.stage !== "3b");

function loadMapping(file: string): Mapping {
  return JSON.parse(read(join(KB_DIR, file))) as Mapping;
}

/** The queue doc's graph-pathway section, from its heading to the next `## `. */
function queueSection(): string {
  const doc = read(QUEUE);
  const start = doc.indexOf(SECTION_HEADING);
  expect(
    start,
    `queue doc is missing the section heading: ${SECTION_HEADING}`,
  ).toBeGreaterThanOrEqual(0);
  const rest = doc.slice(start + SECTION_HEADING.length);
  const end = rest.indexOf("\n## ");
  return end === -1 ? rest : rest.slice(0, end);
}

/** The packet block from `**Row <id> —` to the next row or edge heading. */
function packetRowBlock(packet: string, rowId: string): string {
  const start = packet.indexOf(`**Row ${rowId} —`);
  expect(start, `packet is missing worksheet row ${rowId}`).toBeGreaterThanOrEqual(0);
  const after = packet.slice(start + 1);
  const candidates = [
    after.indexOf("\n**Row "),
    after.indexOf("\n### "),
  ].filter((index) => index !== -1);
  const end =
    candidates.length > 0 ? Math.min(...candidates) + start + 1 : packet.length;
  return packet.slice(start, end);
}

describe("graph-pathway anchor citation queue (Stages 3a–3c)", () => {
  it("pins the live knowledge-base state of all nine authored anchors", () => {
    for (const route of ROUTES) {
      const mapping = loadMapping(route.file);
      expect(mapping.draft, `${route.file} must stay draft-quarantined`).toBe(true);
      const suggestion = (mapping.suggestions ?? []).find(
        (entry) => entry.conditionId === route.target,
      );
      expect(
        suggestion,
        `${route.file} is missing its ${route.target} suggestion`,
      ).toBeDefined();
      const references = suggestion?.sourceReferences ?? [];
      expect(references, `${route.file} anchor count drifted`).toHaveLength(3);
      expect(references.map((reference) => reference.sourceUrl)).toEqual(
        route.rows.map((entry) => `https://pubmed.ncbi.nlm.nih.gov/${entry.pmid}/`),
      );
      for (const [index, reference] of references.entries()) {
        const expected = route.rows[index];
        expect(
          reference.citation,
          `${route.file} PMID ${expected.pmid} citation drifted`,
        ).toContain(`PMID ${expected.pmid}`);
        expect(
          reference.verified,
          `${route.file} PMID ${expected.pmid} verification flag drifted`,
        ).toBe(route.stage === "3b");
        expect(
          reference.sourceCheckedOn,
          `${route.file} PMID ${expected.pmid} check date drifted`,
        ).toBe("2026-10-04");
      }
    }
  });

  it("indexes every anchor in the queue doc with its worksheet row and live state", () => {
    const tableRows = queueSection()
      .split("\n")
      .filter(
        (line) =>
          line.startsWith("| ") &&
          !line.startsWith("| Stage") &&
          !line.startsWith("|---"),
      );
    expect(tableRows, "queue doc index table must carry all nine anchors").toHaveLength(9);

    const byPmid = new Map<
      string,
      { stage: string; route: string; row: string; state: string }
    >();
    for (const line of tableRows) {
      const cells = line.split("|").map((cell) => cell.trim());
      // cells[0] is the empty leading segment of a `| Stage | ... |` line.
      byPmid.set(cells[4], {
        stage: cells[1],
        route: cells[2],
        row: cells[3],
        state: cells[5],
      });
    }

    for (const route of ROUTES) {
      for (const entry of route.rows) {
        const indexed = byPmid.get(entry.pmid);
        expect(
          indexed,
          `queue doc lost the PMID ${entry.pmid} worksheet index entry`,
        ).toBeDefined();
        expect(indexed?.stage).toBe(route.stage);
        expect(
          indexed?.route,
          `queue doc route cell drifted for PMID ${entry.pmid}`,
        ).toContain(`\`${route.source}\` → \`${route.target}\``);
        expect(indexed?.row, `queue doc worksheet row drifted for PMID ${entry.pmid}`).toBe(
          entry.row,
        );
        expect(indexed?.state, `queue doc state drifted for PMID ${entry.pmid}`).toBe(
          entry.state,
        );
      }
    }
  });

  it("keeps the Stage 3b decisions wired to the recorded disposition", () => {
    const section = queueSection();
    expect(section).toContain(`\`${DISPOSITION}\``);

    const disposition = read(DISPOSITION);
    for (const entry of ROUTES[1].rows) {
      expect(disposition).toContain(entry.pmid);
    }
    expect(disposition).toContain("VERIFY-WITH-NARROWING");
    expect(disposition).toContain("VERIFY-AS-WRITTEN");
  });

  it("keeps the pending anchors in the draft machine queue and out of the published queue", () => {
    const draftQueue = execFileSync(
      process.execPath,
      ["scripts/report-citation-verification-queue.js", "--markdown", "--include-drafts"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    for (const route of PENDING_ROUTES) {
      expect(
        draftQueue,
        `draft machine queue lost the ${route.source} → ${route.target} row set`,
      ).toContain(`| ${route.source} | ${route.target} |`);
      for (const entry of route.rows) {
        expect(draftQueue, `draft machine queue lost PMID ${entry.pmid}`).toContain(
          entry.pmid,
        );
      }
    }
    // The Stage 3b anchors were verified, so their rows must have left the queue.
    expect(draftQueue).not.toContain("| liver-cancer | sarcopenia |");

    const publishedQueue = execFileSync(
      process.execPath,
      ["scripts/report-citation-verification-queue.js", "--markdown"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(publishedQueue).toContain("Pending live published references: **0**");
    for (const route of ROUTES) {
      expect(
        publishedQueue,
        `published queue must not list the draft route ${route.source} → ${route.target}`,
      ).not.toContain(`| ${route.source} | ${route.target} |`);
    }
  });

  it("keeps the pending worksheet rows pending in the D1 packet", () => {
    const packet = read(PACKET);
    for (const route of PENDING_ROUTES) {
      for (const entry of route.rows) {
        const block = packetRowBlock(packet, entry.row);
        expect(block).toContain(`https://pubmed.ncbi.nlm.nih.gov/${entry.pmid}/`);
        expect(block).toContain(
          "- Current state: `verified: false` — pending qualified-human decision",
        );
      }
    }
  });

  it("records the reviewed state on the Stage 3b worksheet rows", () => {
    const packet = read(PACKET);
    for (const entry of ROUTES[1].rows) {
      const block = packetRowBlock(packet, entry.row);
      expect(block).toContain("- Source checked on: 2026-10-04");
      expect(block).toContain("- Current state: `verified: true` (2026-10-04)");
      expect(block).toContain(`\`${DISPOSITION}\``);
      expect(block).not.toContain("pending qualified-human decision");
    }
  });
});
