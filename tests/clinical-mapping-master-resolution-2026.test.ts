import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertMasterResolution2026CurrentState,
  isMasterResolution2026Active,
} from "./helpers/master-resolution-2026-current";

type Mapping = {
  draft: boolean;
  suggestions?: Array<{ conditionId: string }>;
};

const root = process.cwd();

describe("Clinical Mapping Master Resolution 2026", () => {
  it("activates the approved exhaustive Master Resolution state", () => {
    expect(isMasterResolution2026Active()).toBe(true);
    assertMasterResolution2026CurrentState();
  });

  it("records the exact qualified-human mapping approval and keeps citation verification separate", () => {
    const d = JSON.parse(
      fs.readFileSync(
        path.join(
          root,
          "docs",
          "clinical-mapping-master-resolution-2026-approved-disposition.json",
        ),
        "utf8",
      ),
    ) as {
      status: string;
      qualifiedHumanApproval: string;
      masterResolutionStats: {
        originalUnresolvedConditionsReviewed: number;
        newRelationshipEdges: number;
        newIdentities: number;
      };
      policy: {
        mappingApprovalSeparateFromCitationVerification: boolean;
        newClinicalSourcesRemainVerifiedFalse: boolean;
        noMechanisticPathwayIntelligence: boolean;
      };
      implementationResult: {
        allNewSourcesVerifiedFalse: boolean;
        citationsVerifiedByThisImplementation: number;
        remoteWritesPerformed: boolean;
      };
    };

    expect(d.status).toBe("APPROVED-AND-IMPLEMENTED-LOCALLY");
    expect(d.qualifiedHumanApproval).toBe(
      "I approve Clinical Mapping Master Resolution 2026",
    );
    expect(d.masterResolutionStats.originalUnresolvedConditionsReviewed).toBe(197);
    expect(d.masterResolutionStats.newRelationshipEdges).toBe(39);
    expect(d.masterResolutionStats.newIdentities).toBe(9);
    expect(d.policy.mappingApprovalSeparateFromCitationVerification).toBe(true);
    expect(d.policy.newClinicalSourcesRemainVerifiedFalse).toBe(true);
    expect(d.policy.noMechanisticPathwayIntelligence).toBe(true);
    expect(d.implementationResult.allNewSourcesVerifiedFalse).toBe(true);
    expect(d.implementationResult.citationsVerifiedByThisImplementation).toBe(0);
    expect(d.implementationResult.remoteWritesPerformed).toBe(false);
  });

  it("keeps the broad seizure and spinal-stenosis identities draft while publishing narrower taxonomy", () => {
    const kb = path.join(root, "data", "knowledge-base");
    const load = (id: string): Mapping =>
      JSON.parse(
        fs.readFileSync(path.join(kb, `${id}.json`), "utf8"),
      ) as Mapping;

    expect(load("seizure-disorder").draft).toBe(true);
    expect(load("spinal-stenosis").draft).toBe(true);
    expect(load("epilepsy").draft).toBe(false);
    expect(load("lumbar-spinal-stenosis").draft).toBe(false);

    const epilepsyTargets = (load("epilepsy").suggestions ?? []).map(
      (s) => s.conditionId,
    );
    expect(epilepsyTargets).toEqual(["depressive-disorder"]);

    const lumbarTargets = (load("lumbar-spinal-stenosis").suggestions ?? []).map(
      (s) => s.conditionId,
    );
    expect(lumbarTargets).toEqual(["cauda-equina-syndrome"]);
  });

  it("adds nine taxonomy identities without inventing verified citations", () => {
    const catalogRoot = path.join(root, "data", "conditions");
    const ids: string[] = [];
    const walk = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (value && typeof value === "object") {
        const obj = value as Record<string, unknown>;
        if (typeof obj.id === "string") ids.push(obj.id);
        Object.values(obj).forEach(walk);
      }
    };
    const walkFiles = (dir: string) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walkFiles(full);
        else if (name.endsWith(".json")) {
          walk(JSON.parse(fs.readFileSync(full, "utf8")));
        }
      }
    };
    walkFiles(catalogRoot);

    const newIds = [
      "acne-scarring",
      "lumbar-spinal-stenosis",
      "epilepsy",
      "guillain-barre-syndrome",
      "reactive-arthritis",
      "lymphedema",
      "endometrial-cancer",
      "amebic-liver-abscess",
      "pulmonary-embolism",
    ];
    for (const id of newIds) {
      expect(ids.filter((x) => x === id)).toHaveLength(1);
    }
    expect(ids).toHaveLength(817);
  });
});
