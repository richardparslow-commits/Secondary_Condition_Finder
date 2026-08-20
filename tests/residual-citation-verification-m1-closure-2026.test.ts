import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const kb = path.join(process.cwd(), "data", "knowledge-base");

const m1 = [
  ["social-anxiety-disorder", "depressive-disorder", "11231832"],
  ["social-anxiety-disorder", "depressive-disorder", "17679635"],
  ["laryngeal-cancer", "aphonia", "25630206"],
  ["laryngeal-cancer", "aphonia", "20189345"],
] as const;

function src(primary: string, target: string, pmid: string) {
  const mapping = JSON.parse(
    fs.readFileSync(path.join(kb, `${primary}.json`), "utf8"),
  ) as {
    suggestions: Array<{
      conditionId: string;
      sourceReferences?: Array<{
        citation?: string;
        sourceUrl?: string;
        verified?: boolean;
        verificationScope?: string;
        sourceCheckedOn?: string;
      }>;
    }>;
  };
  const suggestion = mapping.suggestions.find((row) => row.conditionId === target);
  const refs = (suggestion?.sourceReferences ?? []).filter(
    (ref) =>
      (ref.citation ?? "").includes(`PMID ${pmid}`) ||
      (ref.sourceUrl ?? "").includes(`/${pmid}/`),
  );
  expect(refs).toHaveLength(1);
  return refs[0]!;
}

describe("Residual M1 citation closure 2026 — current state", () => {
  it("preserves the four qualified-human-approved M1 verifications", () => {
    for (const [primary, target, pmid] of m1) {
      const ref = src(primary, target, pmid);
      expect(ref.verified).toBe(true);
      expect(ref.verificationScope).toBe("clinical-evidence");
      expect(ref.sourceCheckedOn).toBe("2026-08-19");
    }
  });

  it("recognizes the later proposition-matched PTH citation verification", () => {
    const ref = src("mild-tbi", "post-traumatic-headache", "38568491");
    expect(ref.verified).toBe(true);
    expect(ref.verificationScope).toBe("clinical-evidence");
    expect(ref.sourceCheckedOn).toBe("2026-08-19");
  });

  it("reaches zero live citation debt", () => {
    const refs = fs
      .readdirSync(kb)
      .filter((name) => name.endsWith(".json"))
      .flatMap((name) => {
        const mapping = JSON.parse(
          fs.readFileSync(path.join(kb, name), "utf8"),
        ) as {
          suggestions: Array<{
            sourceReferences?: Array<{ verified?: boolean }>;
          }>;
        };
        return mapping.suggestions.flatMap(
          (suggestion) => suggestion.sourceReferences ?? [],
        );
      });

    expect(refs).toHaveLength(141);
    expect(refs.filter((ref) => ref.verified === true)).toHaveLength(141);
    expect(refs.filter((ref) => ref.verified === false)).toHaveLength(0);
  });
});
