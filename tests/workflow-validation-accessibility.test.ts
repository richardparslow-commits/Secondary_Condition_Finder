import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  SECONDARY_VALIDATION_MESSAGES,
  secondaryValidationMessage,
  secondaryValidationPath,
  type SecondaryValidationCode,
} from "@/lib/secondary-workflow/validation";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("accessible workflow validation", () => {
  it("keeps validation redirects limited to a static error identifier", () => {
    const codes = Object.keys(SECONDARY_VALIDATION_MESSAGES) as SecondaryValidationCode[];

    for (const code of codes) {
      const url = new URL(
        secondaryValidationPath("/secondary/diagnosed", code),
        "https://example.invalid",
      );
      expect([...url.searchParams.keys()]).toEqual(["error"]);
      expect(url.searchParams.get("error")).toBe(code);
      expect(url.search).not.toMatch(/[?&](?:diagnosed|serviceConnected|rating-[^=]*|medications|treatments|location|serviceStart|serviceEnd|documentsShared)=/);
    }
  });

  it("ignores unknown validation identifiers instead of echoing query text", () => {
    expect(secondaryValidationMessage("select-diagnosed")).toBe(
      "Select at least one diagnosed condition to continue.",
    );
    expect(secondaryValidationMessage("unexpected-user-supplied-text")).toBeNull();
  });

  it("requires explicit neutral service-connected answers and preserves partial answers in the browser-local context", () => {
    const step = read("src/components/secondary/steps/ServiceConnectedStep.tsx");
    const clientSteps = read("src/lib/secondary-workflow/client-steps.ts");
    const contextStore = read("src/lib/secondary-workflow/browser-context.ts");

    expect(step).not.toMatch(/value="yes"\s+required/);
    expect(step).not.toMatch(/value="no"\s+required/);
    expect(step).not.toContain("hasPriorSelection ? selectedServiceConnectedIds.has(condition.id) : true");
    expect(step).toContain('answerDraft ? answerDraft[condition.id] === "yes"');
    expect(step).toContain('answerDraft ? answerDraft[condition.id] === "no"');
    expect(step).toContain('role="alert"');
    expect(clientSteps).toContain("knownConditionIds.has(id)");
    expect(clientSteps).toContain("delete currentParams.serviceConnected");
    expect(clientSteps).toContain('answer !== "yes" && answer !== "no"');
    expect(clientSteps).toContain("serviceConnectedAnswerDraft: collectServiceConnectedAnswers(");
    expect(clientSteps).toContain('draft[id] = answer;');
    expect(clientSteps).toContain('code: "answer-service-connected"');
    // The no-service-connected guidance re-renders Step 2 from browser-local
    // state, so that write must carry the veteran's already-given answers
    // forward — otherwise the re-rendered form wipes them.
    expect(clientSteps).toContain("serviceConnectedConditionIds: [],");
    expect(clientSteps).toContain('code: "no-service-connected"');
    expect(contextStore).toContain('serviceConnectedAnswerDraft: z.record(z.string(), z.enum(["yes", "no"])).optional()');
  });

  it("surfaces expected secondary form errors without generic server failures", () => {
    const diagnosed = read("src/components/secondary/steps/DiagnosedStep.tsx");
    const ratings = read("src/components/secondary/steps/RatingsStep.tsx");
    const uploadLayout = read("src/app/secondary/upload/layout.tsx");
    const clientSteps = read("src/lib/secondary-workflow/client-steps.ts");

    for (const source of [diagnosed, ratings]) {
      expect(source).toContain('role="alert"');
    }
    expect(ratings).toContain("required aria-describedby={validationId}");
    expect(uploadLayout).toContain('controlName="documentsShared"');
    expect(clientSteps).toContain('code: "select-diagnosed"');
    expect(clientSteps).toContain('code: "select-rating"');
    expect(clientSteps).toContain('code: "invalid-rating"');
    expect(clientSteps).toContain('code: "invalid-context"');
  });

  it("turns presumptive schema failures into fixed accessible error surfaces", () => {
    // 2026-10-08: presumptive service history is confirmed browser-locally, so
    // the fixed validation taxonomy now lives in the intake module and reaches
    // the user through inline alert regions instead of a redirect route.
    const history = read("src/lib/presumptive/browser-history.ts");
    const form = read("src/components/ServiceHistoryForm.tsx");
    const analyzer = read("src/components/presumptive/Dd214LocalAnalyzer.tsx");
    const page = read("src/app/presumptive/page.tsx");

    expect(history).toContain("serviceHistorySchema.safeParse");
    expect(history).toContain('return "date-order"');
    expect(history).toContain('return "invalid-date"');
    expect(history).toContain('return "select-location"');
    expect(history).not.toContain("serviceStart=${");
    expect(history).not.toContain("serviceEnd=${");
    expect(history).toContain(
      '"date-order": "Service start date must be on or before the end date."',
    );
    expect(form).toContain('role="alert"');
    expect(analyzer).toContain('role="alert"');
    expect(page).toContain('role="alert"');
    expect(page).toContain('id={validationId}');
    expect(page).toContain('role="group" aria-describedby={validationId}');
    expect(page).toContain("SERVICE_HISTORY_MESSAGES");
  });
});
