import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * D1 citation-verification packet contract — regression guard for the
 * qualified-human verification packet (docs/d1-citation-verification-packet-2026-09.md).
 *
 * The packet is generated from the knowledge-base mapping files by the same
 * extraction rule the master registries use: every `verified: false`
 * sourceReference in a draft-quarantined mapping is one pending row. That
 * row set moves with every D1 authoring batch and every verification
 * decision, so the packet must never be hand-edited into divergence:
 *
 * 1. Completeness — every authored `verified: false` reference (edge pair,
 *    canonical citation, URL, check date, locator, note) appears in the
 *    packet. A future batch that adds rows without regenerating the packet
 *    fails here, exactly as the registry lockstep audit fails.
 * 2. Guardrail framing — the packet keeps its honesty anchors: verification
 *    of a row means the source supports the bounded association-only
 *    proposition, never mapping publication, never causation, never an
 *    individual VA nexus determination, and the machine queue that produced
 *    the row set is cited rather than a transcribed table.
 */
const PACKET = "docs/d1-citation-verification-packet-2026-09.md";
const KB_DIR = "data/knowledge-base";

type SourceReference = {
  citation?: string;
  note?: string;
  sourceUrl?: string;
  sourceCheckedOn?: string;
  sourceLocator?: string;
  verified?: boolean;
};

type Suggestion = {
  conditionId: string;
  nexusClaim?: { nexusClassification?: string; associationBasis?: string };
  sourceReferences?: SourceReference[];
};

type Mapping = {
  id: string;
  draft?: boolean;
  suggestions?: Suggestion[];
};

type PendingRow = {
  mappingId: string;
  conditionId: string;
  citation: string;
  url: string;
  checkedOn: string;
  locator: string;
  note: string;
};

function loadPendingRows(): PendingRow[] {
  const rows: PendingRow[] = [];
  for (const file of readdirSync(join(process.cwd(), KB_DIR)).sort()) {
    if (!file.endsWith(".json")) continue;
    const mapping = JSON.parse(
      readFileSync(join(process.cwd(), KB_DIR, file), "utf8"),
    ) as Mapping;
    if (mapping.draft !== true) continue;
    for (const suggestion of mapping.suggestions ?? []) {
      for (const reference of suggestion.sourceReferences ?? []) {
        if (reference.verified !== false) continue;
        rows.push({
          mappingId: mapping.id,
          conditionId: suggestion.conditionId,
          citation: reference.citation ?? "",
          url: reference.sourceUrl ?? "",
          checkedOn: reference.sourceCheckedOn ?? "",
          locator: reference.sourceLocator ?? "",
          note: reference.note ?? "",
        });
      }
    }
  }
  return rows;
}

describe("D1 citation-verification packet", () => {
  const packet = readFileSync(join(process.cwd(), PACKET), "utf8");
  const pendingRows = loadPendingRows();

  it("has pending rows to govern (the D1 batches authored unverified references)", () => {
    expect(pendingRows.length).toBeGreaterThan(0);
  });

  it("carries every authored verified:false reference without drift", () => {
    const missing: string[] = [];
    for (const row of pendingRows) {
      const worksheet = packet.includes(`\`${row.mappingId}\``) && packet.includes(`\`${row.conditionId}\``);
      if (!worksheet) {
        missing.push(`${row.mappingId} -> ${row.conditionId}: worksheet missing`);
        continue;
      }
      for (const [field, value] of [
        ["citation", row.citation],
        ["url", row.url],
        ["locator", row.locator],
        ["note", row.note],
      ] as const) {
        if (value && !packet.includes(value)) {
          missing.push(`${row.mappingId} -> ${row.conditionId}: ${field} drifted`);
        }
      }
    }
    expect(missing, `packet diverged from mapping data: ${missing.join("; ")}`).toEqual([]);
  });

  it("keeps the guardrail framing honest", () => {
    // The packet prepares review; it never performs verification.
    expect(packet).toContain("cannot** make the verification decision");
    // Association-strength boundary is stated as the review standard.
    expect(packet).toContain("ASSOCIATION_ONLY");
    expect(packet).toContain("NOT_ESTABLISHED");
    // Publication, causation conversion, and individual nexus are excluded.
    expect(packet).toContain("not an individual VA");
    expect(packet).toContain("separate gate");
    // Row set is generated, never transcribed.
    expect(packet).toContain("generated, not transcribed");
    expect(packet).toContain("--include-drafts");
    // Approval mechanics point at the real ratchet surfaces.
    expect(packet).toContain("docs/citation-verification-sop.md");
    expect(packet).toContain("contentDigest");
    expect(packet).toContain("scripts/audit-citation-verification.js");
  });

  it("matches the machine queue row count", () => {
    // The packet's generated queue command must report the same row count
    // as the extraction above — one number, two independent derivations.
    const output = execFileSync(
      process.execPath,
      ["scripts/report-citation-verification-queue.js", "--markdown", "--include-drafts"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    const match = output.match(/draft-quarantined rows \*\*(\d+)\*\*/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(pendingRows.length);
  });
});
