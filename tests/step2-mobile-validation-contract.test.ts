import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("Step 2 mobile validation ownership", () => {
  it("lets the application validator handle incomplete radio groups", () => {
    const page = source("src/app/secondary/service-connected/page.tsx");
    const actions = source("src/app/secondary/actions.ts");

    expect(page).toContain("serviceConnected-${condition.id}");
    expect(page).not.toMatch(/value="yes"\s+required/);
    expect(page).not.toMatch(/value="no"\s+required/);

    expect(actions).toContain('answer !== "yes" && answer !== "no"');
    expect(actions).toContain('redirectValidation("/secondary/service-connected", "answer-service-connected")');
  });
});
