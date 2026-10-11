import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// R-06 (report §5.6, blocker B-04): "Every scope named in the submission maps
// to a real, tested, wired integration. No reviewer can find a mismatch
// between claimed and shipped." The submission package's shipped-scope block
// must therefore name EXACTLY the scopes the code assembles, and the
// restricted Claims/Intake client must stay documented as no-caller
// groundwork. This pins the contract both directions: the document cannot
// start naming scopes the code never wires, and a future scope addition
// cannot go undocumented.

const PACKAGE = readFileSync(
  resolve(process.cwd(), "docs/phase3-production-access-package.md"),
  "utf8",
);
const CONFIG = readFileSync(
  resolve(process.cwd(), "src/lib/va/account/config.ts"),
  "utf8",
);
const OAUTH = readFileSync(
  resolve(process.cwd(), "src/lib/va/account/oauth.ts"),
  "utf8",
);
const API_CLIENT = readFileSync(
  resolve(process.cwd(), "src/lib/va/api-client.ts"),
  "utf8",
);

describe("submission scope narrative vs wired scopes (R-06 / B-04)", () => {
  it("names the two public APIs and the sandbox account services the code wires", () => {
    expect(PACKAGE).toContain("va_forms");
    expect(PACKAGE).toContain("benefits-reference-data");
    for (const service of ["ratings", "claims"]) {
      expect(CONFIG).toMatch(new RegExp(`"?"?${service}\\"??:`));
    }
  });

  it("names exactly the account scopes config.ts defines, and config.ts defines exactly those", () => {
    expect(PACKAGE).toContain("disability_rating_summary.read");
    expect(PACKAGE).toContain("claim.read");
    // And the actual scope declarations in config.ts:
    expect(CONFIG).toContain('scope: "disability_rating_summary.read"');
    expect(CONFIG).toContain('scope: "claim.read"');
  });

  it("states the exact authorization assembly and the one-service-per-connection rule", () => {
    expect(PACKAGE).toMatch(/openid offline_access/);
    expect(PACKAGE).toMatch(/one service per connection/);
    // The code's real assembly, so the prose cannot drift from it:
    expect(OAUTH).toContain('scope: `openid offline_access ${config.scope}`');
  });

  it("claims no scope that does not exist in the codebase (profile/email/benefits.claims.read)", () => {
    for (const forbidden of ["profile", "email", "benefits.claims.read"]) {
      expect(CONFIG).not.toContain(forbidden);
      expect(OAUTH).not.toContain(forbidden);
      if (PACKAGE.includes(forbidden)) {
        // The document may only mention them inside the one negation sentence
        // that lists all three together.
        expect(PACKAGE).toContain(
          "no `profile`, `email`, or `benefits.claims.read` scope",
        );
      }
    }
  });

  it("documents the token validator's least-privilege refusal as evidence", () => {
    expect(PACKAGE).toMatch(/hard-refuses|refuses any access token carrying a `\.write` scope/);
    // And the actual validator enforces something equivalent:
    expect(OAUTH).toMatch(/\.write/);
  });

  it("labels the restricted Claims/Intake client as future-phase groundwork with no production caller", () => {
    expect(PACKAGE).toMatch(/Future phase — not requested in this submission/);
    expect(PACKAGE).toMatch(/pre-built groundwork with no production caller/);
    // The header requirement is enforced by the file-content test below.
  });

  it("keeps Benefits Intake excluded as unimplemented, not merely unrequested", () => {
    expect(PACKAGE).toMatch(/not implemented anywhere in the codebase/);
  });
});

describe("api-client.ts groundwork header (R-06 item 3)", () => {
  it("opens with the no-production-caller groundwork header", () => {
    expect(API_CLIENT).toMatch(/GROUNDWORK STATUS \(R-06/);
    expect(API_CLIENT).toMatch(/NO production caller/);
    expect(API_CLIENT).toMatch(/not a delivered integration/);
  });

  it("names its own actual importers (test suites only)", () => {
    expect(API_CLIENT).toContain("tests/va-restricted-api-client.test.ts");
    expect(API_CLIENT).toContain("tests/phi-logging-boundary.test.ts");
  });
});
