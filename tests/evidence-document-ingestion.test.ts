import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Priority 1B direct browser-local document ingestion", () => {
  it("wires PDF and DOCX into the local evidence picker without a server upload endpoint", () => {
    const analyzer = fs.readFileSync(path.join(process.cwd(), "src/components/evidence/LocalEvidenceAnalyzer.tsx"), "utf8");
    expect(analyzer).toContain("application/pdf");
    expect(analyzer).toContain(".docx");
    expect(analyzer).toContain("extractLocalEvidenceDocument");
    expect(analyzer).toContain("Raw document bytes and raw document text are not submitted");
    expect(analyzer).not.toContain("fetch(\"");
  });

  it("preserves PDF page and DOCX paragraph provenance and reports OCR gaps", () => {
    const extractor = fs.readFileSync(path.join(process.cwd(), "src/lib/evidence/document-extract.ts"), "utf8");
    expect(extractor).toContain("`page ${pageNumber}`");
    expect(extractor).toContain("`paragraph ${index + 1}`");
    expect(extractor).toContain("image-only or require OCR");
    expect(extractor).toContain("No extractable PDF text was found");
    expect(extractor).toContain("enableScripting: false");
  });

  it("pins the patched parser dependencies and copies the PDF worker from node_modules", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    expect(pkg.dependencies["pdfjs-dist"]).toBe("6.2.108");
    expect(pkg.dependencies.mammoth).toBe("1.12.1");
    expect(pkg.scripts.postinstall).toBe("node scripts/copy-pdf-worker.mjs");

    const workerScript = fs.readFileSync(path.join(process.cwd(), "scripts/copy-pdf-worker.mjs"), "utf8");
    expect(workerScript).toContain("node_modules");
    expect(workerScript).toContain("pdf.worker.min.mjs");
    expect(workerScript).not.toContain("require(");
  });
});
