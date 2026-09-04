import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { catalogFileSchema } from "@/lib/catalog/schema";
import { conditionMappingSchema } from "@/lib/kb/schema";

const CONDITIONS_DIR = path.join(process.cwd(), "data", "conditions");
const KB_DIR = path.join(process.cwd(), "data", "knowledge-base");

describe("strict schema contract for catalog and knowledge base JSON", () => {
  it("accepts all current catalog files and rejects unknown keys", () => {
    const files = fs.readdirSync(CONDITIONS_DIR).filter((file) => file.endsWith(".json"));
    for (const file of files) {
      const parsed = JSON.parse(fs.readFileSync(path.join(CONDITIONS_DIR, file), "utf8"));
      expect(() => catalogFileSchema.parse(parsed)).not.toThrow();

      const withUnknown = structuredClone(parsed);
      withUnknown.conditions[0].unknownField = true;
      expect(() => catalogFileSchema.parse(withUnknown)).toThrow();
    }
  });

  it("accepts all current mappings and rejects unknown keys at all levels", () => {
    const files = fs.readdirSync(KB_DIR).filter((file) => file.endsWith(".json"));
    for (const file of files) {
      const parsed = JSON.parse(fs.readFileSync(path.join(KB_DIR, file), "utf8"));
      expect(() => conditionMappingSchema.parse(parsed)).not.toThrow();

      const mappingUnknown = structuredClone(parsed);
      mappingUnknown.unknownField = true;
      expect(() => conditionMappingSchema.parse(mappingUnknown)).toThrow();

      if (parsed.suggestions.length > 0) {
        const suggestionUnknown = structuredClone(parsed);
        suggestionUnknown.suggestions[0].unknownField = true;
        expect(() => conditionMappingSchema.parse(suggestionUnknown)).toThrow();

        const sourceReferences = parsed.suggestions[0].sourceReferences ?? [];
        if (sourceReferences.length > 0) {
          const sourceUnknown = structuredClone(parsed);
          sourceUnknown.suggestions[0].sourceReferences[0].unknownField = true;
          expect(() => conditionMappingSchema.parse(sourceUnknown)).toThrow();
        }
      }
    }
  }, 30000);
});
