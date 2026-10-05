import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const catalogGuide = readFileSync(
  join(process.cwd(), "docs", "condition-catalog.md"),
  "utf8",
);

describe("condition catalog documentation", () => {
  it("delegates mutable clinical-program state to its authoritative records", () => {
    expect(catalogGuide).toContain("docs/clinical-program-status.md");
    expect(catalogGuide).toContain("data/expansion-dispositions.json");
    expect(catalogGuide).toContain("docs/modeling-debt-dispositions.md");
    expect(catalogGuide).toContain("docs/qualified-human-citation-verification-queue.md");
  });

  it("does not embed a numbered evidence-promotion snapshot", () => {
    expect(catalogGuide).not.toMatch(/After Clinical Evidence Promotion Batch \d+/);
    expect(catalogGuide).not.toMatch(
      /Clinical Evidence Promotion Batches \d+ through \d+/,
    );
    expect(catalogGuide).not.toMatch(
      /After Batch \d+, the automated non-regression ceilings/,
    );
  });

  it("keeps the frozen catalog and knowledge-base identity invariant explicit", () => {
    expect(catalogGuide).toContain(
      "819 catalog identities with 819 corresponding knowledge-base mappings",
    );
  });
});
