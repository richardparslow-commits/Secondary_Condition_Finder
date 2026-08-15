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
  it("preserves 300/300", () => { expect(catalog).toHaveLength(300); expect(kb).toHaveLength(300); });
  it("promotes ACL and PCL osteoarthritis research with injury-specific clinical sources", () => {
    for (const [id, pmid] of [["acl-injury","33852440"],["pcl-injury","34505176"]] as const) {
      const mapping = byId.get(id); const suggestion = mapping?.suggestions[0];
      expect(mapping?.draft).toBe(false); expect(mapping?.todo).toEqual([]); expect(suggestion?.conditionId).toBe("osteoarthritis");
      expect(suggestion?.sourceReferences[0]?.verificationScope).toBe("clinical-evidence");
      expect(suggestion?.sourceReferences[0]?.sourceUrl).toContain(pmid); expect(suggestion?.sourceReferences[0]?.verified).toBe(false);
      expect(suggestion?.rationale).toMatch(/injured knee|individual review/i);
    }
  });
  it("recognizes later withdrawal of nondirectional anosmia and alopecia depression edges", () => {
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
    const mapping = byId.get("agranulocytosis"); expect(mapping?.draft).toBe(true); expect(mapping?.suggestions).toEqual([]); expect(mapping?.todo.join(" ")).toMatch(/withdrawn|legal framework/i);
  });
  it("normalizes hip and ankle identities into musculoskeletal maintenance without freezing later carryover cleanup", () => {
    const maintenance = ids("data/conditions/musculoskeletal-quality-maintenance.json"); const carry = ids("data/conditions/carried-over.json");
    for (const id of ["hip-strain","ankle-strain"]) { expect(maintenance).toContain(id); expect(carry).not.toContain(id); }
    expect(carry).toContain("contralateral-knee-condition");
  });
  it("does not auto-verify surviving Batch 4 clinical sources", () => {
    for (const id of ["acl-injury","pcl-injury"] as const) for (const suggestion of byId.get(id)?.suggestions ?? []) expect(suggestion.sourceReferences.every((reference) => reference.verified === false && reference.sourceCheckedOn === "2026-08-14")).toBe(true);
  });
});
