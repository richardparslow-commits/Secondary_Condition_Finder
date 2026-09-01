import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  deriveLifecycleState,
  regulatoryActionRegistrySchema,
  regulatoryActionSchema,
  type RegulatoryAction,
} from "@/lib/regulatory";

const REGISTRY_DIR = path.join(process.cwd(), "data", "regulatory-actions");
const AS_OF = "2026-09-01";

const loadRegistry = (): RegulatoryAction[] => {
  const files = fs.readdirSync(REGISTRY_DIR).filter((file) => file.endsWith(".json") && !file.startsWith("_")).sort();
  return files.map((file) => {
    const raw = JSON.parse(fs.readFileSync(path.join(REGISTRY_DIR, file), "utf8"));
    const parsed = regulatoryActionSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`Invalid regulatory action in ${file}: ${parsed.error.message}`);
    const expected = path.basename(file, ".json").toUpperCase();
    expect(parsed.data.rin, `RIN in ${file} must match the filename`).toBe(expected);
    return parsed.data;
  });
};

describe("seeded regulatory action registry", () => {
  it("parses every registry file through the runtime schema with unique, filename-matched RINs", () => {
    const actions = loadRegistry();
    expect(actions.length).toBeGreaterThanOrEqual(4);
    const registry = regulatoryActionRegistrySchema.parse(actions);
    expect(new Set(registry.map((action) => action.rin)).size).toBe(registry.length);
  });

  it("derives the expected lifecycle states for the seed RINs as of 2026-09-01", () => {
    const byRin = new Map(loadRegistry().map((action) => [action.rin, action]));
    expect(deriveLifecycleState(byRin.get("2900-AR32")!, AS_OF)).toBe("effective");
    expect(deriveLifecycleState(byRin.get("2900-AR75")!, AS_OF)).toBe("oira-review-final");
    expect(deriveLifecycleState(byRin.get("2900-AS40")!, AS_OF)).toBe("comments-closed");
    expect(deriveLifecycleState(byRin.get("2900-AS49")!, AS_OF)).toBe("rescinded");
  });

  it("keeps binding or legally dispositive Federal Register documents verified against the GovInfo official edition", () => {
    const dispositive = ["effective", "stayed", "delayed", "withdrawn", "superseded", "rescinded", "vacated"];
    for (const action of loadRegistry()) {
      for (const document of action.federalRegisterDocuments) {
        const finalLike = document.type === "rule" || document.type === "interim-final-rule";
        if (!finalLike || !dispositive.includes(document.legalStatus)) continue;
        expect(document.authenticity.officialEditionVerified, `${document.documentNumber} requires official-edition verification`).toBe(true);
        expect(document.authenticity.officialEditionSource).toBe("govinfo");
        expect(document.authenticity.officialEditionUrl).toContain("govinfo.gov");
        expect(document.authenticity.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
});
