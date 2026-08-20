import { assertMasterResolution2026CurrentState, isMasterResolution2026Active } from "./helpers/master-resolution-2026-current";
import { assertMaster2026CurrentState, isMaster2026Active } from "./helpers/master-2026-current";
import { describe, expect, it } from "vitest";

import { loadKnowledgeBase } from "@/lib/kb/load";

const supportedSomatopsychicEdges = [
  ["stomach-cancer", "depressive-disorder"],
  ["abdominal-hernia", "depressive-disorder"],
] as const;

const intentionallyUnlabeledEdges = [
  ["erectile-dysfunction", "gerd"],
  ["congestive-heart-failure", "depressive-disorder"],
  ["congestive-heart-failure", "gerd"],
] as const;

const safetyWithdrawnMappings = [
  "agranulocytosis",
  "al-amyloidosis",
  "addisons-disease",
  "anorexia-nervosa",
] as const;

describe("controlled pathway backfill batch 4", () => {
  it("adds a conditional somatopsychic pathway only to the two supported physical-to-mood edges", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const kb = loadKnowledgeBase();

    for (const [primaryId, secondaryId] of supportedSomatopsychicEdges) {
      const mapping = kb.find((entry) => entry.id === primaryId);
      const suggestion = mapping?.suggestions.find(
        (entry) => entry.conditionId === secondaryId,
      );

      expect(mapping?.draft).toBe(false);
      expect(suggestion?.sourceReferences.some(
        (source) => source.verificationScope === "clinical-evidence",
      )).toBe(true);
      expect(suggestion?.pathwayIntelligence?.pathways).toEqual(["somatopsychic"]);
      expect(suggestion?.pathwayIntelligence?.causalChain).toContain("if present");
      expect(suggestion?.pathwayIntelligence?.developmentQuestions.length).toBeGreaterThan(0);
      expect(suggestion?.pathwayIntelligence?.issuesToResolve.length).toBeGreaterThan(0);
    }
  });

  it("does not turn treatment-risk or comorbidity evidence into an unsupported pathway", () => {
    const kb = loadKnowledgeBase();

    for (const [primaryId, secondaryId] of intentionallyUnlabeledEdges) {
      const mapping = kb.find((entry) => entry.id === primaryId);
      const suggestion = mapping?.suggestions.find(
        (entry) => entry.conditionId === secondaryId,
      );
      expect(mapping?.draft).toBe(false);
      expect(suggestion?.pathwayIntelligence).toBeUndefined();
    }
  });

  it("recognizes the Batch 5 ED association narrowing without resurrecting the unsupported GERD chain", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const mapping = loadKnowledgeBase().find((entry) => entry.id === "erectile-dysfunction");
    const depression = mapping?.suggestions.find((entry) => entry.conditionId === "depressive-disorder");
    const gerd = mapping?.suggestions.find((entry) => entry.conditionId === "gerd");
    const source = depression?.sourceReferences.find((entry) => entry.sourceUrl?.includes("29960891"));

    expect(mapping?.draft).toBe(false);
    expect(gerd).toBeUndefined();
    expect(source?.verificationScope).toBe("clinical-evidence");
    expect(source?.verified).toBe(true);
    expect(source?.sourceCheckedOn).toBe("2026-08-18");
    expect(depression?.pathwayIntelligence).toBeUndefined();
    expect(depression?.rationale).toMatch(/bidirectional/i);
    expect(depression?.rationale).toMatch(/does not establish|causal direction/i);
  });

  it("recognizes the Batch 17 stomach-cancer and abdominal-hernia GERD withdrawals", () => {
    const kb = loadKnowledgeBase();

    for (const primaryId of ["stomach-cancer", "abdominal-hernia"]) {
      const mapping = kb.find((entry) => entry.id === primaryId);
      expect(mapping?.draft).toBe(false);
      expect(mapping?.suggestions).toHaveLength(1);
      expect(mapping?.suggestions[0]?.conditionId).toBe("depressive-disorder");
      expect(mapping?.suggestions[0]?.rank).toBe(1);
      expect(mapping?.suggestions[0]?.prevalence).toBe("commonly-explored");
      expect(mapping?.suggestions.some((entry) => entry.conditionId === "gerd")).toBe(false);
    }
  });

  it("keeps later safety withdrawals unpublished", () => {
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

    for (const primaryId of safetyWithdrawnMappings) {
      const mapping = kb.find((entry) => entry.id === primaryId);
      expect(mapping?.draft).toBe(true);
      expect(mapping?.suggestions).toEqual([]);
      expect(mapping?.todo.length).toBeGreaterThan(0);
    }
  });

  it("recognizes the later alopecia-areata depression withdrawal", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const mapping = loadKnowledgeBase().find((entry) => entry.id === "alopecia-areata");
    expect(mapping?.draft).toBe(true);
    expect(mapping?.suggestions).toEqual([]);
    expect(mapping?.todo.join(" ")).toMatch(/comorbidity|directional/i);
  });

  it("recognizes hypertension only after its four published edges are clinically repaired", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const mapping = loadKnowledgeBase().find((entry) => entry.id === "hypertension");
    expect(mapping?.draft).toBe(false);
    expect(mapping?.suggestions).toHaveLength(4);
    for (const suggestion of mapping?.suggestions ?? []) {
      expect(suggestion.sourceReferences.some((source) => source.verificationScope === "clinical-evidence")).toBe(true);
      expect(suggestion.sourceReferences.some((source) => source.citation.startsWith("38 CFR"))).toBe(false);
    }
  });
});
