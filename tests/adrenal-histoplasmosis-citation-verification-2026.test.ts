import { assertMasterResolution2026CurrentState, isMasterResolution2026Active } from "./helpers/master-resolution-2026-current";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const kb = path.join(root, "data", "knowledge-base");

describe("Adrenal Histoplasmosis Citation Verification 2026", () => {
  it("verifies PMID 30656706 only on the bounded adrenal-site proposition", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const mapping = JSON.parse(
      fs.readFileSync(path.join(kb, "adrenal-histoplasmosis.json"), "utf8"),
    ) as {
      draft: boolean;
      todo?: unknown[];
      suggestions: Array<{
        conditionId: string;
        rationale?: string;
        pathwayIntelligence?: unknown;
        sourceReferences?: Array<{
          citation?: string;
          sourceUrl?: string;
          verified?: boolean;
          verificationScope?: string;
          sourceCheckedOn?: string;
        }>;
      }>;
    };

    expect(mapping.draft).toBe(false);
    expect(mapping.todo).toEqual([]);
    expect(mapping.suggestions).toHaveLength(1);
    const row = mapping.suggestions[0]!;
    expect(row.conditionId).toBe("addisons-disease");
    expect(row.pathwayIntelligence).toBeUndefined();
    expect(row.rationale).toMatch(/rare infectious complication/i);
    expect(row.rationale).toMatch(/documented adrenal histoplasmosis/i);
    expect(row.rationale).toMatch(/pulmonary histoplasmosis alone does not satisfy/i);
    expect(row.rationale).toMatch(/independently documented/i);
    expect(row.rationale).toMatch(/central\/pituitary\/hypothalamic/i);
    expect(row.rationale).toMatch(/glucocorticoid-induced/i);

    const refs = row.sourceReferences ?? [];
    expect(refs).toHaveLength(1);
    expect(refs[0]?.citation).toContain("PMID 30656706");
    expect(refs[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/30656706/");
    expect(refs[0]?.verificationScope).toBe("clinical-evidence");
    expect(refs[0]?.sourceCheckedOn).toBe("2026-08-19");
    expect(refs[0]?.verified).toBe(true);
  });

  it("records separate citation approval while preserving taxonomy history", () => {
    const artifact = JSON.parse(
      fs.readFileSync(
        path.join(root, "docs", "adrenal-histoplasmosis-citation-verification-2026-disposition.json"),
        "utf8",
      ),
    ) as {
      status: string;
      qualifiedHumanApproval: string;
      verificationDisposition: string;
      implementationResult: {
        verifiedAfterImplementation: boolean;
        taxonomyChanged: boolean;
        mappingChanged: boolean;
        rationaleChanged: boolean;
        pathwayIntelligenceChanged: boolean;
      };
    };
    expect(artifact.status).toBe("APPROVED-AND-IMPLEMENTED-LOCALLY");
    expect(artifact.qualifiedHumanApproval).toBe(
      "I approve Adrenal Histoplasmosis Citation Verification 2026",
    );
    expect(artifact.verificationDisposition).toBe(
      "VERIFY-AS-CORRECTED-SITE-SPECIFIC-PROPOSITION",
    );
    expect(artifact.implementationResult.verifiedAfterImplementation).toBe(true);
    expect(artifact.implementationResult.taxonomyChanged).toBe(false);
    expect(artifact.implementationResult.mappingChanged).toBe(false);
    expect(artifact.implementationResult.rationaleChanged).toBe(false);
    expect(artifact.implementationResult.pathwayIntelligenceChanged).toBe(false);

    const taxonomy = JSON.parse(
      fs.readFileSync(
        path.join(root, "docs", "adrenal-histoplasmosis-taxonomy-amendment-2026-disposition.json"),
        "utf8",
      ),
    ) as {
      implementationResult: { citationVerifiedAfterTaxonomyImplementation: boolean };
    };
    expect(taxonomy.implementationResult.citationVerifiedAfterTaxonomyImplementation).toBe(false);
  });

  it("closes the live citation queue without changing reference count", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const refs = fs
      .readdirSync(kb)
      .filter((name) => name.endsWith(".json"))
      .flatMap((name) => {
        const mapping = JSON.parse(
          fs.readFileSync(path.join(kb, name), "utf8"),
        ) as {
          suggestions: Array<{
            sourceReferences?: Array<{
              verified?: boolean;
              verificationScope?: string;
              sourceUrl?: string;
            }>;
          }>;
        };
        return mapping.suggestions.flatMap((row) => row.sourceReferences ?? []);
      });
    expect(refs).toHaveLength(160);
    expect(refs.filter((ref) => ref.verified === true)).toHaveLength(160);
    expect(refs.filter((r) => r.verified === false)).toHaveLength(1041);
    const clinical = refs.filter((ref) => ref.verificationScope === "clinical-evidence");
    expect(clinical).toHaveLength(137);
    expect(clinical.filter((ref) => Boolean(ref.sourceUrl))).toHaveLength(137);
  });
});
