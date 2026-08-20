import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const kb = path.join(root, "data", "knowledge-base");

type Source = {
  citation?: string;
  sourceUrl?: string;
  verified?: boolean;
  verificationScope?: string;
  sourceCheckedOn?: string;
};

type Suggestion = {
  conditionId: string;
  rationale?: string;
  pathways?: string[];
  pathway?: string;
  pathwayIntelligence?: unknown;
  sourceReferences?: Source[];
};

type Mapping = {
  id: string;
  draft: boolean;
  suggestions: Suggestion[];
};

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

describe("Adrenal Histoplasmosis Taxonomy Amendment 2026", () => {
  it("adds one published adrenal-histoplasmosis KB identity using the existing Addison target", () => {
    const mapping = loadMapping("adrenal-histoplasmosis");
    expect(mapping.id).toBe("adrenal-histoplasmosis");
    expect(mapping.draft).toBe(false);
    expect(mapping.suggestions).toHaveLength(1);
    expect(mapping.suggestions[0]?.conditionId).toBe("addisons-disease");
    expect(mapping.suggestions[0]?.pathwayIntelligence).toBeUndefined();

    expect(mapping.suggestions[0]?.rationale).toMatch(/rare infectious complication/i);

    const refs = mapping.suggestions[0]?.sourceReferences ?? [];
    expect(refs).toHaveLength(1);
    expect(refs[0]?.citation).toContain("PMID 30656706");
    expect(refs[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/30656706/");
    expect(refs[0]?.verificationScope).toBe("clinical-evidence");
    expect(refs[0]?.sourceCheckedOn).toBe("2026-08-19");
    expect(refs[0]?.verified).toBe(false);
  });

  it("does not duplicate Addison disease as primary-adrenal-insufficiency", () => {
    expect(fs.existsSync(path.join(kb, "addisons-disease.json"))).toBe(true);
    expect(
      fs.existsSync(path.join(kb, "primary-adrenal-insufficiency.json")),
    ).toBe(false);
  });

  it("keeps pulmonary histoplasmosis distinct from adrenal histoplasmosis", () => {
    expect(fs.existsSync(path.join(kb, "histoplasmosis.json"))).toBe(true);
    expect(fs.existsSync(path.join(kb, "adrenal-histoplasmosis.json"))).toBe(true);
    expect(loadMapping("histoplasmosis").id).toBe("histoplasmosis");
    expect(loadMapping("adrenal-histoplasmosis").id).toBe("adrenal-histoplasmosis");
  });

  it("adds exactly one catalog identity and no duplicate primary-adrenal-insufficiency identity", () => {
    const ids: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (full === kb) continue;
          walk(full);
        } else if (entry.isFile() && entry.name.endsWith(".json")) {
          try {
            collectCatalogIds(JSON.parse(fs.readFileSync(full, "utf8")), ids);
          } catch {
            // Ignore non-catalog JSON.
          }
        }
      }
    };

    walk(path.join(root, "data", "conditions"));
    expect(ids.filter((id) => id === "adrenal-histoplasmosis")).toHaveLength(1);
    expect(ids.filter((id) => id === "addisons-disease")).toHaveLength(1);
    expect(ids.filter((id) => id === "primary-adrenal-insufficiency")).toHaveLength(0);
  });

  it("records taxonomy approval separately from later citation verification", () => {
    const artifact = JSON.parse(
      fs.readFileSync(
        path.join(
          root,
          "docs",
          "adrenal-histoplasmosis-taxonomy-amendment-2026-disposition.json",
        ),
        "utf8",
      ),
    ) as {
      status: string;
      qualifiedHumanApproval: string;
      implementationResult: {
        citationVerifiedAfterTaxonomyImplementation: boolean;
        duplicatePrimaryAdrenalInsufficiencyAdded: boolean;
      };
    };

    expect(artifact.status).toBe("APPROVED-AND-IMPLEMENTED-LOCALLY");
    expect(artifact.qualifiedHumanApproval).toBe(
      "I approve Adrenal Histoplasmosis Taxonomy Amendment 2026",
    );
    expect(
      artifact.implementationResult.citationVerifiedAfterTaxonomyImplementation,
    ).toBe(false);
    expect(
      artifact.implementationResult.duplicatePrimaryAdrenalInsufficiencyAdded,
    ).toBe(false);
  });
});
