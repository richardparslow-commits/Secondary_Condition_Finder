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

  it("requires explicit neutral service-connected answers and preserves partial answers in the encrypted session", () => {
    const page = read("src/app/secondary/service-connected/page.tsx");
    const actions = read("src/lib/actions/secondary.ts");
    const session = read("src/lib/secondary-workflow/session.ts");

    expect(page).not.toMatch(/value="yes"\s+required/);
    expect(page).not.toMatch(/value="no"\s+required/);
    expect(page).not.toContain("hasPriorSelection ? selectedServiceConnectedIds.has(condition.id) : true");
    expect(page).toContain('answerDraft ? answerDraft[condition.id] === "yes"');
    expect(page).toContain('answerDraft ? answerDraft[condition.id] === "no"');
    expect(page).toContain('role="alert"');
    expect(actions).toContain("knownConditionIds.has(id)");
    expect(actions).toContain("delete currentParams.serviceConnected");
    expect(actions).toContain('answer !== "yes" && answer !== "no"');
    expect(actions).toContain('const serviceConnectedAnswerDraft: Record<string, "yes" | "no"> = {}');
    expect(actions).toContain("serviceConnectedAnswerDraft[id] = answer");
    expect(actions).toContain('redirectValidation("/secondary/service-connected", "answer-service-connected")');
    expect(actions).toContain("serviceConnectedConditionIds: [],");
    // The no-service-connected guidance re-renders Step 2 from session state,
    // so that write must carry the veteran's already-given answers forward —
    // otherwise the re-rendered form wipes them (uncontrolled radios render
    // from server-provided defaults, not browser memory).
    expect(actions).toContain("serviceConnectedAnswerDraft: carriedDraft,");
    expect(actions).toContain('redirectValidation("/secondary/service-connected", "no-service-connected")');
    expect(session).toContain('serviceConnectedAnswerDraft: z.record(z.string(), z.enum(["yes", "no"])).optional()');
  });

  it("surfaces expected secondary form errors without generic server failures", () => {
    const diagnosed = read("src/app/secondary/diagnosed/page.tsx");
    const ratings = read("src/app/secondary/ratings/page.tsx");
    const uploadLayout = read("src/app/secondary/upload/layout.tsx");
    const actions = read("src/lib/actions/secondary.ts");

    expect(diagnosed).toContain('role="alert"');
    expect(ratings).toContain('role="alert"');
    expect(ratings).toContain("required aria-describedby={validationId}");
    expect(uploadLayout).toContain('controlName="documentsShared"');
    expect(actions).toContain('redirectValidation("/secondary/diagnosed", "select-diagnosed")');
    expect(actions).toContain('redirectValidation("/secondary/ratings", "select-rating")');
    expect(actions).toContain('redirectValidation("/secondary/ratings", "invalid-rating")');
    expect(actions).toContain('redirectValidation("/secondary/upload", "invalid-context")');
  });

  it("turns presumptive schema failures into fixed accessible error routes", () => {
    const actions = read("src/lib/actions/presumptive.ts");
    const page = read("src/app/presumptive/page.tsx");

    expect(actions).toContain("serviceHistorySchema.safeParse");
    expect(actions).toContain('validationPath("date-order")');
    expect(actions).toContain('validationPath("invalid-date")');
    expect(actions).not.toContain("serviceStart=${");
    expect(actions).not.toContain("serviceEnd=${");
    expect(page).toContain('role="alert"');
    expect(page).toContain('id={validationId}');
    expect(page).toContain('role="group" aria-describedby={validationId}');
    expect(page).toContain('"date-order": "Service start date must be on or before the end date."');
  });
});
