import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("Step 2 mobile validation ownership", () => {
  it("lets the application validator handle incomplete radio groups", () => {
    const step = source("src/components/secondary/steps/ServiceConnectedStep.tsx");
    const clientSteps = source("src/lib/secondary-workflow/client-steps.ts");

    expect(step).toContain("serviceConnected-${condition.id}");
    expect(step).not.toMatch(/value="yes"\s+required/);
    expect(step).not.toMatch(/value="no"\s+required/);

    expect(clientSteps).toContain('answer !== "yes" && answer !== "no"');
    expect(clientSteps).toContain('code: "answer-service-connected"');
    // The mobile behavior is now a client-side validation message instead of
    // a redirect; the message text is the same shared copy.
    expect(step).toContain("SECONDARY_VALIDATION_MESSAGES[localError]");
  });
});
