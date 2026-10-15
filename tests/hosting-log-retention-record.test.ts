import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * H-02 gate A (issue #537) — the hosting log retention and access-control
 * record, and the documentation defects its closure exposed.
 *
 * The gate's operator half needs the hosting account: the plan tier, whether
 * Observability Plus is enabled, whether a log drain exists, and the team's
 * role/2FA/SSO state. None of that is readable from this repository, and no
 * hosting-account credential exists here, so gate A closed on a dated review of
 * the platform's *published* terms with those unread facts named and accepted.
 * That makes the record unusually easy to corrupt in one direction: a future
 * edit can quietly restate the accepted residual as a verified retention
 * value, or drop the "not established" caveat, and every other suite would
 * still pass.
 *
 * This suite pins the four defects the closure exposed, each of which is a
 * claim the repository used to make and could not support:
 *
 * 1. `docs/data-retention-policy.md` published a single "30 days hot" figure
 *    for the platform sink. The platform's own documentation makes that wrong
 *    twice over: build logs are stored indefinitely per deployment, and the
 *    runtime-log figure is plan-specific (hours on the small plans).
 * 2. The register inferred "no log drain, therefore only the provider's own
 *    logs" from an absent `vercel.json`. Drains are configured in the hosting
 *    account's dashboard or API, never in that file, so the file tree cannot
 *    answer the question — and a drain is precisely the sink that would carry
 *    request paths with their query strings.
 * 3. The gate's trigger was recorded as "before the production-access
 *    submission" when the report's criterion is "before credentialed hosted
 *    use" — a different event, and the one that decides whether the gate is
 *    armed. (It is not: the account sandbox is opt-in only.)
 * 4. A closure is where a record is most likely to overclaim. So the closure
 *    must state what it could not read, H-02 must stay incomplete while gate B
 *    is open, and the retention actually in force must stay unestablished.
 */

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

const gates = read("docs/external-manual-gates-status.md");
const retention = read("docs/data-retention-policy.md");
const inventory = read("docs/hosting-log-and-callback-inventory.md");
const deployment = read("docs/deployment-readiness.md");
const security = read("docs/security-operations.md");
const report = read("VA_Lighthouse_Readiness_Report.md");

/** Source text with line wrapping collapsed, so a reflow is not a diff. */
const flat = (source: string) => source.replace(/\s+/g, " ");

/** The gate A section of the register, up to the next gate heading. */
const section = gates.split("## Issue #537 — ")[1]?.split("\n## ")[0] ?? "";
/** The register's summary table, up to the next level-two heading. */
const register = gates.split("## R-04 ownership register")[1]?.split("\n## ")[0] ?? "";

const GATE_A_STATUS = "CLOSED / RECORDED WITH RESIDUAL ACCEPTED";

describe("H-02 gate A — the per-sink record (#537)", () => {
  it("carries the gate's criterion facts per sink, from the platform's published terms", () => {
    const record = flat(section);
    // Retention, access and redaction: the three facts the issue names.
    expect(record).toContain("Published retention");
    expect(record).toContain("Read / export access");
    expect(record).toContain("Redaction and data handling");
    // Each sink that can receive an application record, and the two figures
    // that make the tier dependency unavoidable.
    expect(record).toContain("Runtime logs");
    expect(record).toContain("Build logs");
    expect(record).toContain("Log drain");
    expect(record).toMatch(/1 hour.*Hobby/);
    expect(record).toMatch(/\b1 day\b.*Pro/);
    expect(record).toMatch(/3 days.*Enterprise/);
    expect(record).toMatch(/30 days.*Observability Plus/);
    expect(record).toContain("Indefinite per deployment");
    // Reviewed on a date, with the sources named as retrievable URLs.
    expect(section).toContain("2026-10-15");
    expect(record).toContain("https://vercel.com/docs/");
  });

  it("names the four account facts it could not read and does not claim an account inspection", () => {
    const record = flat(section);
    for (const fact of [
      "the project's plan tier",
      "Observability Plus",
      "whether any drain exists",
      "2FA",
    ]) {
      expect(record.toLowerCase()).toContain(fact.toLowerCase());
    }
    // The distinction the whole record turns on. A future edit that removes
    // these is restating an accepted residual as a verified reading.
    expect(record).toContain("Not verified");
    expect(record).toMatch(/not\*\* on a read of the hosting account/);
    expect(record).toContain("the retention period actually in force for this deployment is not established");
    expect(record).toMatch(/accepts? (that|the) residual/);
    expect(record).toMatch(/accepted (by the accountable owner|the residual)/i);
  });

  it("states the trigger the report actually sets, and that it is not armed", () => {
    const record = flat(section);
    expect(record).toContain("credentialed hosted use");
    expect(record).toContain("not armed");
    // The sandbox gate is the code-side proof of "not armed", cited by file.
    expect(record).toContain("src/lib/va/account/config.ts");
    expect(record).toContain("VA_ACCOUNT_SANDBOX_ENABLED");
    // The superseded target phrase is named as superseded, not left standing
    // as this gate's target.
    expect(record).toContain("replaces it");
  });

  it("keeps the trigger and status consistent across the register, runbooks and report", () => {
    expect(section).toContain(GATE_A_STATUS);

    const row = register
      .split("\n")
      .find((line) => line.startsWith("| ") && line.includes("issues/537"));
    expect(row, "register lost its #537 row").toBeDefined();
    expect(row).toContain(GATE_A_STATUS);

    const runbookRow = deployment
      .split("## Known external verification boundaries")[1]
      ?.split("\n")
      .find((line) => line.startsWith("| ") && line.includes("issues/537"));
    expect(runbookRow, "runbook lost its #537 row").toBeDefined();
    expect(runbookRow).toContain(GATE_A_STATUS);
    expect(runbookRow).toContain("not a read of the hosting account");

    expect(security).toMatch(/- \*\*#537 — .*:\*\* CLOSED; Richard Parslow/);
    expect(security).toContain("the retention period actually in force is still unestablished");

    expect(report).toContain("CLOSED / RECORDED WITH RESIDUAL ACCEPTED (H-02 gate A)");
  });

  it("stops publishing a retention figure for the platform sink that nothing established", () => {
    // The invented figure, and the shape a reintroduction would take.
    expect(retention).not.toContain("30 days hot");
    expect(retention).toMatch(/Not established for this deployment/);
    // Both corrections are present: the tier dependency on the runtime row,
    // and the indefinite build-log fact on its own row.
    expect(flat(retention)).toMatch(/1 hour \(Hobby\), 1 day \(Pro\), 3 days \(Enterprise\), or 30 days with Observability Plus/);
    expect(retention).toContain("Indefinite per deployment");
    expect(retention).toContain("https://vercel.com/docs/deployments/logs");
    // A drain, if one exists, supersedes the platform figures — and the policy
    // has to say so rather than leaving a stale default standing.
    expect(flat(retention)).toMatch(/log drain/);
    expect(flat(retention)).toContain(
      "A drain is configured in the hosting account, not in this repository",
    );
  });

  it("stops inferring 'no drain' from an absent vercel.json", () => {
    // The inference itself is what must not come back: absence of a file in
    // the tree cannot prove absence of a dashboard-configured drain.
    const sinkSet = flat(inventory);
    expect(sinkSet).toContain("configured in the hosting account");
    expect(sinkSet).toContain("not** in `vercel.json`");
    expect(sinkSet).toMatch(/cannot establish that no drain exists/);
    expect(sinkSet).toContain("any account-configured drain");
    // The drain-specific risk is stated where the sink is described, because
    // it is the one path by which a query string leaves the platform.
    expect(sinkSet).toMatch(/request path \*with its query parameters\*|with their query parameters/);
  });

  it("keeps a closure from ticking H-02 while gate B is open", () => {
    // The completion boundary is where the register states which gates remain
    // open, so the pairing is asserted there rather than in the gate section.
    const boundary = flat(gates.split("## Completion boundary")[1] ?? "");
    expect(boundary).toContain("gate A is recorded");
    expect(boundary).toContain("H-02 is not complete");
    // Gate B is untouched by this closure and stays externally operated.
    const gateB = gates.split("## Issue #538 — ")[1]?.split("\n## ")[0] ?? "";
    expect(gateB).toContain("OPEN / EXTERNALLY OPERATED");
    expect(flat(gateB)).toMatch(/live scrubbing|hosting provider's own request\/access logs/);
    // Gate B carries the same trigger, so the two H-02 gates cannot drift.
    expect(flat(gateB)).toContain("credentialed hosted use");
    // The report's close-out box covers both gates, so it stays unchecked.
    const h02Box = report
      .split("\n")
      .find((line) => line.startsWith("- [") && line.includes("**H-02**"));
    expect(h02Box, "report lost its H-02 close-out box").toBeDefined();
    expect(h02Box!.startsWith("- [ ]"), "H-02 must stay unchecked while gate B is open").toBe(true);
    expect(h02Box).toContain("Gate B is still open");
  });

  it("records the reopen criterion instead of promising the review was performed", () => {
    const record = flat(section);
    expect(record).toMatch(/Reopen as a new issue under the original criterion/);
    expect(record).toContain("with dates and a named reviewer");
    // And it must not borrow language that only fits an actual account read.
    expect(record).not.toMatch(/retention (?:period|value) (?:was|is) (?:configured|set|verified)/i);
    expect(record).not.toMatch(/reviewed (?:with|against) the hosting account/i);
  });
});
