import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { PRIVACY_CONTACT_EMAIL } from "@/lib/privacy/intake";

// R-04 gate C / issue #539 (R-01 §9): the operator sign-off gate for the
// privacy policy's deletion-right language. Its completion criterion names five
// things — recorded approver name/affiliation/decision/date, a verified live
// monitored contact channel, a named handler, a fulfilment procedure, and a
// sanitized send/receive-test outcome.
//
// On 2026-10-15 three of those five were recorded and two were found to be
// false rather than merely unrecorded: the one published privacy-request
// address, `privacy@secondaryconditionfinder.org`, is at a domain that does not
// exist in DNS (NXDOMAIN from the `.org` registry itself), so no request can
// reach it and no send/receive test can run.
//
// This suite is the guard for that state. Its job is not to keep the gate open
// — a maintainer who genuinely registers the domain, operates the mailbox and
// runs the test should be able to close it — but to make each of the three
// possible dishonest shortcuts fail loudly:
//
//   1. recording the channel as verified, or the test as run, without the
//      evidence (the finding and the unrecorded outcome are pinned);
//   2. closing the gate by deleting the finding instead of resolving it (the
//      closure checklist's two unchecked items are pinned as such); and
//   3. letting the documents drift apart, so that one surface still tells a
//      Veteran to use an address another surface has already recorded as dead.
//
// Everything here is text. No test can verify a mailbox, and none claims to.

const read = (...segments: string[]): string =>
  readFileSync(resolve(process.cwd(), ...segments), "utf8");

const procedure = read("docs", "privacy-request-fulfilment-procedure.md");
const register = read("docs", "external-manual-gates-status.md");
const retention = read("docs", "data-retention-policy.md");
const securityOps = read("docs", "security-operations.md");
const deploymentReadiness = read("docs", "deployment-readiness.md");
const accessPackage = read("docs", "phase3-production-access-package.md");
const report = read("VA_Lighthouse_Readiness_Report.md");

/** Source text with line wrapping collapsed, so a Prettier reflow is not a diff. */
const flat = (source: string): string => source.replace(/\s+/g, " ");

/** The register's gate C record, in isolation from the other gate sections. */
const gateCSection = (() => {
  const start = register.indexOf(
    "## Issue #539 — privacy-policy deletion-right language",
  );
  expect(start, "the register must still carry a gate C record for #539").toBeGreaterThan(-1);
  const end = register.indexOf("\n## ", start + 1);
  return flat(register.slice(start, end === -1 ? undefined : end));
})();

const closureChecklist = (() => {
  const start = procedure.indexOf("## 9. Closing gate C");
  expect(start, "the procedure must still carry its closure checklist").toBeGreaterThan(-1);
  return procedure.slice(start);
})();

describe("the published privacy channel is a dated finding, not a verified channel (#539)", () => {
  it("retains the formerly published address in the dated finding", () => {
    // The finding is about one specific address. If the historical PRIVACY_CONTACT_EMAIL ever
    // changes, this suite must be updated with the same deliberation as the
    // policy itself — a finding about a different address is no finding.
    expect(PRIVACY_CONTACT_EMAIL).toBe("privacy@secondaryconditionfinder.org");
    expect(gateCSection).toContain(PRIVACY_CONTACT_EMAIL);
    expect(procedure).toContain(PRIVACY_CONTACT_EMAIL);
  });

  it("records the finding with its readings, not as an impression", () => {
    expect(gateCSection).toContain(
      "**Channel finding (2026-10-15) — the published intake address is at a domain that does not exist in DNS.**",
    );
    // The evidence that makes this conclusive rather than a resolver glitch:
    // the registry's own SOA as authority, two independent resolvers, no
    // registration record, and a control name that resolves normally.
    expect(gateCSection).toContain("**NXDOMAIN** (RCODE 3)");
    expect(gateCSection).toContain("**`.org` registry's own SOA**");
    expect(gateCSection).toContain(
      "from two independent DNS-over-HTTPS resolvers (Cloudflare and Google)",
    );
    expect(gateCSection).toContain("`RDAP` and `whois` return **no domain record**");
    expect(gateCSection).toContain(
      "the control name `vercel.com` resolves normally with five MX answers",
    );
    // The environment's SERVFAIL is disclosed as an observation and explicitly
    // not relied on, so the record cannot be read as citing a weaker signal.
    expect(gateCSection).toContain(
      "recorded because it was observed, not because it is relied on",
    );
  });

  it("states the consequence for a Veteran plainly, and does not call it a doc fix", () => {
    expect(gateCSection).toContain(
      "**A Veteran who follows the published instruction therefore reaches nobody**",
    );
    expect(gateCSection).toContain(
      "the 45-day commitment cannot start because nothing arrives",
    );
    // The distinction that decides who can close this: a repository edit cannot.
    expect(gateCSection).toContain(
      "it is **not** a documentation defect: no edit to this repository makes the address resolve.",
    );
    expect(procedure).toContain("**This one is not a documentation defect**");
  });

  it("records the owner's decision to make the promise deliverable rather than rewrite it", () => {
    expect(gateCSection).toContain("**Owner decision (2026-10-15).**");
    expect(gateCSection).toContain(
      "Register the domain and operate a mailbox at the published address, so the published promise becomes deliverable rather than being rewritten",
    );
    // The decision is the reason the policy text is unchanged by the finding.
    expect(procedure).toContain("The policy text is therefore unchanged by this");
  });
});

describe("gate C's named handler and fulfilment procedure (#539)", () => {
  it("names a person, with a continuity rule instead of a role", () => {
    expect(procedure).toContain(
      "**Named handler: Richard Parslow (`richardparslow-commits`)**",
    );
    expect(procedure).toContain("This is a named\nperson, not a role or a queue.");
    expect(procedure).toContain(
      "the replacement is recorded\nas a named successor in the issue and the register before the promise is left\nunowned",
    );
    expect(gateCSection).toContain("**Fulfilment procedure and named handler (2026-10-15).**");
  });

  it("records the handling steps and the 45-day clock's start point", () => {
    expect(flat(procedure)).toContain(
      "The clock starts when the message arrives, not when identity is verified.",
    );
    expect(procedure).toContain("not when identity is verified");
    for (const step of [
      "1. **Acknowledge**",
      "2. **Verify identity only when needed**",
      "3. **Determine the scope**",
      "4. **Act**",
      "5. **State what is retained and why**",
      "6. **Complete within 45 days**",
      "7. **Confirm completion in the same thread**",
      "8. **Record a sanitized outcome**",
      "9. **Escalate on unavailability**",
    ]) {
      expect(procedure, `missing handling step: ${step}`).toContain(step);
    }
    // The retention authority a partial completion must name, in the policy's
    // own words — a handler may not paraphrase it.
    expect(procedure).toContain("36 CFR Chapter XII");
    expect(procedure).toContain("Title 38, United States Code");
  });

  it("bounds what may be written down, so the record cannot become a second store", () => {
    expect(procedure).toContain("**Never recorded:**");
    for (const forbidden of [
      "the requester's name, email address, or any identifier",
      "any health\ninformation",
      "no log excerpt, URL with a query string, code, state, token, or\ncookie",
    ]) {
      expect(procedure).toContain(forbidden);
    }
    expect(procedure).toContain("not to become a second store");
  });

  it("states the honest scope of what a deletion request can reach", () => {
    const digest = flat(procedure);
    // The two limits that a reader is most likely to expect the other way:
    // browser-local state is the requester's own, and platform logs are not
    // host-independent deletion.
    expect(digest).toContain("**Nothing to delete on the requester's behalf.**");
    expect(digest).toContain("not by host-independent deletion");
  });
});

describe("gate C's closure checklist holds the gate open until the channel works", () => {
  it("keeps exactly the two channel items unchecked and the rest checked", () => {
    const unchecked = closureChecklist.match(/^- \[ \]/gm) ?? [];
    const checked = closureChecklist.match(/^- \[x\]/gm) ?? [];
    expect(unchecked).toHaveLength(2);
    expect(checked).toHaveLength(4);
    expect(closureChecklist).toContain("**The channel resolves and receives mail**");
    expect(closureChecklist).toContain("**The sanitized send/receive test outcome recorded**");
    expect(closureChecklist).toContain("currently");
    expect(closureChecklist).toContain("unmet");
    expect(closureChecklist).toContain(
      "The two unchecked lines are the whole remaining gate.",
    );
  });

  it("makes the registration checklist the verifiable route to closing", () => {
    const checklist = procedure.slice(
      procedure.indexOf("## 8. Registration and mailbox checklist"),
      procedure.indexOf("## 9. Closing gate C"),
    );
    // Register, create the mailbox, publish MX, then test from outside the
    // domain — the order matters because a test cannot precede the mailbox.
    expect(checklist).toContain("Register `secondaryconditionfinder.org`");
    expect(checklist).toContain("Create a mailbox at `privacy@secondaryconditionfinder.org`");
    expect(checklist).toContain("Publish MX records for the domain");
    expect(checklist).toContain("**from a mailbox outside the domain**");
    expect(checklist).toContain("Record the **sanitized send/receive outcome**");
    expect(flat(checklist)).toContain("superseded by evidence rather than by assertion");
    expect(flat(checklist)).toContain(
      "The repository can record them; it cannot perform them.",
    );
  });

  it("says what may not be transposed into the gate C record", () => {
    expect(gateCSection).toContain("**What this record does not claim.**");
    expect(gateCSection).toContain(
      "It does not claim the mailbox is live or monitored, that any request has been received or answered, that a send/receive test has been run",
    );
    // The two halves are different facts, and the record must not merge them.
    expect(gateCSection).toContain(
      "approving published language and operating a mailbox are different facts, the first is now recorded, and the second is not.",
    );
    expect(gateCSection).toContain("**false rather than unverified**");
  });
});

describe("every surface that tells a Veteran where to write carries the finding (#539)", () => {
  it("keeps the register, the report, the package and the ops docs on one status", () => {
    for (const [name, doc] of [
      ["register", register],
      ["report", report],
      ["production-access package", accessPackage],
      ["security operations", securityOps],
      ["deployment readiness", deploymentReadiness],
    ] as const) {
      expect(flat(doc), `${name} must record the channel-unverified status`).toContain(
        "OPEN / CHANNEL UNVERIFIED",
      );
    }
  });

  it("links the retention policy's gate C anchor to a heading that exists", () => {
    // A dead cross-document anchor is a silent way to lose the finding: the
    // retention policy is where a requester reads the deletion right, and its
    // pointer has to land on the gate C record. Derive the GitHub slug from the
    // heading rather than trusting the literal, so renaming the section fails
    // here instead of quietly breaking the link.
    const heading =
      "Issue #539 — privacy-policy deletion-right language operator sign-off (R-01 §9)";
    const slug = heading
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s/g, "-");
    expect(slug).toBe(
      "issue-539--privacy-policy-deletion-right-language-operator-sign-off-r-01-9",
    );
    expect(register).toContain(`## ${heading}`);
    expect(retention).toContain(`external-manual-gates-status.md#${slug}`);
  });

  it("retains the historical delivery finding and configured-channel requirement in the retention policy", () => {
    const policy = flat(retention);
    expect(policy).toContain("**Historical delivery finding**");
    expect(policy).toContain("so a message sent to it arrives nowhere");
    expect(policy).toContain("no request has been received under it");
    // The retention policy is the document a requester reads for the deletion
    // right, so it must carry the finding rather than assuming the policy page
    // has been read.
    expect(policy).toContain("gate C record");
    expect(policy).toContain("privacy-request-fulfilment-procedure.md");
  });

  it("leaves the report's B-02 close-out unchecked while the address is dead", () => {
    const readiness = flat(report);
    expect(readiness).toContain(
      "The published *address* is the gap: `privacy@secondaryconditionfinder.org` is at a domain that does not resolve (NXDOMAIN, 2026-10-15), so the channel half of B-02 is unmet",
    );
    expect(readiness).toContain(
      "the channel half of B-02 is unmet",
    );
    // The §9 matrix records the approval without claiming it closes the issue.
    expect(readiness).toContain(
      "That row does **not** close issue [#539](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/539)",
    );
    // And the package keeps the gate as a submission blocker, in the
    // conditional sense: it closes when the address actually receives mail.
    expect(flat(accessPackage)).toContain(
      "**and the published privacy-request address actually receives mail** — it does not today",
    );
  });
});
