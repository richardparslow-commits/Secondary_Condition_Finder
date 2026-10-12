import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cancellation-fence contract for extraction in LocalEvidenceAnalyzer.tsx
 * (audit A07).
 *
 * Finish/restart navigates away (unmount) while an async extraction loop may
 * still be suspended at an await. Without a fence, the detached loop keeps
 * recognizing pages and its next chunk boundary re-saves the OCR checkpoint
 * — resurrecting data that cleanup just cleared. Each extraction entry
 * (batch analysis, single-file reprocess, page-loop OCR) therefore captures
 * an extraction generation at start and abandons itself when it no longer
 * matches; unmount invalidates the generation.
 *
 * Repo convention: source-structure contracts for client components (no jsdom
 * harness), alongside tests/local-ocr-cleanup-contract.test.ts.
 */
const analyzer = fs.readFileSync(
  path.join(process.cwd(), "src/components/evidence/LocalEvidenceAnalyzer.tsx"),
  "utf8",
);

function bodyOf(startMarker: string, endMarker: string): string {
  const start = analyzer.indexOf(startMarker);
  const end = analyzer.indexOf(endMarker, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return analyzer.slice(start, end);
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const STALE_RETURN = "if (!isCurrentGeneration()) return;";
const GUARDED_RESET = "if (isCurrentGeneration()) {";

describe("local extraction cancellation fence (audit A07)", () => {
  it("holds a generation ref invalidated by the unmount cleanup", () => {
    expect(analyzer).toContain("extractionGenerationRef = useRef(0)");
    expect(analyzer).toContain(
      "return () => {\n      extractionGenerationRef.current += 1;\n    };",
    );
  });

  it("captures the generation once per extraction entry", () => {
    expect(count(analyzer, "const generation = (extractionGenerationRef.current += 1);")).toBe(3);
    expect(analyzer).toContain(
      "const isCurrentGeneration = () => generation === extractionGenerationRef.current;",
    );
  });

  it("abandons stale batch and reprocess runs before state writes and busy reset", () => {
    for (const start of ["async function runAllAnalysis()", "async function reprocessFile("]) {
      const end = start === "async function runAllAnalysis()"
        ? "async function reprocessFile("
        : "async function runLocalOcr(";
      const body = bodyOf(start, end);
      expect(count(body, STALE_RETURN)).toBeGreaterThanOrEqual(1);
      expect(count(body, GUARDED_RESET)).toBe(1);
    }
    expect(count(analyzer, STALE_RETURN)).toBe(8);
    expect(count(analyzer, GUARDED_RESET)).toBe(3);
  });

  it("fences the checkpoint write after the yield, not only before it", () => {
    const ocr = bodyOf("async function runLocalOcr(", "function analyzePastedText(");
    expect(count(ocr, STALE_RETURN)).toBe(4);

    // The load-bearing ordering (audit A07): a fence *before* the yield cannot
    // see an unmount or a Finish/Restart cleanup that happens while the run is
    // suspended there, so the checkpoint write needs its own fence after the
    // boundary. Behaviourally covered by
    // tests/local-evidence-extraction-fence.test.tsx.
    const yieldIndex = ocr.indexOf("await yieldToBrowser();");
    const saveIndex = ocr.indexOf("saveOcrCheckpoint(storage, {");
    expect(yieldIndex).toBeGreaterThan(-1);
    expect(saveIndex).toBeGreaterThan(yieldIndex);
    const fenceAfterYield = ocr.indexOf(STALE_RETURN, yieldIndex);
    expect(fenceAfterYield).toBeGreaterThan(yieldIndex);
    expect(fenceAfterYield).toBeLessThan(saveIndex);
  });

  it("never commits analysis or touches the checkpoint for a detached OCR run", () => {
    const ocr = bodyOf("async function runLocalOcr(", "function analyzePastedText(");
    const commitBlock = ocr.indexOf("if (abortedForDeadWorker) {");
    expect(commitBlock).toBeGreaterThan(-1);
    const fenceIndex = ocr.lastIndexOf("isCurrentGeneration()", commitBlock);
    expect(fenceIndex).toBeGreaterThan(commitBlock - 300);
  });
});
