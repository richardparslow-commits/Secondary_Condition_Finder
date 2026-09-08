import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { VALID_RATINGS } from "../src/lib/secondary-workflow";

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
      "mild-traumatic-brain-injury",
      "post-concussion-syndrome",
      "intracranial-injury-without-skull-fracture",
      "cerebral-contusion-dai",
      "skull-fracture",
      "subdural-hematoma",
      "epidural-hematoma",
      "traumatic-subarachnoid-hemorrhage",
      "penetrating-head-trauma"
    ];

    const conditionsDir = path.join(process.cwd(), "data/conditions");
    const catalogFiles = fs.readdirSync(conditionsDir).filter(f => f.endsWith(".json"));

    interface RawCondition {
      id: string;
      primaryDiagnosticCodes?: unknown[];
      cfrCitations?: unknown[];
      verified?: boolean;
    }

    const allConditions: RawCondition[] = [];
    for (const file of catalogFiles) {
      const content = JSON.parse(fs.readFileSync(path.join(conditionsDir, file), "utf8"));
      if (content.conditions && Array.isArray(content.conditions)) {
        allConditions.push(...content.conditions);
      }
    }

    for (const id of expectedConditionIds) {
      const found = allConditions.find(c => c.id === id);
      expect(found, `Condition missing from catalog: ${id}`).toBeDefined();
      if (!found) continue;
      expect(found.primaryDiagnosticCodes).toBeInstanceOf(Array);
      expect(found.cfrCitations).toBeInstanceOf(Array);
      expect(found.verified).toBe(false);
    }
  });
});
