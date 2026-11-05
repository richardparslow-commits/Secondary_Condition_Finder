import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("local evidence hydration contract", () => {
  const analyzerPath = path.join(
    process.cwd(),
    "src/components/evidence/LocalEvidenceAnalyzer.tsx",
  );
  const storagePath = path.join(
    process.cwd(),
    "src/lib/evidence/storage.ts",
  );

  it("uses the same empty evidence snapshot for SSR and the first client render", () => {
    const analyzer = fs.readFileSync(analyzerPath, "utf8");

    expect(analyzer).toContain(
      'const [analyses, setAnalyses] = useState<EvidenceAnalysis[]>([]);',
    );
    expect(analyzer).not.toContain(
      'useState<EvidenceAnalysis[]>(() => loadStored())',
    );
  });

  it("restores browser-tab evidence asynchronously after the component mounts", () => {
    const analyzer = fs.readFileSync(analyzerPath, "utf8");

    expect(analyzer).toContain(
      'import { useEffect, useMemo, useState } from "react";',
    );
    // Finding #11: the restore now goes through loadStoredEvidenceWithWarning
    // so a corrupted store surfaces a warning instead of resetting silently;
    // the async-restore (setTimeout) shape that keeps SSR/first render equal
    // is unchanged.
    // `applyAnalyses` (not a bare `setAnalyses`) is required here: it commits
    // the snapshot and keeps the ref the persistence path reads in step, so
    // the restored state and the next commit cannot disagree. See
    // tests/local-evidence-extraction-fence.test.tsx for the A07 contract.
    const restoreBlock = analyzer.slice(
      analyzer.indexOf("const restoreTimer"),
      analyzer.indexOf("const depthTimer"),
    );
    // The saved depth is read before the payload is measured, so an Extended
    // store above Standard's ceiling is not refused as oversize on mount
    // (Heal s11-extended-reload-false-corruption-warning-1).
    const savedDepthRead = restoreBlock.indexOf("const savedDepth = loadDepth();");
    const boundedLoad = restoreBlock.indexOf("loadStoredEvidenceWithWarning(");
    const depthCeiling = restoreBlock.indexOf("EVIDENCE_DEPTH_LIMITS[savedDepth]");
    const applied = restoreBlock.indexOf("applyAnalyses(analyses);");
    expect(savedDepthRead).toBeGreaterThan(-1);
    expect(boundedLoad).toBeGreaterThan(savedDepthRead);
    expect(depthCeiling).toBeGreaterThan(boundedLoad);
    expect(applied).toBeGreaterThan(depthCeiling);
    expect(analyzer).toContain(
      "return () => window.clearTimeout(restoreTimer);",
    );

    const initialState = analyzer.indexOf(
      'const [analyses, setAnalyses] = useState<EvidenceAnalysis[]>([]);',
    );
    const restoreEffect = analyzer.indexOf("applyAnalyses(analyses);");
    expect(initialState).toBeGreaterThanOrEqual(0);
    expect(restoreEffect).toBeGreaterThan(initialState);
  });

  it("delegates malformed or unavailable session storage to the fail-closed storage helper", () => {
    const analyzer = fs.readFileSync(analyzerPath, "utf8");
    const storage = fs.readFileSync(storagePath, "utf8");

    expect(analyzer).toContain('if (typeof window === "undefined") return null;');
    expect(analyzer).toContain("loadStoredEvidenceWithWarning(");
    expect(analyzer).toContain("} catch {\n    return null;\n  }");
    expect(storage).toContain("const raw = storage.getItem(evidenceAnalysisStorageKey);");
    expect(storage).toContain("} catch {\n    return [];\n  }");
    // The warning variant is fail-closed too: parse failures (including a
    // payload over the read byte ceiling) return an empty store plus a fixed,
    // content-free notice for observability instead of throwing or echoing the
    // parser message / stored record text.
    expect(storage).toContain(
      'return { analyses: [], parseError: "Saved evidence could not be read.", discardedEntries: 0 };',
    );
    expect(storage).not.toContain("parseError: message");
    expect(storage).not.toContain("rawPreview");
    expect(storage).not.toContain("first500");
  });
});
