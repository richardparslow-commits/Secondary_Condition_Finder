import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * H-02 gate B (issue #538) — the callback-URL log scrubbing record, and the
 * documentation defect its closure exposed.
 *
 * Gate B stayed open on the belief that "whether the platform scrubs
 * `code`/`state` … is a hosting-account fact". It is not, and that belief is
 * the defect this suite pins in the fixed direction: the platform publishes
 * what its logs contain and documents no query-parameter scrubbing at all, so
 * the scrubbing half of the gate is answerable from the platform's terms. Only
 * the drain, the plan tier, the retention in force and who can read it are
 * account-side facts.
 *
 * Gate B therefore closed on a dated per-sink record of documented *behaviour*,
 * with the retained callback request line named as an accepted residual and the
 * gate's trigger kept intact. That kind of record fails in two directions, and
 * both are pinned here:
 *
 * 1. **Overclaiming.** A later edit can turn "the platform documents no
 *    scrubbing" into "scrubbing was reviewed", "the scrub rule is configured",
 *    or "retention was verified" — and every other suite would still pass. The
 *    record must keep saying that no scrub exists to configure, that no account
 *    was read, and that no retention value was established.
 * 2. **Discharging the trigger.** The gate's trigger is *credentialed hosted
 *    use*, which is not armed. A closure that accepts a retained `code` becomes
 *    permission to enable that use if the trigger is dropped, so the residual
 *    must stay explicitly *blocking* for it.
 *
 * The four defects pinned:
 *
 * 1. The register and the code-side inventory both called the platform's
 *    scrubbing behaviour a "hosting-account fact". The inventory now separates
 *    published platform behaviour from account-side facts, and the register
 *    records the correction rather than quietly dropping the claim.
 * 2. The inventory's gate B procedure told an operator to check "whether any
 *    configured scrubbing rule removes `code`, `state` or all query parameters"
 *    — an instruction with no honest negative answer — and its outcome menu
 *    offered only "confirmed not retained / confirmed scrubbed / retained and
 *    remediated". Both are corrected, and the accepted-residual outcome is
 *    named as the honest one where no scrub can be configured.
 * 3. The retention policy left it open to read as though a URL might be
 *    scrubbed before it is logged. It now says outright that it is not, for any
 *    request path and not only the callback.
 * 4. The report's H-02 finding described two reviews with no owner. It now
 *    carries a dated status separating "recorded from published behaviour" from
 *    "reviewed on the account" — and the §8 close-out box stays unchecked,
 *    because it asserts an operator review that never happened.
 */

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

const gates = read("docs/external-manual-gates-status.md");
const inventory = read("docs/hosting-log-and-callback-inventory.md");
const retention = read("docs/data-retention-policy.md");
const deployment = read("docs/deployment-readiness.md");
const security = read("docs/security-operations.md");
const report = read("VA_Lighthouse_Readiness_Report.md");
const addendum = read("docs/r08-audit-verification-addendum-2026-10-12.md");

/** Source text with line wrapping collapsed, so a reflow is not a diff. */
const flat = (source: string) => source.replace(/\s+/g, " ");

/** The gate B section of the register, up to the next gate heading. */
const section = gates.split("## Issue #538 — ")[1]?.split("\n## ")[0] ?? "";
const record = flat(section);
/** The register's summary table, up to the next level-two heading. */
const register = gates.split("## R-04 ownership register")[1]?.split("\n## ")[0] ?? "";

const GATE_B_STATUS = "CLOSED / RECORDED WITH RESIDUAL ACCEPTED";

describe("H-02 gate B — the per-sink scrubbing record (#538)", () => {
  it("records what the platform documents, per sink, on a date", () => {
    // The facts that make the scrubbing answer a platform fact rather than an
    // account secret. Lose any one of them and the record is asserting
    // something this repository cannot support.
    expect(record).toContain("search parameters");
    expect(record).toContain("proxy.path");
    expect(record).toContain("request path with query parameters");
    expect(record).toContain("IP hiding");
    expect(record).toContain("beforeSend");
    expect(record).toContain("No documented scrub");
    // Every sink is asked the question, including the two rows whose answer is
    // "never received".
    for (const sink of [
      "runtime / function logs",
      "log drain",
      "build logs",
      "Application sinks",
    ]) {
      expect(record, `gate B record no longer covers the ${sink} sink`).toContain(sink);
    }
    expect(section).toContain("2026-10-15");
  });

  it("cites each platform claim to the page it was read from", () => {
    // A behaviour claim the reader cannot re-read is the defect this gate
    // existed to remove, so the record must name retrievable sources rather
    // than assert the platform's behaviour from memory.
    for (const source of [
      "https://vercel.com/docs/logs/runtime",
      "https://vercel.com/docs/drains/reference/logs",
      "https://vercel.com/docs/drains/security",
      "https://vercel.com/docs/analytics/redacting-sensitive-data",
    ]) {
      expect(record, `gate B record lost its source ${source}`).toContain(source);
    }
    // And the quotes are marked as the platform's own wording, not paraphrase.
    expect(record).toContain("the quotes are the platform's own wording");
    expect(record).toMatch(/Search parameters of the request path/);
    expect(record).toMatch(/Request path with query parameters/);
    // Every source is dated, so a stale citation is visible as stale.
    expect(record).toMatch(/opened and read on \*\*2026-10-15\*\*/);
    // The inventory carries the same citations, so the two cannot disagree
    // about what the platform documents.
    for (const source of [
      "https://vercel.com/docs/logs/runtime",
      "https://vercel.com/docs/drains/reference/logs",
      "https://vercel.com/docs/drains/security",
      "https://vercel.com/docs/analytics/redacting-sensitive-data",
    ]) {
      expect(flat(inventory), `inventory lost its source ${source}`).toContain(source);
    }
  });

  it("carries each finding with an explicit disposition", () => {
    for (const finding of ["F1 —", "F2 —", "F3 —"]) {
      expect(record, `gate B lost finding ${finding}`).toContain(finding);
    }
    expect(record).toContain("Disposition");
    // F1 is a documented absence: nothing can be configured, so it is accepted
    // as a platform limitation rather than "remediated".
    expect(record).toMatch(/accepted as a platform limitation/);
    expect(record).toMatch(/no setting exists to enable/i);
    // F2's bound is reachability, proved by the 503 that precedes any read.
    expect(record).toContain("before reading any query parameter");
    expect(record).toContain("src/app/api/auth/callback/route.ts");
    // F3 is the single-use consumption that makes a retained code dead.
    expect(record).toContain("consumes it single-use before the token exchange");
    expect(record).toContain("src/lib/va/account/oauth.ts");
  });

  it("names the residual, keeps the trigger, and claims no account read", () => {
    expect(record).toMatch(/Residual accepted by the accountable owner on 2026-10-15/);
    expect(record).toContain("cannot be scrubbed through any documented setting");
    // The residual must stay blocking for the very event that would arm it.
    expect(record).toContain("blocking for credentialed hosted use");
    expect(record).toContain("credentialed hosted use");
    expect(record).toContain("not armed");
    expect(record).toContain("It is not a read of the hosting account");
    expect(record).toMatch(/Reopen\b.*original criterion/);
    expect(record).toContain("with dated readings and a named reviewer");
    // And it must not borrow language that only fits a performed review. The
    // one legitimate mention of that language is the negation, so remove it
    // and require that nothing else matches.
    expect(record).toContain("It is not a claim that scrubbing was configured");
    const withoutNegation = record.replace(
      /It is not a claim that scrubbing was configured, tested, or observed; the opposite is recorded\./g,
      "",
    );
    expect(withoutNegation).not.toMatch(/scrub(?:bing)? (?:was|is) (?:configured|verified|enabled|observed)/i);
    expect(record).not.toMatch(/confirmed scrubbed/i);
    expect(record).not.toMatch(/no query parameters (?:are|were) logged/i);
    expect(record).not.toMatch(/(?:retention|scrubbing) rule (?:was|is) (?:set|configured|in place)/i);
  });

  it("corrects the 'hosting-account fact' claim in the inventory and the register", () => {
    // The claim itself is what must not return: it made an answerable
    // platform fact look unknowable.
    expect(flat(inventory)).not.toContain("are hosting-account facts, not source facts");
    expect(flat(inventory)).toContain("Published platform behaviour");
    expect(flat(inventory)).toContain("Account facts (not readable from this repository");
    expect(flat(inventory)).toContain("only the second is an account reading");
    // And the register states which facts stayed account-side, so the split is
    // not left to the reader.
    expect(record).toContain("only the drain, plan-tier, retention and access facts are account-side");
    // The register records the correction instead of dropping the claim.
    expect(record).toContain("was wrong");
    expect(record).toMatch(/documents \*\*no\*\* query-parameter scrubbing/);
  });

  it("stops the gate B procedure looking for a scrubbing rule that cannot be configured", () => {
    // The old instruction, which had no honest negative answer.
    expect(flat(inventory)).not.toContain("whether any configured scrubbing rule removes");
    // Its replacement states the finding, then reads the account-side facts.
    expect(flat(inventory)).toContain("no query-parameter scrubbing for either");
    // And the outcome menu admits the honest outcome.
    expect(flat(inventory)).toContain("retained and **named as an accepted residual**");
    expect(flat(inventory)).toMatch(/retained and \*\*remediated\*\*/);
  });

  it("keeps the register, runbooks and report consistent on the closed state", () => {
    expect(section).toContain(GATE_B_STATUS);

    const row = register
      .split("\n")
      .find((line) => line.startsWith("| ") && line.includes("issues/538"));
    expect(row, "register lost its #538 row").toBeDefined();
    expect(row).toContain(GATE_B_STATUS);

    const runbookRow = deployment
      .split("## Known external verification boundaries")[1]
      ?.split("\n")
      .find((line) => line.startsWith("| ") && line.includes("issues/538"));
    expect(runbookRow, "runbook lost its #538 row").toBeDefined();
    expect(runbookRow).toContain(GATE_B_STATUS);
    expect(runbookRow).toContain("not a read of the hosting account");

    expect(security).toMatch(/- \*\*#538 — .*:\*\* CLOSED; Richard Parslow/);
    expect(security).toContain("no documented setting removes");

    expect(report).toContain("CLOSED / RECORDED WITH RESIDUAL ACCEPTED (H-02 gate B)");
  });

  it("stops the report marking H-02 resolved while neither record is an account read", () => {
    const box = report
      .split("\n")
      .find((line) => line.startsWith("- [") && line.includes("**H-02**"));
    expect(box, "report lost its H-02 close-out box").toBeDefined();
    expect(box!.startsWith("- [ ]"), "H-02 must not be ticked by a terms-level closure").toBe(true);
    expect(box).toContain("No operator review of the hosting account was performed");
    // The finding itself now carries a dated status, so the older "no owner, no
    // issue number" paragraph cannot be read as the current state.
    expect(flat(report)).toContain("Status update (2026-10-15)");
    expect(flat(report)).toContain("neither closure is a read of the hosting account");
    expect(flat(report)).toContain("accepted, not remediated");
  });

  it("stops the retention policy implying a URL is redacted before it is logged", () => {
    expect(flat(retention)).toContain("query-parameter redaction for runtime logs or for a drain");
    expect(flat(retention)).toMatch(
      /No record on this page therefore claims that a URL is scrubbed before it is logged/,
    );
  });

  it("keeps gate B from being read as discharging A01's live lookup text", () => {
    // The R-08 addendum owns a different request path — operator-run Finder
    // queries — and gate B must not silently absorb its residual.
    expect(flat(addendum)).toContain("stays open, and its operator half now reads as an accepted residual");
    expect(flat(addendum)).toMatch(/A Finder lookup string sent upstream .* has no such bound/);
    expect(flat(addendum)).toContain("still unaccepted");
  });
});
