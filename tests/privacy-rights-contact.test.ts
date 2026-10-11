import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// R-01 (VA Lighthouse readiness report §5.1, blocker B-02): the privacy policy
// must state a data-deletion right, a 45-day completion commitment, the narrow
// legal exceptions with a reason on any partial handling, and at least one
// working contact channel; the terms page must mirror a pointer to that route.
// These source scans keep the commitment from silently regressing the way the
// contrast and legal-notice guards do — a page rewrite that drops retention
// language fails here before it ships.

const privacy = readFileSync(resolve(process.cwd(), "src/app/privacy/page.tsx"), "utf8");
const terms = readFileSync(resolve(process.cwd(), "src/app/terms/page.tsx"), "utf8");

describe("privacy policy deletion right and contact channel (R-01 / B-02)", () => {
  it("has a privacy-rights section with a deletion right and the 45-day commitment", () => {
    expect(privacy).toMatch(/Your privacy rights and how to contact us/);
    expect(privacy).toMatch(/<strong(?:[^>]*)>Deletion of account-associated data\.<\/strong>/);
    expect(privacy).toContain("within <strong>45 days</strong>");
  });

  it("qualifies the commitment with the statutory exceptions and partial-handling reasons", () => {
    expect(privacy).toContain("retain by law");
    expect(privacy).toContain("36 CFR Chapter XII");
    expect(privacy).toContain("Title 38");
    expect(privacy).toMatch(/partial (or)|completed only in part|refused/);
  });

  it("still distinguishes what deletion does not cover instead of overclaiming", () => {
    expect(privacy).toMatch(/What deletion does and does not cover/);
    expect(privacy).toMatch(/under your control through the in-app clearing controls/);
    expect(privacy).toMatch(/operator log-retention review/);
  });

  it("provides a working contact channel beyond VA's own resources", () => {
    // A mailbox the operator monitors — the actual intake path for requests.
    expect(privacy).toMatch(/mailto:privacy@secondaryconditionfinder\.org/);
    expect(privacy).toMatch(/human handling each request/);
    // VA resources are provided for completeness, not as this app's intake.
    expect(privacy).toContain("https://www.va.gov/privacy/");
    expect(privacy).not.toMatch(/mailto:(privacy|info)@va\.gov/);
    expect(privacy).toMatch(/not a privacy-request intake channel/);
  });

  it("keeps the intake promise honest about being email-based", () => {
    expect(privacy).toMatch(/accept requests by email and by phone/);
  });

  it("numbers the rights section before Policy changes", () => {
    const rightsIndex = privacy.indexOf("8. Your privacy rights and how to contact us");
    const changesIndex = privacy.indexOf("9. Policy changes");
    expect(rightsIndex).toBeGreaterThan(-1);
    expect(changesIndex).toBeGreaterThan(rightsIndex);
  });

  it("mirrors a deletion/contact pointer into the terms page §7 cross-reference", () => {
    expect(terms).toContain("45-day");
    expect(terms).toContain("data-deletion right");
    expect(terms).toContain("8. Your privacy rights and how to contact us");
    // The pointer lives in the privacy cross-reference section, not §1.
    expect(terms).toMatch(/7\. Privacy and Local Evidence Handling/);
  });

  it("does not claim an intake form or postal channel that does not exist", () => {
    expect(privacy).not.toMatch(/request form|postal (address|mail)|PO Box/);
    expect(privacy).not.toMatch(/within (3|7|14|30) days/);
  });
});
