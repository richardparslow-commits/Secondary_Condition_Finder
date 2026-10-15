import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadStoredEvidenceWithWarning,
} from "@/lib/evidence/storage";
import type { EvidenceAnalysis } from "@/lib/evidence/extract";

/**
 * Contracts for the remaining code-health-assessment findings that were not
 * yet pinned when the 2026-09-12 report was triaged:
 *
 * - Finding #11 (incomplete error message on malformed evidence JSON):
 *   loadStoredEvidenceWithWarning must return a generic warning and log only
 *   a fixed event code, and the analyzer must use this variant in BOTH
 *   restore effects so a corrupted store is never silently reset.
 * - Finding #6 (busyRef/setBusy race): every analyzer entry point must guard
 *   on the synchronous busyRef BEFORE any await, and the OCR path must reset
 *   the guard in a finally block. (The report recommended replacing the ref
 *   with state; a synchronously-set ref is the correct guard — React state
 *   is the async one. These pins hold the working pattern in place.)
 * - Finding #7 (missing PDF page-count validation in OCR): the untrusted
 *   numPages value must be validated as a positive integer before it is used
 *   as a loop bound.
 *
 * Findings #1-#5, #8, #9, #10 were remediated earlier and are pinned by
 * evidence-pdf-page-cleanup, evidence-pdf-size-limit-cleanup,
 * local-ocr-cleanup-contract, evidence-storage-drop-notice,
 * session-write-failure-contract, and secret-fallback-contract tests.
 */

function makeAnalysis(sourceName: string): EvidenceAnalysis {
  return {
    version: 1,
    sourceName,
    excerpts: [
      {
        sourceName,
        locator: "page 1",
        quote: "chronic knee pain documented",
        category: "diagnosis",
        strength: "supporting",
        clinicianAuthored: false,
        matchedTerms: [],
      },
    ],
    nexusRelevantCount: 0,
    supportingCount: 1,
  };
}

function storageWith(raw: string | null) {
  return { getItem: () => raw };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadStoredEvidenceWithWarning (finding #11)", () => {
  it("returns analyses with a null parseError for a valid store", () => {
    const raw = JSON.stringify([makeAnalysis("source-a")]);

    const result = loadStoredEvidenceWithWarning(storageWith(raw));

    expect(result.parseError).toBeNull();
    expect(result.analyses).toHaveLength(1);
    expect(result.analyses[0]?.sourceName).toBe("source-a");
  });

  it("returns an empty result with a null parseError when storage is absent or empty", () => {
    expect(loadStoredEvidenceWithWarning(null)).toEqual({
      analyses: [],
      parseError: null,
      discardedEntries: 0,
    });
    expect(loadStoredEvidenceWithWarning(storageWith(null))).toEqual({
      analyses: [],
      parseError: null,
      discardedEntries: 0,
    });
  });

  it("treats non-array JSON as an empty store, not corruption", () => {
    const result = loadStoredEvidenceWithWarning(
      storageWith(JSON.stringify({ version: 1 })),
    );

    expect(result.analyses).toEqual([]);
    expect(result.parseError).toBeNull();
  });

  it("reports corruption without exposing document text or parser details", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const corrupt = `{not-json ${"x".repeat(900)}`;

    const result = loadStoredEvidenceWithWarning(storageWith(corrupt));

    expect(result.analyses).toEqual([]);
    expect(typeof result.parseError).toBe("string");
    expect(result.parseError?.length).toBeGreaterThan(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[evidence-storage] STORE_UNREADABLE");
    expect(result.parseError).toBe("Saved evidence could not be read.");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("not-json");
  });

  it("survives a storage reader that throws without leaking the exception", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const throwingStorage = {
      getItem: (): string => {
        throw new Error("storage unavailable");
      },
    };

    const result = loadStoredEvidenceWithWarning(throwingStorage);

    expect(result.analyses).toEqual([]);
    expect(result.parseError).toBe("Saved evidence could not be read.");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[evidence-storage] STORE_UNREADABLE");
  });
});

const analyzer = fs.readFileSync(
  path.join(process.cwd(), "src/components/evidence/LocalEvidenceAnalyzer.tsx"),
  "utf8",
);

function functionBody(startMarker: string, endMarker: string): string {
  const start = analyzer.indexOf(startMarker);
  expect(start).toBeGreaterThan(-1);
  const end = analyzer.indexOf(endMarker, start);
  expect(end).toBeGreaterThan(start);
  return analyzer.slice(start, end);
}

describe("analyzer storage-restore wiring (finding #11, structural)", () => {
  it("restores through the warning variant in both effects, never the silent loader", () => {
    const restoreCalls = analyzer.match(/loadStoredEvidenceWithWarning\(/g)?.length ?? 0;
    expect(restoreCalls).toBeGreaterThanOrEqual(2);
    // The silent variant must not be called anywhere in the component
    // ("loadStoredEvidenceWithWarning(" does not contain "loadStoredEvidence(").
    expect(analyzer).not.toContain("loadStoredEvidence(");
  });

  it("surfaces a user-visible warning when the stored evidence is corrupt", () => {
    expect(analyzer).toContain("STORAGE_CORRUPTED_WARNING");
    expect(analyzer).toContain("could not be read and was not restored");
    const restoreEffect = analyzer.slice(
      analyzer.indexOf("const restoreTimer"),
      analyzer.indexOf("const depthTimer"),
    );
    expect(restoreEffect).toContain("if (parseError)");
    expect(restoreEffect).toContain("STORAGE_CORRUPTED_WARNING");
  });
});

describe("analyzer busy-guard contract (finding #6, structural)", () => {
  const guardedEntries = [
    ["function stageFiles(", "function clearPending("],
    ["function clearPending()", "function removePending("],
    ["function removePending(", "async function analyzeOneFile("],
    ["async function runAllAnalysis()", "async function reprocessFile("],
    ["async function reprocessFile(", "async function runLocalOcr("],
    ["async function runLocalOcr(", "function analyzePastedText("],
  ] as const;

  it("checks the synchronous busyRef guard at every entry point", () => {
    for (const [start, end] of guardedEntries) {
      const body = functionBody(start, end);
      // stageFiles folds the guard with its file-list check; the busy portion
      // must still lead the condition so it short-circuits first.
      expect(body, start).toMatch(/if \(busyRef\.current \|\| busy[^\n]*return;/);
    }
  });

  it("sets the ref guard synchronously before the first await in async entries", () => {
    for (const [start, end] of [
      ["async function runAllAnalysis()", "async function reprocessFile("],
      ["async function reprocessFile(", "async function runLocalOcr("],
      ["async function runLocalOcr(", "function analyzePastedText("],
    ] as const) {
      const body = functionBody(start, end);
      const setIndex = body.indexOf("busyRef.current = true;");
      const firstAwait = body.indexOf("await ");
      expect(setIndex, start).toBeGreaterThan(-1);
      expect(setIndex, `${start}: guard must precede first await`).toBeLessThan(firstAwait);
    }
  });

  it("releases the OCR guard in a finally block so failures cannot wedge the UI", () => {
    const ocr = functionBody("async function runLocalOcr(", "function analyzePastedText(");
    const finallyIndex = ocr.lastIndexOf("} finally {");
    const releaseIndex = ocr.indexOf("busyRef.current = false;", finallyIndex);
    expect(finallyIndex).toBeGreaterThan(-1);
    expect(releaseIndex).toBeGreaterThan(finallyIndex);
  });
});

describe("OCR page-count validation (finding #7, structural)", () => {
  it("validates untrusted numPages as a positive integer before clamping the loop bound", () => {
    const ocr = functionBody("async function runLocalOcr(", "function analyzePastedText(");
    const validateIndex = ocr.indexOf(
      "if (!Number.isInteger(totalPages) || totalPages <= 0)",
    );
    const throwIndex = ocr.indexOf('throw new Error("Invalid PDF page count");');
    const clampIndex = ocr.indexOf("Math.min(totalPages, limits.pdfPages)");

    expect(validateIndex).toBeGreaterThan(-1);
    expect(throwIndex).toBeGreaterThan(validateIndex);
    expect(clampIndex).toBeGreaterThan(throwIndex);
  });
});
