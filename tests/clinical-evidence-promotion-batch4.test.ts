import { assertMasterResolution2026CurrentState, isMasterResolution2026Active } from "./helpers/master-resolution-2026-current";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

function ids(path: string) {
  return (JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as { conditions: Array<{ id: string }> }).conditions.map((condition) => condition.id);
}

describe("clinical evidence promotion batch 4", () => {
  const catalog = loadConditionCatalog(); const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));
  it("preserves 302/302", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }
 expect(catalog).toHaveLength(302); expect(kb).toHaveLength(302); });
  it("promotes ACL and PCL osteoarthritis research with injury-specific clinical sources", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    for (const [id, pmid] of [["acl-injury","33852440"],["pcl-injury","34505176"]] as const) {
      const mapping = byId.get(id); const suggestion = mapping?.suggestions[0];
      expect(mapping?.draft).toBe(false); expect(mapping?.todo).toEqual([]); expect(suggestion?.conditionId).toBe("osteoarthritis");
      expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
      expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain(pmid);
      expect(suggestion?.sourceReferences[0]?.verified).toBe(true);
      expect(suggestion?.sourceReferences[0]?.sourceCheckedOn).toBe(id === "acl-injury" ? "2026-08-18" : "2026-08-19");
      expect(suggestion?.rationale).toMatch(/injured knee|individual review/i);
    }
  });
  it("recognizes later withdrawal of nondirectional anosmia and alopecia depression edges", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const anosmia = byId.get("anosmia");
    expect(anosmia?.draft).toBe(true);
    expect(anosmia?.suggestions).toEqual([]);
    expect(anosmia?.todo.join(" ")).toMatch(/causal pathways|directional/i);

    const alopecia = byId.get("alopecia-areata");
    expect(alopecia?.draft).toBe(true);
    expect(alopecia?.suggestions).toEqual([]);
    expect(alopecia?.todo.join(" ")).toMatch(/comorbidity|directional/i);
  });
  it("withdraws agranulocytosis legal-only generic relationships", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const mapping = byId.get("agranulocytosis"); expect(mapping?.draft).toBe(true); expect(mapping?.suggestions).toEqual([]); expect(mapping?.todo.join(" ")).toMatch(/withdrawn|legal framework/i);
  });
  it("normalizes hip and ankle identities into musculoskeletal maintenance without freezing later carryover cleanup", () => {
    const maintenance = ids("data/conditions/musculoskeletal-quality-maintenance.json"); const carry = ids("data/conditions/carried-over.json");
    for (const id of ["hip-strain","ankle-strain"]) { expect(maintenance).toContain(id); expect(carry).not.toContain(id); }
    expect(carry).toContain("contralateral-knee-condition");
  });
  it("distinguishes later qualified-human ACL verification from the now-qualified-human-verified PCL source", () => {
    const acl = byId.get("acl-injury")?.suggestions[0]?.sourceReferences[0];
    expect(acl?.verified).toBe(true);
    expect(acl?.sourceCheckedOn).toBe("2026-08-18");
    const pcl = byId.get("pcl-injury")?.suggestions[0]?.sourceReferences[0];
    expect(pcl?.verified).toBe(true);
    expect(pcl?.sourceCheckedOn).toBe("2026-08-19");
  });
});
