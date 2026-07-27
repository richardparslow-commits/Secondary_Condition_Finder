import { describe, expect, it } from "vitest";

import { recommend } from "@/lib/engine/recommend";
import { intakeSchema } from "@/lib/engine/types";
import { loadKnowledgeBase } from "@/lib/kb/load";
import {
  findPrimaryCondition,
  listDraftConditions,
  listPrimaryConditions,
} from "@/lib/kb/lookup";

const kb = loadKnowledgeBase();

describe("draft conditions", () => {
  it("ships no draft stubs in the current catalog", () => {
    expect(listDraftConditions(kb)).toEqual([]);
    expect(listPrimaryConditions(kb).length).toBeGreaterThan(0);
  });

  it("never lists a draft in the published condition list", () => {
    for (const condition of listPrimaryConditions(kb)) {
      expect(condition.draft).toBe(false);
    }
  });

  it("resolves formerly-draft entries as published conditions", () => {
    expect(findPrimaryCondition(kb, "sleep apnea")?.id).toBe("sleep-apnea");
    expect(findPrimaryCondition(kb, "hypertension")?.id).toBe("hypertension");
    expect(findPrimaryCondition(kb, "depression")?.id).toBe("depressive-disorder");
  });

  it("treats unknown conditions as unrecognized", () => {
    const result = recommend(
      kb,
      intakeSchema.parse({ primaryConditions: ["unknown condition"] }),
    );
    expect(result.recommendations).toEqual([]);
    expect(result.unrecognizedPrimaries).toEqual(["unknown condition"]);
  });

  it("leaves no todo on a published condition", () => {
    for (const condition of listPrimaryConditions(kb)) {
      expect(condition.todo).toEqual([]);
      expect(condition.suggestions.length).toBeGreaterThan(0);
    }
  });

  it("keeps published entries free of placeholder text", () => {
    // Scans authored content only. Serializing whole entries would match the
    // "todo" field name itself and pass or fail for the wrong reason.
    const authored = listPrimaryConditions(kb).flatMap((condition) =>
      condition.suggestions.flatMap((suggestion) => [
        suggestion.condition,
        suggestion.rationale,
        ...suggestion.evidenceGaps,
        ...suggestion.sourceReferences.flatMap((reference) => [
          reference.citation,
          reference.note,
        ]),
      ]),
    );

    for (const text of authored) {
      expect(text).not.toMatch(/TODO|FIXME|placeholder|lorem ipsum|TBD/i);
    }
  });

  it("keeps published entries aligned with existing secondary conditionIds", () => {
    const secondaryIds = new Set(
      listPrimaryConditions(kb).flatMap((condition) =>
        condition.suggestions.map((suggestion) => suggestion.conditionId),
      ),
    );

    expect(secondaryIds).toContain("sleep-apnea");
    expect(secondaryIds).toContain("depressive-disorder");
    expect(secondaryIds).toContain("hypertension");
  });
});
