import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { VALID_RATINGS } from "../src/lib/secondary-workflow/ratings";
import { catalogConditionSchema } from "../src/lib/catalog/schema";

interface ConditionCatalogEntry {
  id: string;
  name: string;
  aliases: string[];
  bodySystem: string;
  ratingSchedule: unknown[];
  reviewNotes: string[];
}

interface ConditionCatalogFile {
  conditions?: ConditionCatalogEntry[];
}

describe("Phase 1/2 Ratings & Condition Catalog Expansion Suite", () => {
  it("includes all required rating tiers up to 100% P&T", () => {
    const expectedRatings = [
      "0%", "10%", "20%", "30%", "40%", "50%",
      "60%", "70%", "80%", "90%", "100%", "100% P&T"
    ];
    expect(VALID_RATINGS).toEqual(expectedRatings);
  });

  it("verifies all newly added neurological and endocrine conditions exist within catalog body-system files", () => {
    const expectedConditionIds = [
      "rem-sleep-disorder",
      "hypogonadism",
      "micro-tbi",
      "mild-tbi",
      "post-concussion-syndrome",
      "intracranial-injury-without-skull-fracture",
      "cerebral-contusion-diffuse-axonal-injury",
      "skull-fracture-non-basilar-and-basal",
      "subdural-hematoma",
      "epidural-hematoma",
      "traumatic-subarachnoid-hemorrhage",
      "penetrating-head-trauma"
    ];

    const conditionsDir = path.join(process.cwd(), "data/conditions");
    const catalogFiles = fs.readdirSync(conditionsDir).filter(f => f.endsWith(".json"));

    const allConditions: ConditionCatalogEntry[] = [];
    for (const file of catalogFiles) {
      const content: ConditionCatalogFile = JSON.parse(fs.readFileSync(path.join(conditionsDir, file), "utf8"));
      if (content.conditions && Array.isArray(content.conditions)) {
        allConditions.push(...content.conditions);
      }
    }

    for (const id of expectedConditionIds) {
      const found = allConditions.find(c => c.id === id);
      expect(found, `Condition missing from catalog: ${id}`).toBeDefined();
      expect(() => catalogConditionSchema.parse(found)).not.toThrow();
    }
  });
});
