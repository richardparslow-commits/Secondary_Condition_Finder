import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  LAND_API_PATHS,
  LandRequiredChecksError,
  REQUIRED_CHECKS_SOURCE,
  contextsFromRules,
  protectionRead,
  readJsonCapture,
  resolveRequiredChecks,
} from "../scripts/lib/land-required-checks.mjs";

/**
 * `scripts/land.mjs` merges a PR once the base branch's *required* checks are
 * green, and it reads those names from the live branch ruleset instead of
 * hard-coding them. That is only safe if an unreadable ruleset is a hard
 * failure. It used to fall through to `[]` on a failed `gh api` call (including
 * GitHub's 403 scope refusals), on a non-JSON or non-array body, and on a
 * ruleset that declared no `required_status_checks` rule — and an empty list
 * meant "watch every check this PR happens to report", so a PR showing only an
 * unrelated green subset was announced as "All required check(s) passed" and
 * handed to `gh pr merge`. The server usually refuses that merge, but the
 * script reported a gate it had never verified, `--no-merge` reported success,
 * and a base branch whose gate is unreadable had no client-side gate at all.
 *
 * Two things are pinned here, because either alone would be a weaker claim:
 *
 *   1. the pure policy in `scripts/lib/land-required-checks.mjs` — every
 *      unreadable, mis-shaped and empty-declaring outcome throws rather than
 *      returning an empty list, and only a positively read non-empty list
 *      authorises a merge;
 *   2. the real script, run end to end against a stub `gh` in a throwaway git
 *      repository — the failure modes above exit non-zero instead of printing
 *      "will watch all", and a readable ruleset still lands the intended check
 *      names in the plan.
 *
 * The second half is what makes this a test of the artifact a person runs, not
 * just of a helper it happens to import.
 */

const ROOT = process.cwd();
const LAND = path.join(ROOT, "scripts", "land.mjs");
const LAND_SOURCE = fs.readFileSync(LAND, "utf8");

/** A captured `gh api` result, in the shape `scripts/land.mjs` passes along. */
function capture(overrides: { status?: number; stdout?: string; stderr?: string } = {}) {
  return { status: 0, stdout: "[]", stderr: "", ...overrides };
}

const RULES_WITH_CHECKS = JSON.stringify([
  {
    type: "required_status_checks",
    parameters: {
      required_status_checks: [{ context: "verify" }, { context: "verify-doc-lint" }],
      strict_required_status_checks_policy: false,
    },
  },
  { type: "pull_request", parameters: {} },
]);

function resolveWithRules(rules: unknown, protection: unknown = capture({ stdout: "{}" })) {
  let protectionReads = 0;
  const result = resolveRequiredChecks({
    rules,
    readProtection: () => {
      protectionReads += 1;
      return protection;
    },
    base: "main",
  });
  return { result, protectionReads };
}

describe("land required checks — a captured read is classified, never assumed empty", () => {
  it("treats a missing exit status, a failed exit, an empty body and non-JSON as unreadable", () => {
    expect(readJsonCapture(null)).toEqual({ ok: false, detail: "the read did not report an exit status" });
    expect(readJsonCapture({})).toEqual({ ok: false, detail: "the read did not report an exit status" });
    expect(readJsonCapture(capture({ status: 1, stderr: "gh: Forbidden (HTTP 403)\nmore" }))).toEqual({
      ok: false,
      detail: "the read failed (exit 1): gh: Forbidden (HTTP 403)",
    });
    expect(readJsonCapture(capture({ status: 4 }))).toEqual({
      ok: false,
      detail: "the read failed (exit 4)",
    });
    expect(readJsonCapture(capture({ stdout: "   " }))).toEqual({
      ok: false,
      detail: "the read returned an empty body",
    });
    expect(readJsonCapture(capture({ stdout: "<html>gateway error</html>" }))).toEqual({
      ok: false,
      detail: "the read returned a body that is not JSON",
    });
  });

  it("reads a successful JSON body", () => {
    expect(readJsonCapture(capture({ stdout: '{"a":1}' }))).toEqual({ ok: true, body: { a: 1 } });
  });
});

describe("land required checks — ruleset payload shapes", () => {
  it("collects and de-duplicates the contexts of the required-status-checks rule", () => {
    expect(contextsFromRules(JSON.parse(RULES_WITH_CHECKS))).toEqual({
      ok: true,
      declaresRule: true,
      contexts: ["verify", "verify-doc-lint"],
    });

    const duplicated = JSON.parse(RULES_WITH_CHECKS);
    duplicated[0].parameters.required_status_checks.push({ context: "verify" });
    const deduped = contextsFromRules(duplicated);
    expect(deduped.ok && deduped.contexts).toEqual(["verify", "verify-doc-lint"]);
  });

  it("reports an object, string or null payload as unreadable rather than empty", () => {
    // GitHub answers this endpoint with an object such as {"message":"Not Found"}
    // when the request is refused; iterating it used to throw into a silent
    // catch, which is the fail-open bug this suite exists to prevent.
    for (const body of [{ message: "Not Found" }, "Not Found", null]) {
      const result = contextsFromRules(body);
      expect(result.ok, JSON.stringify(body)).toBe(false);
      expect(result.ok ? "" : result.detail).toContain("was not an array");
    }
  });

  it("separates 'declared the rule' from 'declared contexts'", () => {
    expect(contextsFromRules([{ type: "pull_request" }])).toEqual({
      ok: true,
      declaresRule: false,
      contexts: [],
    });
    expect(contextsFromRules([{ type: "required_status_checks", parameters: {} }])).toEqual({
      ok: true,
      declaresRule: true,
      contexts: [],
    });
    expect(
      contextsFromRules([
        { type: "required_status_checks", parameters: { required_status_checks: [{ context: "   " }, {}] } },
      ]),
    ).toEqual({ ok: true, declaresRule: true, contexts: [] });
  });
});

describe("land required checks — classic protection is read as a fallback only", () => {
  it("reads both the plain contexts and the app-bound checks list", () => {
    const body = JSON.stringify({
      required_status_checks: {
        contexts: ["verify"],
        checks: [{ context: "verify" }, { context: "verify-doc-lint", app_id: 15368 }],
      },
    });
    expect(protectionRead(capture({ stdout: body }))).toEqual({
      state: "read",
      contexts: ["verify", "verify-doc-lint"],
    });
  });

  it("treats a protected branch with no status checks as a definitive, empty answer", () => {
    expect(protectionRead(capture({ stdout: JSON.stringify({ required_status_checks: null }) }))).toEqual({
      state: "read",
      contexts: [],
    });
  });

  it("distinguishes 'not protected' from 'could not read'", () => {
    expect(protectionRead(capture({ status: 1, stderr: "gh: Branch not protected (HTTP 404)" }))).toEqual({
      state: "disabled",
    });
    expect(protectionRead(capture({ status: 1, stderr: "gh: Forbidden (HTTP 403)" }))).toEqual({
      state: "unreadable",
      detail: "the read failed (exit 1): gh: Forbidden (HTTP 403)",
    });
    expect(protectionRead(capture({ stdout: "not json" }))).toEqual({
      state: "unreadable",
      detail: "the read returned a body that is not JSON",
    });
    expect(protectionRead(capture({ stdout: "[1,2]" }))).toEqual({
      state: "unreadable",
      detail: "the protection payload was not an object (received an array)",
    });
    expect(protectionRead(capture({ stdout: JSON.stringify({ required_status_checks: "verify" }) }))).toEqual({
      state: "unreadable",
      detail: "the protection payload's required_status_checks was not an object (received a string)",
    });
  });
});

describe("land required checks — only a positively read, non-empty list authorises a merge", () => {
  it("returns the ruleset's checks and does not touch classic protection", () => {
    const { result, protectionReads } = resolveWithRules(capture({ stdout: RULES_WITH_CHECKS }));
    expect(result).toEqual({
      names: ["verify", "verify-doc-lint"],
      source: REQUIRED_CHECKS_SOURCE.RULESET,
    });
    expect(protectionReads).toBe(0);
  });

  it("falls back to classic protection when the ruleset declares no checks", () => {
    const { result, protectionReads } = resolveWithRules(
      capture({ stdout: "[]" }),
      capture({ stdout: JSON.stringify({ required_status_checks: { contexts: ["verify"] } }) }),
    );
    expect(result).toEqual({ names: ["verify"], source: REQUIRED_CHECKS_SOURCE.PROTECTION });
    expect(protectionReads).toBe(1);
  });

  const refused: Array<[string, unknown, unknown, string]> = [
    [
      "the ruleset read failed (403 scope refusal)",
      capture({ status: 1, stderr: "gh: Resource not accessible by integration (HTTP 403)" }),
      capture(),
      "Resource not accessible by integration",
    ],
    [
      "the ruleset read failed with no diagnostic",
      capture({ status: 128 }),
      capture(),
      "the read failed (exit 128)",
    ],
    [
      "the ruleset read returned no body",
      capture({ stdout: "" }),
      capture(),
      "the read returned an empty body",
    ],
    [
      "the ruleset read returned a non-JSON body",
      capture({ stdout: "<html>502</html>" }),
      capture(),
      "a body that is not JSON",
    ],
    [
      "the ruleset payload was an object",
      capture({ stdout: '{"message":"Not Found"}' }),
      capture(),
      "was not an array",
    ],
    [
      "the ruleset declares no checks and classic protection is not enabled",
      capture({ stdout: "[]" }),
      capture({ status: 1, stderr: "gh: Branch not protected (HTTP 404)" }),
      "not enabled",
    ],
    [
      "the ruleset declares no checks and protection requires no contexts",
      capture({ stdout: "[]" }),
      capture({ stdout: JSON.stringify({ required_status_checks: { contexts: [] } }) }),
      "requires no contexts",
    ],
    [
      "the ruleset declares no checks and protection is unreadable",
      capture({ stdout: "[]" }),
      capture({ status: 1, stderr: "gh: Server Error (HTTP 500)" }),
      "HTTP 500",
    ],
  ];

  for (const [label, rules, protection, expected] of refused) {
    it(`refuses to continue when ${label}`, () => {
      let thrown: unknown;
      try {
        resolveWithRules(rules, protection);
      } catch (error) {
        thrown = error;
      }
      expect(thrown, "this input must not resolve to a usable check list").toBeInstanceOf(
        LandRequiredChecksError,
      );
      const error = thrown as Error;
      expect(error.name).toBe("LandRequiredChecksError");
      expect(error.message).toContain("'main'");
      expect(error.message).toContain(expected);
    });
  }

  it("never yields an empty list for any unreadable or empty-declaring outcome", () => {
    const inputs = [
      [capture({ status: 1 }), capture({ status: 1 })],
      [capture({ stdout: "[]" }), capture({ stdout: "{}" })],
      [capture({ stdout: "{}" }), capture({ stdout: "{}" })],
      [capture({ status: 1, stderr: "gh: Branch not protected (HTTP 404)" }), capture({})],
    ] as const;
    for (const [rules, protection] of inputs) {
      // Either it threw (nothing was verified) or it produced a non-empty list —
      // an empty list is the outcome this suite exists to make impossible.
      let names: string[] | null = null;
      try {
        names = resolveWithRules(rules, protection).result.names;
      } catch {
        names = null;
      }
      expect(names === null || names.length > 0).toBe(true);
    }
  });
});

describe("land required checks — the landing script itself", () => {
  const STUB = `#!/bin/sh
# Test double for gh. Land's calls, in the order it makes them:
#   auth status · repo view · api (rules, protection) · pr view · pr checks ·
#   pr create · pr merge. Every call the script must NOT make is recorded in
#   $LAND_STUB_CALLS so a test can assert it never happened. The default keeps
#   the redirect valid for tests that only care about the outcome.
LAND_STUB_CALLS="\${LAND_STUB_CALLS:-/dev/null}"
if [ -z "\${LAND_STUB_PR:-}" ]; then LAND_STUB_PR='{"number":7,"url":"https://example.invalid/pr/7","state":"OPEN"}'; fi
case "$1" in
  auth) exit 0 ;;
  repo) printf '{"nameWithOwner":"owner/repo"}\\n'; exit 0 ;;
  pr)
    printf '%s\\n' "$*" >> "$LAND_STUB_CALLS"
    case "$2" in
      view) printf '%s\\n' "$LAND_STUB_PR"; exit 0 ;;
      checks) printf '%s\\n' "\${LAND_STUB_PR_CHECKS:-[]}"; exit 0 ;;
      create) printf 'https://example.invalid/pr/7\\n'; exit 0 ;;
      merge) exit 0 ;;
    esac
    exit 1 ;;
  api)
    printf 'api %s\\n' "$2" >> "$LAND_STUB_CALLS"
    case "$2" in
      */rules/branches/*)
        if [ "\${LAND_STUB_RULES_EXIT:-0}" = "0" ]; then cat "$LAND_STUB_RULES_BODY"; else printf '%s\\n' "\${LAND_STUB_RULES_STDERR:-stub failure}" >&2; fi
        exit "\${LAND_STUB_RULES_EXIT:-0}" ;;
      */protection)
        if [ "\${LAND_STUB_PROTECTION_EXIT:-0}" = "0" ]; then cat "$LAND_STUB_PROTECTION_BODY"; else printf '%s\\n' "\${LAND_STUB_PROTECTION_STDERR:-stub failure}" >&2; fi
        exit "\${LAND_STUB_PROTECTION_EXIT:-0}" ;;
    esac
    exit 1 ;;
esac
exit 1
`;

  /**
   * A throwaway repository with one dirty tracked file (so the dry-run plan is
   * non-empty) on a branch that is not the base, plus a `gh` test double whose
   * ruleset and protection answers the caller chooses.
   */
  function runLand({
    rulesBody = "[]",
    protectionBody = "{}",
    ...env
  }: { rulesBody?: string; protectionBody?: string } & Record<string, string>) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "land-checks-"));
    try {
      const bin = path.join(directory, "bin");
      fs.mkdirSync(bin);
      const gh = path.join(bin, "gh");
      fs.writeFileSync(gh, STUB);
      fs.chmodSync(gh, 0o755);

      const repository = path.join(directory, "repo");
      fs.mkdirSync(repository);
      const git = (...args: string[]) =>
        spawnSync("git", args, { cwd: repository, encoding: "utf8" });
      git("init", "-q");
      git("config", "user.email", "land@test.invalid");
      git("config", "user.name", "Land Test");
      git("checkout", "-q", "-b", "feature");
      fs.writeFileSync(path.join(repository, "tracked.txt"), "one\n");
      git("add", "tracked.txt");
      git("commit", "-q", "-m", "fixture");
      fs.writeFileSync(path.join(repository, "tracked.txt"), "one\ntwo\n");

      // The stub reads its answers from files, because the bodies contain
      // newlines and quotes that an environment variable would mangle.
      const rulesFile = path.join(directory, "rules.json");
      const protectionFile = path.join(directory, "protection.json");
      fs.writeFileSync(rulesFile, rulesBody);
      fs.writeFileSync(protectionFile, protectionBody);

      const result = spawnSync(process.execPath, [LAND, "-m", "land: fixture", "--dry-run"], {
        cwd: repository,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`,
          LAND_STUB_RULES_BODY: rulesFile,
          LAND_STUB_PROTECTION_BODY: protectionFile,
          ...env,
        },
      });
      return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }

  it("refuses to plan a landing when the ruleset cannot be read", () => {
    const result = runLand({
      LAND_STUB_RULES_EXIT: "1",
      LAND_STUB_RULES_STDERR: "gh: Resource not accessible by integration (HTTP 403)",
      LAND_STUB_PROTECTION_EXIT: "1",
      LAND_STUB_PROTECTION_STDERR: "gh: Branch not protected (HTTP 404)",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("could not read the required status checks");
    expect(result.stderr).toContain("Resource not accessible by integration");
    expect(result.stdout).not.toContain("watch all");
    expect(result.stdout).not.toContain("wait:");
  });

  it("refuses to plan a landing when the read succeeds but declares nothing to verify", () => {
    const result = runLand({
      rulesBody: "[]",
      LAND_STUB_PROTECTION_EXIT: "1",
      LAND_STUB_PROTECTION_STDERR: "gh: Branch not protected (HTTP 404)",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("declares no required status checks");
    expect(result.stderr).toContain("cannot be established");
    expect(result.stdout).not.toContain("wait:");
  });

  it("plans the wait against the ruleset's own checks when it can read them", () => {
    const result = runLand({ rulesBody: RULES_WITH_CHECKS });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("required checks from the branch ruleset: verify, verify-doc-lint");
    expect(result.stdout).toContain("wait: verify, verify-doc-lint");
    expect(result.stdout).not.toContain("watch all");
  });

  it("still resolves through classic protection when the ruleset is readable and empty", () => {
    const result = runLand({
      rulesBody: "[]",
      protectionBody: JSON.stringify({ required_status_checks: { contexts: ["verify"] } }),
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("required checks from the classic branch protection: verify");
  });

  it("never declares the full list passed, or merges, while a required check has not reported", () => {
    // The full landing path, offline: a real commit, a real push to a local bare
    // remote, and stubbed `gh` answering PR #7 with two required checks resolved
    // but only one ever reported. The old waiter counted what the PR happened to
    // report, so this run would have printed "All 1 required check(s) passed"
    // and called `gh pr merge`.
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "land-wait-"));
    try {
      const bin = path.join(directory, "bin");
      fs.mkdirSync(bin);
      const gh = path.join(bin, "gh");
      fs.writeFileSync(gh, STUB);
      fs.chmodSync(gh, 0o755);

      const calls = path.join(directory, "calls.log");
      fs.writeFileSync(calls, "");
      const rulesBody = path.join(directory, "rules.json");
      fs.writeFileSync(rulesBody, RULES_WITH_CHECKS);

      const origin = path.join(directory, "origin.git");
      spawnSync("git", ["init", "-q", "--bare", origin], { encoding: "utf8" });
      const repository = path.join(directory, "repo");
      fs.mkdirSync(repository);
      const git = (...args: string[]) => spawnSync("git", args, { cwd: repository, encoding: "utf8" });
      git("init", "-q");
      git("config", "user.email", "land@test.invalid");
      git("config", "user.name", "Land Test");
      git("checkout", "-q", "-b", "feature");
      fs.writeFileSync(path.join(repository, "tracked.txt"), "one\n");
      git("add", "tracked.txt");
      git("commit", "-q", "-m", "fixture");
      git("remote", "add", "origin", origin);
      fs.writeFileSync(path.join(repository, "tracked.txt"), "one\ntwo\n");

      const result = spawnSync(
        process.execPath,
        // Sub-minute values are valid (both flags only require a positive
        // number), so the wait ends in about a second instead of a minute.
        [LAND, "-m", "land: fixture", "--no-footer", "--interval", "0.1", "--timeout", "0.02"],
        {
          cwd: repository,
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`,
            LAND_STUB_CALLS: calls,
            LAND_STUB_RULES_BODY: rulesBody,
            LAND_STUB_PR_CHECKS: JSON.stringify([
              { name: "verify", state: "SUCCESS", bucket: "pass" },
            ]),
          },
          timeout: 60_000,
        },
      );

      expect(result.status, result.stderr).toBe(1);
      expect(result.stdout).toContain("Watching 2 required check(s): verify, verify-doc-lint");
      expect(result.stdout).not.toContain("required check(s) passed");
      expect(result.stdout).toContain("verify-doc-lint=not reported");
      expect(result.stderr).toContain("timed out");
      // The timeout names the check that never reported, not the one that passed.
      expect(result.stderr).toContain("never reported on PR #7: verify-doc-lint");
      expect(result.stderr).not.toContain("never reported on PR #7: verify, verify-doc-lint");
      expect(result.stderr).toContain("not merging");
      // The gate that matters: no merge was ever attempted.
      expect(fs.readFileSync(calls, "utf8")).not.toContain("merge");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("keeps the resolution policy in the module instead of re-parsing in the script", () => {
    expect(LAND_SOURCE).toContain('from "./lib/land-required-checks.mjs"');
    expect(LAND_SOURCE).toContain("resolveRequiredChecks({");
    expect(LAND_SOURCE).toContain("error instanceof LandRequiredChecksError");
    // The fail-open behaviour this change removed must not reappear: no inline
    // ruleset parsing, no "watch whatever the PR reports", no silent catch.
    expect(LAND_SOURCE).not.toContain("none declared");
    expect(LAND_SOURCE).not.toContain("requiredSet.size > 0");
    expect(LAND_SOURCE).not.toContain('?? "all checks"');
    expect(LAND_SOURCE).not.toContain("rules/branches");
    expect(LAND_SOURCE).not.toMatch(/catch\s*\{\s*\/\*/);
    // The empty-list guard inside the waiter survives as defence in depth.
    expect(LAND_SOURCE).toContain("refusing to watch every check the PR happens to report");
  });

  it("exposes the documented npm entrypoint the script's own help promises", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts.land).toBe("node scripts/land.mjs");
    expect(LAND_SOURCE).toContain("npm run land");
  });

  it("shares the API paths with the module so the script and its gate cannot drift", () => {
    expect(LAND_API_PATHS.rules("owner/repo", "main")).toBe("repos/owner/repo/rules/branches/main");
    expect(LAND_API_PATHS.protection("owner/repo", "main")).toBe(
      "repos/owner/repo/branches/main/protection",
    );
    expect(LAND_SOURCE).toContain("LAND_API_PATHS.rules(ownerRepo, base)");
    expect(LAND_SOURCE).toContain("LAND_API_PATHS.protection(ownerRepo, base)");
  });
});
