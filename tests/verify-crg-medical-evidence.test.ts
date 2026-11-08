import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { runCheck } from "../scripts/verify-crg-medical-evidence.js";

function writeEvidence(root: string, relativePath: string, url: string): void {
  const file = join(root, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    JSON.stringify({
      medicalEvidence: [{ title: "Synthetic evidence", url }],
    }),
  );
}

describe("verify-crg-medical-evidence", () => {
  it("verifies colocated rows and resolves both packet roots", async () => {
    const root = mkdtempSync(join(tmpdir(), "scf-medical-evidence-"));
    try {
      for (const dir of ["data/regulatory-actions", "data/conditions", "data/knowledge-base"]) {
        mkdirSync(join(root, dir), { recursive: true });
      }
      writeEvidence(root, "docs/packet.json", "https://example.com/docs-not-pubmed");
      writeEvidence(root, "data/evidence/packet.json", "https://example.com/colocated-not-pubmed");

      const fetchSpy = vi.spyOn(globalThis, "fetch");
      try {
        const result = await runCheck({ root, includeColocated: true });

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(result.summary.urlFormatErrors).toBe(2);
        expect(result.summary.missingFileCount).toBe(0);
        expect(result.summary.problems).toEqual([
          { kind: "url-format", file: "docs/packet.json" },
          { kind: "url-format", file: "data/evidence/packet.json" },
        ]);
      } finally {
        fetchSpy.mockRestore();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
