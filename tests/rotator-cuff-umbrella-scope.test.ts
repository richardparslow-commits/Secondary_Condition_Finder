import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

type CatalogEntry = {
  id: string;
  name: string;
  aliases: string[];
  reviewNotes: string[];
};

function readConditions(file: string): CatalogEntry[] {
  const raw = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "conditions", file), "utf8"),
  ) as { conditions: CatalogEntry[] };
  return raw.conditions;
}

/**
 * Regression coverage for the exact identity change of 2026-09-28: the
 * rotator-cuff pair is umbrella/member (three-closure adjudication,
 * docs/modeling-debt-dispositions.md), the bare `tear` alias hazard is gone,
 * and both entries carry the scope discipline — required by the
 * bounded-change rule in docs/modeling-debt-dispositions.md.
 */
describe("rotator-cuff umbrella/member scope (2026-09-28 three-closure adjudication)", () => {
  const umbrella = readConditions("musculoskeletal.json").find(
    (entry) => entry.id === "rotator-cuff-injury",
  );
  const member = readConditions("musculoskeletal-expansion-wave-2.json").find(
    (entry) => entry.id === "rotator-cuff-tear",
  );

  it("keeps both stable identities in place at their own granularity", () => {
    expect(umbrella).toBeDefined();
    expect(member).toBeDefined();
  });

  it("removes the bare 'tear' alias hazard from the umbrella", () => {
    expect(umbrella?.aliases).not.toContain("tear");
    expect(umbrella?.aliases).toContain("rotator cuff tendonitis");
  });

  it("records cross-referenced umbrella/member scope on both entries", () => {
    const umbrellaNotes = umbrella?.reviewNotes.join(" ") ?? "";
    const memberNotes = member?.reviewNotes.join(" ") ?? "";
    for (const notes of [umbrellaNotes, memberNotes]) {
      expect(notes).toMatch(/umbrella/i);
      expect(notes).toMatch(/member/i);
      expect(notes).toMatch(/no edge may be registered between/i);
      expect(notes).toMatch(/neither shared etiology nor secondary causation/i);
    }
    expect(umbrellaNotes).toContain("rotator-cuff-tear");
    expect(memberNotes).toContain("rotator-cuff-injury");
  });
});
