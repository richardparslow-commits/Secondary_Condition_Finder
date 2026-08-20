import { assertMasterResolution2026CurrentState, isMasterResolution2026Active } from "./helpers/master-resolution-2026-current";
import { assertMaster2026CurrentState, isMaster2026Active } from "./helpers/master-2026-current";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

function readJson(path: string) {
  return JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as {
    bodySystem?: string;
    conditions?: Array<{ id: string }>;
  };
}

describe("clinical evidence promotion batch 2", () => {
  const catalog = loadConditionCatalog();
  const knowledgeBase = loadKnowledgeBase();
  const mappingById = new Map(knowledgeBase.map((mapping) => [mapping.id, mapping]));
  const catalogById = new Map(catalog.map((condition) => [condition.id, condition]));

  it("preserves the target-v2 302/302 identity contract", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    expect(catalog).toHaveLength(302);
    expect(knowledgeBase).toHaveLength(302);
  });

  it("publishes the reviewed hypertensive-heart-disease heart-failure relationship", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const mapping = mappingById.get("hypertensive-heart-disease");

    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(mapping?.suggestions[0]?.conditionId).toBe("congestive-heart-failure");
    expect(mapping?.suggestions[0]?.pathwayIntelligence?.pathways).toContain("disease-progression");
    expect(mapping?.suggestions[0]?.rationale).toMatch(/hypertensive heart disease/i);
    expect(mapping?.suggestions[0]?.rationale).toMatch(/contribut|causes addressed|competing/i);

    const reference = mapping?.suggestions[0]?.sourceReferences[0];
    expect(reference?.verificationScope).toBe("clinical-evidence");
    expect(reference?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/36082670/");
    expect(reference?.sourceCheckedOn).toBe("2026-08-18");
    expect(reference?.sourceLocator).toMatch(/36082670/i);
    expect(reference?.verified).toBe(true);
  });

  it("publishes the reviewed chronic-pyelonephritis CKD relationship cautiously", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const mapping = mappingById.get("chronic-pyelonephritis");

    expect(mapping?.draft).toBe(false);
    expect(mapping?.todo).toEqual([]);
    expect(mapping?.suggestions).toHaveLength(1);
    expect(mapping?.suggestions[0]?.conditionId).toBe("chronic-kidney-disease");
    expect(mapping?.suggestions[0]?.prevalence).toBe("sometimes-explored");
    expect(mapping?.suggestions[0]?.pathwayIntelligence?.pathways).toContain("disease-progression");
    expect(mapping?.suggestions[0]?.rationale).toMatch(/preserved renal function.*stable|stable.*preserved renal function/i);
    expect(mapping?.suggestions[0]?.rationale).toMatch(/competing renal causes/i);

    const reference = mapping?.suggestions[0]?.sourceReferences[0];
    expect(reference?.verificationScope).toBe("clinical-evidence");
    expect(reference?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/11110586/");
    expect(reference?.sourceCheckedOn).toBe("2026-08-18");
    expect(reference?.sourceLocator).toMatch(/11110586|255 radiologically proven/i);
    expect(reference?.verified).toBe(true);
  });

  it("withdraws unsafe knee and osteoarthritis legacy suggestions", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    // Master 2026 supersedes this historical current-state assertion while
    // preserving the original pre-master contract below for historical states.
    if (isMaster2026Active()) {
      assertMaster2026CurrentState();
      return;
    }

    for (const id of ["knee-injury", "osteoarthritis"] as const) {
      const mapping = mappingById.get(id);
      expect(mapping?.draft).toBe(true);
      expect(mapping?.suggestions).toEqual([]);
      expect(mapping?.todo.length).toBeGreaterThan(0);
      expect(mapping?.todo.join(" ")).toMatch(/withdrawn|rating|clinical evidence/i);
    }
  });

  it("physically relocates diabetic retinopathy into the ophthalmologic catalog", () => {
    const carriedOver = readJson("data/conditions/carried-over.json");
    const ophthalmologic = readJson("data/conditions/ophthalmologic-expansion-wave-4.json");
    const diabeticRetinopathy = catalogById.get("diabetic-retinopathy");

    expect(carriedOver.conditions?.some((condition) => condition.id === "diabetic-retinopathy")).toBe(false);
    expect(ophthalmologic.conditions?.some((condition) => condition.id === "diabetic-retinopathy")).toBe(true);
    expect(diabeticRetinopathy?.bodySystem).toBe("Auditory & Special Senses");
    expect(diabeticRetinopathy?.ratingSchedule[0]?.citation).toBe("38 CFR 4.79");
    expect(diabeticRetinopathy?.ratingSchedule[0]?.note).toMatch(/6040/i);
  });

  it("recognizes later qualified-human verification of both Batch-2 clinical sources", () => {
    for (const id of ["hypertensive-heart-disease", "chronic-pyelonephritis"] as const) {
      const source = mappingById.get(id)?.suggestions[0]?.sourceReferences[0];
      expect(source?.verified).toBe(true);
      expect(source?.sourceCheckedOn).toBe("2026-08-18");
    }
  });
});
