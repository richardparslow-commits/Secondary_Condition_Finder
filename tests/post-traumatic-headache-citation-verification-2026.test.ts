import { assertMasterResolution2026CurrentState, isMasterResolution2026Active } from "./helpers/master-resolution-2026-current";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const kb = path.join(root, "data", "knowledge-base");

describe("Post-Traumatic Headache Citation Verification 2026", () => {
  it("verifies PMID 38568491 only on the corrected bounded PTH proposition", () => {
    const mapping = JSON.parse(
      fs.readFileSync(path.join(kb, "mild-tbi.json"), "utf8"),
    ) as {
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

    expect(mapping.suggestions.some((row) => row.conditionId === "migraine-headaches")).toBe(false);
    const pth = mapping.suggestions.find(
      (row) => row.conditionId === "post-traumatic-headache",
    );
    expect(pth).toBeDefined();
    expect(pth?.pathwayIntelligence).toBeUndefined();
    expect(pth?.rationale).toMatch(/mild traumatic brain injury/i);
    expect(pth?.rationale).toMatch(/within 7 days/i);
    expect(pth?.rationale).toMatch(/greater than 3 months/i);

    const refs = pth?.sourceReferences ?? [];
    expect(refs).toHaveLength(1);
    expect(refs[0]?.citation).toContain("PMID 38568491");
    expect(refs[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/38568491/");
    expect(refs[0]?.verificationScope).toBe("clinical-evidence");
    expect(refs[0]?.sourceCheckedOn).toBe("2026-08-19");
    expect(refs[0]?.verified).toBe(true);
  });

  it("records separate qualified-human citation approval", () => {
    const artifact = JSON.parse(
      fs.readFileSync(
        path.join(
          root,
          "docs",
          "post-traumatic-headache-citation-verification-2026-disposition.json",
        ),
        "utf8",
      ),
    ) as {
      status: string;
      qualifiedHumanApproval: string;
      disposition: string;
      implementationResult: {
        verifiedAfterImplementation: boolean;
        taxonomyChanged: boolean;
        mappingTargetChanged: boolean;
        rationaleChanged: boolean;
        pathwayIntelligenceChanged: boolean;
      };
    };

    expect(artifact.status).toBe("APPROVED-AND-IMPLEMENTED-LOCALLY");
    expect(artifact.qualifiedHumanApproval).toBe(
      "I approve Post-Traumatic Headache Citation Verification 2026",
    );
    expect(artifact.disposition).toBe("VERIFY-AS-CORRECTED-PROPOSITION");
    expect(artifact.implementationResult.verifiedAfterImplementation).toBe(true);
    expect(artifact.implementationResult.taxonomyChanged).toBe(false);
    expect(artifact.implementationResult.mappingTargetChanged).toBe(false);
    expect(artifact.implementationResult.rationaleChanged).toBe(false);
    expect(artifact.implementationResult.pathwayIntelligenceChanged).toBe(false);
  });

  it("preserves PTH verification while adrenal citation verification closes the later reopened review row", () => {
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
            sourceReferences?: Array<{ verified?: boolean }>;
          }>;
        };
        return mapping.suggestions.flatMap(
          (suggestion) => suggestion.sourceReferences ?? [],
        );
      });

    expect(refs).toHaveLength(160);
    expect(refs.filter((ref) => ref.verified === true)).toHaveLength(160);
    expect(refs.filter((r) => r.verified === false)).toHaveLength(989);
  });
});
