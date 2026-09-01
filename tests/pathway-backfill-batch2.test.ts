import { assertMasterResolution2026CurrentState, isMasterResolution2026Active } from "./helpers/master-resolution-2026-current";
import { assertMaster2026CurrentState, isMaster2026Active } from "./helpers/master-2026-current";
import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

const intentionallyUnlabeledEdges = [
  ["ankle-strain", "contralateral-knee-condition"],
  ["ankle-strain", "flatfoot"],
  ["osteoarthritis", "plantar-fasciitis"],
  ["knee-injury", "ankle-strain"],
  ["knee-injury", "contralateral-knee-condition"],
] as const;

const SAFETY_WITHDRAWN_PRIMARY_IDS = new Set(["ankle-strain", "knee-injury", "osteoarthritis"]);

describe("controlled pathway backfill batch 2", () => {
  it("backfills clinically-supported rheumatoid-arthritis edges", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const kb = loadKnowledgeBase();
    const mapping = kb.find((entry) => entry.id === "rheumatoid-arthritis");
    expect(mapping?.draft).toBe(false);
    const depression = mapping?.suggestions.find((entry) => entry.conditionId === "depressive-disorder");
    const gerd = mapping?.suggestions.find((entry) => entry.conditionId === "gerd");
    for (const suggestion of [depression, gerd]) {
      expect(suggestion?.sourceReferences.some((source) => source.verificationScope === "clinical-evidence")).toBe(true);
      expect(suggestion?.pathwayIntelligence?.developmentQuestions.length).toBeGreaterThan(0);
      expect(suggestion?.pathwayIntelligence?.issuesToResolve.length).toBeGreaterThan(0);
    }
    expect(depression?.pathwayIntelligence?.pathways).toEqual(["somatopsychic"]);
    expect(gerd?.pathwayIntelligence?.pathways).toEqual(["medication-related"]);
  });

  it("keeps insufficient-source Musculoskeletal edges unpublished or unlabeled", () => {
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

    const kb = loadKnowledgeBase();
    for (const [primaryId, secondaryId] of intentionallyUnlabeledEdges) {
      const mapping = kb.find((entry) => entry.id === primaryId);
      const suggestion = mapping?.suggestions.find((entry) => entry.conditionId === secondaryId);
      if (SAFETY_WITHDRAWN_PRIMARY_IDS.has(primaryId)) {
        expect(mapping?.draft).toBe(true);
        expect(mapping?.suggestions).toEqual([]);
        expect(suggestion).toBeUndefined();
      } else {
        expect(mapping?.draft).toBe(false);
        expect(suggestion?.pathwayIntelligence).toBeUndefined();
      }
    }
  });

  it("preserves rank and prevalence for the enriched rheumatoid-arthritis edges", () => {
    const kb = loadKnowledgeBase();
    const mapping = kb.find((entry) => entry.id === "rheumatoid-arthritis");
    expect(mapping?.suggestions.map(({ conditionId, rank, prevalence }) => ({ conditionId, rank, prevalence }))).toEqual([
      { conditionId: "depressive-disorder", rank: 1, prevalence: "commonly-explored" },
      { conditionId: "gerd", rank: 2, prevalence: "sometimes-explored" },
    ]);
  });

  it("keeps known draft Musculoskeletal mappings outside the backfill", () => {
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

    const kb = loadKnowledgeBase();
    for (const draftId of ["lumbar-strain", "cervical-strain", "hip-strain", "ankle-strain", "intervertebral-disc-syndrome", "radiculopathy", "knee-injury", "osteoarthritis"]) {
      expect(kb.find((entry) => entry.id === draftId)?.draft).toBe(true);
    }
  });

  it("allows the post-v2 amputation relationship only after clinical repair", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const mapping = loadKnowledgeBase().find((entry) => entry.id === "amputation-or-loss-of-use");
    const depression = mapping?.suggestions.find((entry) => entry.conditionId === "depressive-disorder");
    expect(mapping?.draft).toBe(false);
    expect(depression?.pathwayIntelligence?.pathways).toEqual(["somatopsychic"]);
    expect(depression?.sourceReferences.some((source) => source.verificationScope === "clinical-evidence")).toBe(true);
    expect(depression?.sourceReferences.some((source) => source.citation === "38 CFR 3.310")).toBe(false);
  });
});
