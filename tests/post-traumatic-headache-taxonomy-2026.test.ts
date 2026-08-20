import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Source = {
  citation?: string;
  sourceUrl?: string;
  verified?: boolean;
  verificationScope?: string;
};

type Suggestion = {
  conditionId: string;
  rationale?: string;
  pathwayIntelligence?: unknown;
  sourceReferences?: Source[];
};

type Mapping = {
  id: string;
  draft: boolean;
  suggestions: Suggestion[];
};

const root = process.cwd();
const kb = path.join(root, "data", "knowledge-base");

const loadMapping = (id: string): Mapping =>
  JSON.parse(fs.readFileSync(path.join(kb, `${id}.json`), "utf8")) as Mapping;

function collectCatalogIds(node: unknown, ids: string[]) {
  if (Array.isArray(node)) {
    for (const item of node) collectCatalogIds(item, ids);
    return;
  }
  if (node && typeof node === "object") {
    const object = node as Record<string, unknown>;
    if (typeof object.id === "string") ids.push(object.id);
    for (const value of Object.values(object)) collectCatalogIds(value, ids);
  }
}

describe("Post-Traumatic Headache Taxonomy Addition 2026", () => {
  it("adds one distinct post-traumatic-headache KB identity", () => {
    const mapping = loadMapping("post-traumatic-headache");
    expect(mapping.id).toBe("post-traumatic-headache");
    expect(mapping.draft).toBe(true);
    expect(mapping.suggestions).toEqual([]);
  });

  it("replaces the mTBI migraine mismatch rather than creating a parallel edge", () => {
    const mapping = loadMapping("mild-tbi");
    const pth = mapping.suggestions.filter(
      (row) => row.conditionId === "post-traumatic-headache",
    );
    const migraine = mapping.suggestions.filter(
      (row) => row.conditionId === "migraine-headaches",
    );

    expect(pth).toHaveLength(1);
    expect(migraine).toHaveLength(0);
    expect(pth[0]?.pathwayIntelligence).toBeUndefined();

    const refs = pth[0]?.sourceReferences ?? [];
    expect(refs).toHaveLength(1);
    expect(refs[0]?.citation).toContain("PMID 38568491");
    expect(refs[0]?.sourceUrl).toBe(
      "https://pubmed.ncbi.nlm.nih.gov/38568491/",
    );
    expect(refs[0]?.verificationScope).toBe("clinical-evidence");
    expect(refs[0]?.verified).toBe(true);
    expect(pth[0]?.rationale).toMatch(/within 7 days/i);
  });

  it("adds exactly one authoritative catalog identity for post-traumatic-headache", () => {
    const dataRoot = path.join(root, "data");
    const ids: string[] = [];

    const walkFiles = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (full === kb) continue;
          walkFiles(full);
        } else if (entry.isFile() && entry.name.endsWith(".json")) {
          try {
            collectCatalogIds(JSON.parse(fs.readFileSync(full, "utf8")), ids);
          } catch {
            // Ignore non-catalog JSON.
          }
        }
      }
    };
    walkFiles(dataRoot);

    expect(ids.filter((id) => id === "post-traumatic-headache")).toHaveLength(1);
  });

  it("keeps citation verification separate from taxonomy approval", () => {
    const mapping = loadMapping("mild-tbi");
    const source = mapping.suggestions
      .find((row) => row.conditionId === "post-traumatic-headache")
      ?.sourceReferences?.find((ref) =>
        (ref.citation ?? "").includes("PMID 38568491"),
      );
    expect(source?.verified).toBe(true);

    const artifact = JSON.parse(
      fs.readFileSync(
        path.join(
          root,
          "docs",
          "post-traumatic-headache-taxonomy-addition-2026-disposition.json",
        ),
        "utf8",
      ),
    ) as {
      status: string;
      qualifiedHumanApproval: string;
      implementationResult: {
        verifiedAfterTaxonomyImplementation: boolean;
      };
    };

    expect(artifact.status).toBe("APPROVED-AND-IMPLEMENTED-LOCALLY");
    expect(artifact.qualifiedHumanApproval).toBe(
      "I approve Post-Traumatic Headache Taxonomy Addition 2026",
    );
    expect(
      artifact.implementationResult.verifiedAfterTaxonomyImplementation,
    ).toBe(false);
  });
});
