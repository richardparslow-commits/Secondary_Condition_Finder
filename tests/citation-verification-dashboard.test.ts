import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Qualified-human citation-verification dashboard contract.
 *
 * The dashboard (docs/citation-verification-dashboard.html) is generated from
 * the knowledge-base mapping files by the same extraction rule as the machine
 * queue: every `verified` !== true sourceReference is one pending row. It
 * prepares review and only prepares review — decisions recorded in the browser
 * change no repository record. These tests guard:
 *
 * 1. Drift       — the committed dashboard equals a fresh regeneration.
 * 2. Completeness — the embedded row set matches an independent extraction and
 *                   the machine queue count exactly.
 * 3. Batch shape — batches are oldest-first, never split an edge, and respect
 *                  the soft size cap.
 * 4. Guardrails  — the SOP honesty anchors stay in the rendered artifact.
 */

const DASHBOARD = "docs/citation-verification-dashboard.html";
const KB_DIR = "data/knowledge-base";

type DashboardRow = {
  rowId: string;
  mappingId: string;
  conditionId: string;
  citation: string;
  sourceUrl: string;
  sourceCheckedOn: string;
  sourceLocator: string;
  note: string;
  totalUses: number;
};

type DashboardBatch = {
  id: string;
  number: number;
  cohortFrom: string;
  cohortTo: string;
  rows: DashboardRow[];
};

type DashboardData = {
  summary: {
    batchSizeCap: number;
    pendingRows: number;
    distinctSources: number;
    batches: number;
  };
  batches: DashboardBatch[];
};

function loadDashboardData(): DashboardData {
  const html = readFileSync(join(process.cwd(), DASHBOARD), "utf8");
  const match = html.match(
    /<script id="dashboard-data" type="application\/json">\s*([\s\S]*?)\s*<\/script>/,
  );
  expect(match).not.toBeNull();
  return JSON.parse(match![1]) as DashboardData;
}

function extractPendingRows(): Array<{
  mappingId: string;
  conditionId: string;
  citation: string;
  sourceUrl: string;
  sourceCheckedOn: string;
  sourceLocator: string;
  note: string;
}> {
  const rows: Array<ReturnType<typeof extractPendingRows>[number]> = [];
  for (const file of readdirSync(join(process.cwd(), KB_DIR)).sort()) {
    if (!file.endsWith(".json")) continue;
    const mapping = JSON.parse(readFileSync(join(process.cwd(), KB_DIR, file), "utf8"));
    for (const suggestion of mapping.suggestions ?? []) {
      for (const reference of suggestion.sourceReferences ?? []) {
        if (reference.verified === true) continue;
        rows.push({
          mappingId: mapping.id,
          conditionId: suggestion.conditionId,
          citation: reference.citation ?? "",
          sourceUrl: reference.sourceUrl ?? "",
          sourceCheckedOn: reference.sourceCheckedOn ?? "",
          sourceLocator: reference.sourceLocator ?? "",
          note: reference.note ?? "",
        });
      }
    }
  }
  return rows;
}

describe("citation-verification dashboard", () => {
  const data = loadDashboardData();
  const allRows = data.batches.flatMap((batch) => batch.rows);

  it("matches a fresh regeneration byte-for-byte", () => {
    const out = join(mkdtempSync(join(tmpdir(), "dashboard-")), "dashboard.html");
    execFileSync(
      process.execPath,
      ["scripts/generate-citation-verification-dashboard.js", "--out", out],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(readFileSync(out, "utf8")).toBe(readFileSync(join(process.cwd(), DASHBOARD), "utf8"));
  });

  it("carries every pending reference without drift", () => {
    const expected = extractPendingRows();
    expect(data.summary.pendingRows).toBe(expected.length);
    expect(allRows.length).toBe(expected.length);

    expect(new Set(allRows.map((row) => row.rowId)).size).toBe(allRows.length); // rowIds unique

    const key = (row: { mappingId: string; conditionId: string; citation: string }) =>
      `${row.mappingId}::${row.conditionId}::${row.citation}`;
    const byRow = new Map(allRows.map((row) => [key(row), row]));
    expect(byRow.size).toBe(allRows.length); // composite keys unique

    const missing: string[] = [];
    for (const row of expected) {
      const found = byRow.get(key(row));
      if (!found) {
        missing.push(`${row.mappingId} -> ${row.conditionId}: row missing`);
        continue;
      }
      for (const [field, value] of [
        ["citation", row.citation],
        ["sourceUrl", row.sourceUrl],
        ["sourceCheckedOn", row.sourceCheckedOn],
        ["sourceLocator", row.sourceLocator],
        ["note", row.note],
      ] as const) {
        if (value && found[field] !== value) {
          missing.push(`${row.mappingId} -> ${row.conditionId}: ${field} drifted`);
        }
      }
    }
    expect(missing, `dashboard diverged from mapping data: ${missing.join("; ")}`).toEqual([]);
  });

  it("agrees with the machine queue row count", () => {
    const output = execFileSync(
      process.execPath,
      ["scripts/report-citation-verification-queue.js", "--include-drafts"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    const queue = JSON.parse(output) as { summary: { pendingCount: number } };
    expect(queue.summary.pendingCount).toBe(data.summary.pendingRows);
  });

  it("packs rows into reviewer-ready batches, oldest first", () => {
    expect(data.batches.length).toBe(data.summary.batches);
    expect(allRows.length).toBe(data.summary.pendingRows);

    // oldest first: each batch's earliest cohort date is non-decreasing
    for (let i = 1; i < data.batches.length; i++) {
      expect(data.batches[i].cohortFrom >= data.batches[i - 1].cohortFrom).toBe(true);
    }
    const globalOldest = allRows.map((row) => row.sourceCheckedOn).sort()[0];
    expect(data.batches[0].rows.some((row) => row.sourceCheckedOn === globalOldest)).toBe(true);

    // an edge's rows are never split across batches
    const edgeBatch = new Map<string, string>();
    const split: string[] = [];
    for (const batch of data.batches) {
      for (const row of batch.rows) {
        const edge = `${row.mappingId}::${row.conditionId}`;
        if (edgeBatch.has(edge) && edgeBatch.get(edge) !== batch.id) split.push(edge);
        edgeBatch.set(edge, batch.id);
      }
    }
    expect(split).toEqual([]);

    // soft cap: a batch only overflows by the remainder of its final edge
    const edgeSizes = new Map<string, number>();
    for (const row of allRows) {
      const edge = `${row.mappingId}::${row.conditionId}`;
      edgeSizes.set(edge, (edgeSizes.get(edge) ?? 0) + 1);
    }
    const maxEdge = Math.max(...edgeSizes.values());
    for (const batch of data.batches) {
      expect(batch.rows.length).toBeGreaterThan(0);
      expect(batch.rows.length).toBeLessThanOrEqual(data.summary.batchSizeCap + maxEdge - 1);
    }
  });

  it("keeps the guardrail framing honest", () => {
    const html = readFileSync(join(process.cwd(), DASHBOARD), "utf8");
    // The dashboard prepares review; it never performs verification.
    expect(html).toContain("cannot</strong> make the verification decision");
    // Association-strength boundary is stated as the review standard.
    expect(html).toContain("ASSOCIATION_ONLY");
    expect(html).toContain("NOT_ESTABLISHED");
    // Publication, causation conversion, and individual nexus are excluded.
    expect(html).toContain("not an individual VA");
    expect(html).toContain("separate gate");
    // Row set is generated, never transcribed.
    expect(html).toContain("generated, not transcribed");
    expect(html).toContain("--include-drafts");
    // Reviewer mechanics point at the real ratchet surfaces.
    expect(html).toContain("docs/citation-verification-sop.md");
    expect(html).toContain("contentDigest");
    expect(html).toContain("scripts/audit-citation-verification.js");
  });
});
