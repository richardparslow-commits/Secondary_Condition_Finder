import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { PRIVACY_COMPLETION_DAYS, PRIVACY_CONTACT_EMAIL } from "@/lib/privacy/intake";

// R-01 (VA Lighthouse readiness report §5.1, blocker B-02): the privacy policy
// must state a data-deletion right, a 45-day completion commitment, the narrow
// legal exceptions with a reason on any partial handling, and at least one
// working contact channel; the terms page must mirror a pointer to that route.
// These source scans keep the commitment from silently regressing the way the
// contrast and legal-notice guards do — a page rewrite that drops retention
// language fails here before it ships.
//
// Two additions make this suite the sign-off guard for issue #539 rather than
// only a text guard:
//
//   1. **The signed clauses are pinned verbatim.** The gate's stated risk is
//      that language under operator/legal approval "could be silently revised",
//      and substring pins do not stop that: a rewrite can keep every marker
//      while changing the promise. Each clause below is therefore asserted as
//      the exact sentence the approver is being asked to accept. Changing one is
//      allowed — but only deliberately, by editing the pin, which is the point
//      at which someone has to re-read it as the signed text.
//   2. **The sign-off surfaces must be able to carry the criterion's facts.**
//      The report matrix and the production-access package have to name full
//      name, affiliation, decision and date, and must state that no approval is
//      recorded. A filled-in row fails this suite, so closing #539 requires
//      touching the record deliberately instead of by accreting prose.
//
// Everything here is repository-side. No approver, decision, date, mailbox
// liveness result, named handler or send/receive outcome is recorded, and no
// test can manufacture one: the human half of #539 stays human.

const privacy = readFileSync(resolve(process.cwd(), "src/app/privacy/page.tsx"), "utf8");
const terms = readFileSync(resolve(process.cwd(), "src/app/terms/page.tsx"), "utf8");
const intakePage = readFileSync(resolve(process.cwd(), "src/app/privacy/request/page.tsx"), "utf8");
const retention = readFileSync(resolve(process.cwd(), "docs/data-retention-policy.md"), "utf8");
const report = readFileSync(resolve(process.cwd(), "VA_Lighthouse_Readiness_Report.md"), "utf8");
const accessPackage = readFileSync(
  resolve(process.cwd(), "docs/phase3-production-access-package.md"),
  "utf8",
);

/** Source text with line wrapping collapsed, so a Prettier reflow is not a diff. */
const flat = (source: string): string => source.replace(/\s+/g, " ");

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

  it("claims only the intake channels this application actually operates", () => {
    // The published promise is email. The policy previously read "the contact
    // channels below accept requests by email and by phone", while the only
    // number it publishes is VA's benefits line — which the same paragraph
    // labels as not an intake channel for this application. That is a channel
    // claim with nothing behind it, which is the failure mode B-02 exists to
    // prevent, so the honest form is pinned and the old claim is banned.
    expect(flat(privacy)).toContain(
      "requests are accepted by email at the monitored address below",
    );
    expect(flat(privacy)).not.toMatch(/by email and by phone/);
    expect(flat(privacy)).not.toMatch(/requests? by (?:tele)?phone/);
    // The accessibility intent survives the correction: a requester may still
    // state a preferred contact method.
    expect(flat(privacy)).toContain(
      "an assistive-technology user may state a preferred contact method in the first message",
    );
    // The only phone number published is VA's, and it stays labeled as such.
    expect(flat(privacy)).toContain("1-800-827-1000");
    expect(flat(privacy)).toContain("not a privacy-request intake channel");
  });

  it("keeps the intake promise honest about being email-based", () => {
    expect(privacy).toMatch(/requests are accepted by email/);
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

  it("points at the intake path a visitor can actually start a request from", () => {
    // R-01 also requires a working intake path: the policy must name the route
    // that prepares a request, and that route must not ship a placeholder.
    expect(privacy).toContain('href="/privacy/request"');
    expect(privacy).not.toMatch(/REPLACE_WITH/);
    expect(terms).toContain('href="/privacy/request"');
  });

  it("does not claim an intake form or postal channel that does not exist", () => {
    expect(privacy).not.toMatch(/request form|postal (address|mail)|PO Box/);
    expect(privacy).not.toMatch(/within (3|7|14|30) days/);
  });

  it("pins the signed clauses verbatim, so a rewrite is a deliberate act", () => {
    // Each string below is the exact text the operator/privacy approver is
    // asked to accept under issue #539. If one of these fails, the policy's
    // signed language changed: re-read it as the promise a Veteran will rely
    // on, then update the pin — do not paraphrase the assertion to fit the
    // new text.
    const signed = flat(privacy);

    expect(signed).toContain(
      "<strong>Deletion of account-associated data.</strong> Data the application holds in association with a connected account (the server-side session record described in section 6) can be removed by disconnecting the session, and a Veteran may additionally request permanent deletion of any remaining account-associated operational or session data held by this application.",
    );
    expect(signed).toContain(
      "Requests are completed, including completion of constituent partial requests, within <strong>45 days</strong>.",
    );
    expect(signed).toContain(
      "The narrow exceptions are records this application, its operator, or VA must retain by law — records kept under 36 CFR Chapter XII (National Archives and Records Administration recordkeeping) and VA recordkeeping obligations under Title 38, United States Code — and, when a deletion is completed only in part or refused, a reason for that partial handling is provided in the same confirmation.",
    );
    expect(signed).toContain(
      "<strong>What deletion does and does not cover.</strong> Data stored in your browser tab (workflow state, local evidence excerpts, OCR checkpoints) is under your control through the in-app clearing controls and closing the tab; it is not held by this application, so a deletion request grants nothing new for it.",
    );
    expect(signed).toContain(
      "Hosting-platform request and operational logs are covered by the operator log-retention review, not host-independent deletion.",
    );
    expect(signed).toContain(
      `mailto:${PRIVACY_CONTACT_EMAIL}`,
    );
    expect(signed).toContain(
      "a monitored mail route with a human handling each request; you will receive acknowledgment and a completion confirmation by the same channel.",
    );
    expect(signed).toContain(
      "(VA benefits main line; not a privacy-request intake channel).",
    );
  });

  it("states one commitment, not two, wherever the number is published", () => {
    // The policy states the commitment in prose; the intake page renders it
    // from the module constant. Two independent copies of the number on one
    // page is how a page ends up saying "60 days" next to "45 days".
    expect(flat(privacy)).toContain("within <strong>45 days</strong>");
    expect(intakePage).toContain("{PRIVACY_COMPLETION_DAYS}");
    expect(intakePage).not.toMatch(/within \d+ days/);
    expect(PRIVACY_COMPLETION_DAYS).toBe(45);
  });

  it("routes the retention policy's deletion section at the published channel, not a security report", () => {
    // Before this change the retention policy told a reader to "file a request
    // through the channel in SECURITY.md", which is not the published privacy
    // channel and carries an incident-reporting process. The deletion right is
    // one promise across three documents; they have to agree.
    const policy = flat(retention);
    expect(policy).toContain(PRIVACY_CONTACT_EMAIL);
    expect(policy).toContain("/privacy/request");
    expect(policy).toContain("within 45 days");
    expect(policy).toContain("36 CFR Chapter XII");
    expect(policy).toContain("operator log-retention review");
    // Security reports stay a separate channel, and that separation is stated.
    expect(policy).toContain("SECURITY.md");
    expect(policy).toMatch(/not the privacy-request channel/);
  });

  it("gives the sign-off surfaces the fields gate #539 requires, with nothing recorded", () => {
    const matrix = flat(report);
    expect(matrix).toContain("| Organization / affiliation |");
    expect(matrix).toContain(
      "https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/539",
    );
    expect(matrix).toContain("☐ Accept the deletion right and the 45-day commitment as published");
    expect(matrix).toContain("No approval is recorded in this matrix.");

    const pkg = flat(accessPackage);
    expect(pkg).toContain("## Privacy approval and monitored contact");
    for (const field of [
      "Approver full name",
      "Approver organization / affiliation",
      "Decision on the deletion right and the 45-day commitment",
      "Decision date",
      "Monitored contact channel confirmed live",
      "Named handler for the channel",
      "Sanitized send/receive test outcome and fulfillment procedure",
    ]) {
      expect(pkg).toContain(field);
    }
    // Every field is recorded as unset. A filled cell fails here on purpose:
    // recording an approver is the human step, and it must be a deliberate
    // change to this pin and to the register, not a quiet edit.
    // Read the rows from the unflattened source: flattening collapses newlines,
    // and these cells are one per line by construction.
    const rows = accessPackage.split("| Field | Recorded value |")[1]?.split("\n## ")[0] ?? "";
    const recordedCells = rows
      .split("\n")
      .filter((line) => line.startsWith("| ") && !line.includes("---"))
      .map((line) => line.split("|").slice(2).join("|"));
    expect(recordedCells.length).toBeGreaterThanOrEqual(7);
    for (const cell of recordedCells) {
      expect(cell, "every sign-off field must read as unrecorded").toMatch(/\(not recorded/);
    }
    // The package also has to list the gate as a submission blocker.
    expect(pkg).toContain("issue #539 has the operator/privacy approval recorded above");
  });
});
