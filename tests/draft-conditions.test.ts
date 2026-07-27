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
  it("ships draft stubs alongside published entries", () => {
    expect(listDraftConditions(kb).length).toBeGreaterThan(0);
    expect(listPrimaryConditions(kb).length).toBeGreaterThan(0);
  });

  it("never lists a draft in the published condition list", () => {
    for (const condition of listPrimaryConditions(kb)) {
      expect(condition.draft).toBe(false);
    }
  });

  it("never resolves a draft through lookup", () => {
    for (const draft of listDraftConditions(kb)) {
      expect(findPrimaryCondition(kb, draft.name)).toBeNull();
      expect(findPrimaryCondition(kb, draft.id)).toBeNull();
      for (const alias of draft.aliases) {
        expect(findPrimaryCondition(kb, alias)).toBeNull();
      }
    }
  });

  it("treats a draft as unrecognized rather than returning empty results", () => {
    const draft = listDraftConditions(kb)[0];
    const result = recommend(
      kb,
      intakeSchema.parse({ primaryConditions: [draft.name] }),
    );
    expect(result.recommendations).toEqual([]);
    expect(result.unrecognizedPrimaries).toEqual([draft.name]);
  });

  it("gives every draft a non-empty todo checklist", () => {
    for (const draft of listDraftConditions(kb)) {
      expect(draft.todo.length).toBeGreaterThan(0);
    }
  });

  it("ships no draft with suggestions, since none have been authored", () => {
    for (const draft of listDraftConditions(kb)) {
      expect(draft.suggestions).toEqual([]);
    }
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

  it("uses ids that align with existing secondary conditionIds where they overlap", () => {
    // A draft promoted from an existing secondary must reuse that
    // conditionId, otherwise the engine cannot exclude it once published.
    const secondaryIds = new Set(
      listPrimaryConditions(kb).flatMap((condition) =>
        condition.suggestions.map((suggestion) => suggestion.conditionId),
      ),
    );
    const draftIds = listDraftConditions(kb).map((c) => c.id);
    const overlapping = draftIds.filter((id) => secondaryIds.has(id));

    expect(overlapping).toContain("sleep-apnea");
    expect(overlapping).toContain("depressive-disorder");
    expect(overlapping).toContain("hypertension");
  });
});
