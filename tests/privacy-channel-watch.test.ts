import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { classify, nextAcceptedState } from "../scripts/watch-privacy-channel.mjs";

/**
 * Contracts for the scheduled privacy-channel watch (gate C / issue #539).
 *
 * The watch exists because a dated reading goes stale in both directions: the channel can be
 * registered and start working, and it can work and then break. Its whole value is in *when* it
 * tells a human, so the verdict table is pinned here — including the two states a reader might
 * expect to alert but must not (the recorded dead state, which is already tracked by #539, and the
 * unchanged live state) and the two that must never be silent (a live channel that stopped
 * resolving, and a dead channel that outlived the review date its own acceptance carried).
 *
 * Two properties are load-bearing beyond the verdicts:
 *
 *   1. **A scheduled run cannot re-baseline.** Acceptance lives in a committed file and changes
 *      only through `--record`, and a dead observation is refused without a stated reason and a
 *      review date. Without that, the honest failure mode — the channel is dead — could be turned
 *      into a green run by running the watch, which is precisely the monitor-that-hides-the-thing
 *      this repository keeps refusing to build.
 *   2. **A failed reading is never a verdict.** `could-not-run` exits 2 and alerts, so a watch that
 *      cannot see the facts is visible rather than silently green.
 */

const SCRIPT = readFileSync(resolve(process.cwd(), "scripts/watch-privacy-channel.mjs"), "utf8");
const WORKFLOW = readFileSync(
  resolve(process.cwd(), ".github/workflows/privacy-channel-watch.yml"),
  "utf8",
);
const STATE = JSON.parse(readFileSync(resolve(process.cwd(), "docs/privacy-channel-watch-state.json"), "utf8"));

/** Source text with line wrapping collapsed, so a reflow of a comment is not a diff. */
const flat = (source: string): string => source.replace(/\s+/g, " ");
const prose = (source: string): string => source.replace(/^\s*\*/gm, "").replace(/\s+/g, " ");

const dead = {
  couldNotRun: false,
  deliverable: false,
  reasons: ["no MX answers: no mail route exists, so nothing can be delivered"],
};
const live = { couldNotRun: false, deliverable: true, reasons: ["a mail route exists", "MX mx1.mailhost.example"] };
const unreadable = { couldNotRun: true, reasons: ["the verifier produced no readable JSON (exit none;)"] };

const acceptedDead = { expected: "dead", reviewBy: "2026-11-15", reason: "not registered; owner action pending", gate: "#539 (gate C)" };
const acceptedLive = { expected: "live", gate: "#539 (gate C)" };
const at = (date: string) => new Date(`${date}T12:00:00Z`);

describe("the watch tells a human only when something changed", () => {
  it("stays silent while the channel is dead exactly as recorded", () => {
    const verdict = classify({ observation: dead, accepted: acceptedDead, now: at("2026-10-20") });
    expect(verdict.status).toBe("known-open");
    expect(verdict.exitCode).toBe(0);
    expect(verdict.alert).toBe(false);
    expect(verdict.detail).toContain("#539");
  });

  it("stays silent while the channel is deliverable as accepted", () => {
    const verdict = classify({ observation: live, accepted: acceptedLive, now: at("2026-10-20") });
    expect(verdict.status).toBe("green");
    expect(verdict.exitCode).toBe(0);
    expect(verdict.alert).toBe(false);
  });

  it("raises when a channel accepted as live stops resolving — the regression this watch is for", () => {
    const verdict = classify({ observation: dead, accepted: acceptedLive, now: at("2026-10-20") });
    expect(verdict.status).toBe("regression");
    expect(verdict.exitCode).toBe(1);
    expect(verdict.alert).toBe(true);
    expect(verdict.headline).toContain("stopped being deliverable");
  });

  it("announces the channel becoming deliverable, without closing the gate's human step", () => {
    const verdict = classify({ observation: live, accepted: acceptedDead, now: at("2026-10-20") });
    expect(verdict.status).toBe("recovered");
    expect(verdict.exitCode).toBe(0);
    expect(verdict.alert).toBe(true);
    // The one thing the watch must never be read as: a mailbox test.
    expect(verdict.detail).toContain("a real message from outside the domain");
  });

  it("raises once a dead channel outlives the review date its acceptance carried", () => {
    const onTheDay = classify({ observation: dead, accepted: acceptedDead, now: at("2026-11-15") });
    expect(onTheDay.status).toBe("known-open");

    const after = classify({ observation: dead, accepted: acceptedDead, now: at("2026-11-16") });
    expect(after.status).toBe("pending-expired");
    expect(after.exitCode).toBe(1);
    expect(after.alert).toBe(true);
    expect(after.headline).toContain("2026-11-15");
    expect(after.detail).toContain("no longer a pending action, it is an unaddressed one");
  });

  it("reports a failed reading as a watch fault, never as a verdict about the channel", () => {
    for (const accepted of [acceptedDead, acceptedLive]) {
      const verdict = classify({ observation: unreadable, accepted, now: at("2026-10-20") });
      expect(verdict.status).toBe("could-not-run");
      expect(verdict.exitCode).toBe(2);
      expect(verdict.alert).toBe(true);
      expect(verdict.headline).toContain("could not read");
    }
  });

  it("fails closed when there is no accepted state to compare against", () => {
    const verdict = classify({ observation: dead, accepted: { path: "docs/privacy-channel-watch-state.json" }, now: at("2026-10-20") });
    expect(verdict.status).toBe("could-not-run");
    expect(verdict.exitCode).toBe(2);
    expect(verdict.detail).toContain("record one with --record");
  });
});

describe("acceptance cannot be rewritten by a run", () => {
  it("refuses to record a dead channel without a reason and a review date", () => {
    expect(() => nextAcceptedState({ observation: dead, now: at("2026-10-16") })).toThrow(/refusing to record a dead channel without --accept-dead/);
    expect(() =>
      nextAcceptedState({ observation: dead, acceptDead: "waiting on the operator", reviewBy: "soon", reason: "waiting on the operator", now: at("2026-10-16") }),
    ).toThrow(/refusing to record a dead channel without --review-by/);
  });

  it("records a dead channel only as a dated, reasoned decision", () => {
    const next = nextAcceptedState({
      observation: dead,
      acceptDead: "not registered; owner action pending",
      reviewBy: "2026-11-15",
      reason: "not registered; owner action pending",
      now: at("2026-10-16"),
    });
    expect(next).toMatchObject({ expected: "dead", reviewBy: "2026-11-15", acceptedAt: "2026-10-16" });
  });

  it("records a live channel without needing an excuse", () => {
    const next = nextAcceptedState({ observation: live, now: at("2026-12-01") });
    expect(next).toMatchObject({ expected: "live", acceptedAt: "2026-12-01" });
  });

  it("refuses to record anything from an unreadable observation", () => {
    expect(() => nextAcceptedState({ observation: unreadable, now: at("2026-10-16") })).toThrow(/the observation itself could not be read/);
  });

  it("writes the accepted state only behind the --record flag", () => {
    // Positional, because the property is ordering: the write must sit inside the record branch.
    const recordBranch = SCRIPT.indexOf('if (has("--record"))');
    const write = SCRIPT.indexOf("writeFileSync(\n      statePath,");
    expect(recordBranch).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(recordBranch);
    // The rule is stated where it governs a scheduled run: in the workflow itself.
    expect(flat(WORKFLOW)).toContain("a scheduled run may observe, never re-baseline");
  });
});

describe("the watch refuses to be read as a mailbox test", () => {
  it("says what it cannot see, in the script and in its report", () => {
    expect(prose(SCRIPT)).toContain("It reads no mailbox and sends no mail");
    expect(SCRIPT).toContain("cannot see a mailbox, so a green or");
    expect(SCRIPT).toContain("stays a human act");
  });

  it("delegates every external reading to the verifier rather than reimplementing it", () => {
    expect(SCRIPT).toContain('resolve(HERE, "verify-privacy-channel.mjs")');
    expect(SCRIPT).toContain('spawnSync(process.execPath, [VERIFIER, "--json"]');
    // No resolver, registry or SMTP client of its own: one owner of the external facts.
    expect(SCRIPT).not.toContain("dns-query");
    expect(SCRIPT).not.toContain("rdap");
    expect(SCRIPT).not.toContain("port: 25");
  });
});

describe("the scheduled workflow can reach a human and cannot re-baseline", () => {
  it("runs on a schedule and by hand, with the permissions to file an issue", () => {
    expect(WORKFLOW).toMatch(/^on:[\s\S]*?^\s+schedule:/m);
    expect(WORKFLOW).toContain("workflow_dispatch:");
    expect(WORKFLOW).toContain("issues: write");
    expect(WORKFLOW).toContain("contents: read");
    expect(WORKFLOW).toContain("gh issue list");
    expect(WORKFLOW).toContain("gh issue create");
    expect(WORKFLOW).toContain("gh issue close");
  });

  it("observes only — a scheduled run never records an accepted state", () => {
    // The workflow's *guidance text* legitimately tells a human how to record one, so the
    // property is about the invocation itself: no command line that runs the watcher may
    // carry a recording flag.
    expect(WORKFLOW).toMatch(/^\s*node scripts\/watch-privacy-channel\.mjs --github-output="\$GITHUB_OUTPUT" 2>&1 \| tee watch\.log$/m);
    expect(WORKFLOW).not.toMatch(/^\s*node scripts\/watch-privacy-channel\.mjs[^\n]*--record/m);
    expect(WORKFLOW).not.toMatch(/^\s*node scripts\/watch-privacy-channel\.mjs[^\n]*--accept-dead/m);
  });

  it("pins its actions and downloads no artifact", () => {
    expect(WORKFLOW).toContain("actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09");
    expect(WORKFLOW).toContain("actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444");
    expect(WORKFLOW).toContain("actions/upload-artifact@330a01c490aca151604b8cf639adc76d48f6c5d4");
    expect(WORKFLOW).not.toContain("download-artifact");
    expect(WORKFLOW).not.toMatch(/uses:\s*actions\/[a-z0-9-]+@v\d+/);
  });

  it("carries the standing caveat into the issue it files", () => {
    expect(flat(WORKFLOW)).toContain("It cannot see a mailbox, so no run of it");
    expect(flat(WORKFLOW)).toContain("step 4 — a message sent **from outside the domain**");
  });
});

describe("the accepted state is a dated decision, not a placeholder", () => {
  it("records the dead channel with a reason, a review date and the gate it belongs to", () => {
    expect(STATE.expected).toBe("dead");
    expect(STATE.acceptedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(STATE.reviewBy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(STATE.reviewBy).getTime()).toBeGreaterThan(new Date(STATE.acceptedAt).getTime());
    expect(STATE.gate).toContain("#539");
    expect(STATE.reason).toContain("not registered");
    expect(STATE.purpose).toContain("Written only by --record");
    // The last observed reading travels with acceptance, so a reader sees both facts.
    expect(STATE.lastObserved.deliverable).toBe(false);
    expect(STATE.lastObserved.mx).toEqual([]);
  });
});
