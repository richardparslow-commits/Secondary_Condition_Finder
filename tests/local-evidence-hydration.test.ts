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
    expect(analyzer).toContain(
      "const restoreTimer = window.setTimeout(() => {\n      setAnalyses(loadStored());\n    }, 0);",
    );
    expect(analyzer).toContain(
      "return () => window.clearTimeout(restoreTimer);",
    );

    const initialState = analyzer.indexOf(
      'const [analyses, setAnalyses] = useState<EvidenceAnalysis[]>([]);',
    );
    const restoreEffect = analyzer.indexOf("setAnalyses(loadStored());");
    expect(initialState).toBeGreaterThanOrEqual(0);
    expect(restoreEffect).toBeGreaterThan(initialState);
  });

  it("delegates malformed or unavailable session storage to the fail-closed storage helper", () => {
    const analyzer = fs.readFileSync(analyzerPath, "utf8");
    const storage = fs.readFileSync(storagePath, "utf8");

    expect(analyzer).toContain('if (typeof window === "undefined") return null;');
    expect(analyzer).toContain("return loadStoredEvidence(getSessionStorage());");
    expect(analyzer).toContain("} catch {\n    return null;\n  }");
    expect(storage).toContain("const raw = storage.getItem(evidenceAnalysisStorageKey);");
    expect(storage).toContain("} catch {\n    return [];\n  }");
  });
});
