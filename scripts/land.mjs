#!/usr/bin/env node
/**
 * One-step landing sequence: commit -> push -> open/reuse PR -> watch the
 * branch ruleset's REQUIRED status checks -> merge once they pass.
 *
 * This repository's ruleset ("Protect main production lineage") makes `main`
 * PR-only and gates merges on the required checks declared in that ruleset
 * (currently `verify` and `verify-doc-lint`). It also runs a push-time
 * governance check asserting every `main` commit is the merge commit of a
 * merged pull request. This script performs exactly that reviewed-PR landing
 * so the sequence is a single command instead of five.
 *
 * It reads the required check names from the live ruleset rather than
 * hard-coding them, so adding/renaming a required check never silently
 * weakens the wait.
 *
 * Usage:
 *   npm run land -- -m "Commit subject\n\nBody"
 *   npm run land -- -m "subject" --all          # also stage new files
 *   npm run land -- -m "subject" --squash       # merge method override
 *   npm run land -- -m "subject" --no-merge     # stop once checks pass
 *   npm run land -- -m "subject" --dry-run      # print the plan, change nothing
 *
 * See `--help` for the full flag list. Safety posture: it refuses to run on the
 * base branch, never force-pushes, never force-merges, never deletes a branch
 * whose merge failed, and leaves the PR open on any check failure.
 */
import { execFileSync, spawnSync } from "node:child_process";
import process from "node:process";

const FOOTER =
  "Generated with Codebuff 🤖\nCo-Authored-By: Codebuff <noreply@codebuff.com>";

// Folder-sync clients (iCloud/Dropbox/OneDrive) duplicate files mid-write as
// "<name> 2.<ext>". Those forks are never ours to commit; `--all` excludes
// them the same way the checkout-fork-hygiene guard refuses them.
const SYNC_FORK = /(^|\/)[^/]* \d+(\.[^/]*)?$/;

function die(message, code = 1) {
  console.error(`\nland: ${message}`);
  process.exit(code);
}

function run(cmd, args, { capture = false, allowFailure = false } = {}) {
  const result = spawnSync(cmd, args, {
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  });
  if (result.error) die(`failed to run ${cmd}: ${result.error.message}`);
  const out = (result.stdout ?? "").toString();
  if (result.status !== 0 && !allowFailure) {
    if (capture && result.stderr) process.stderr.write(result.stderr.toString());
    die(`\`${cmd} ${args.join(" ")}\` exited ${result.status}`);
  }
  return { status: result.status, stdout: out, stderr: (result.stderr ?? "").toString() };
}

function git(args, opts) {
  return run("git", args, opts);
}

function api(path, opts) {
  return run("gh", ["api", path], { capture: true, ...opts });
}

function parseArgs(argv) {
  const opts = {
    message: "",
    base: "main",
    all: false,
    stage: true,
    adds: [],
    method: "merge",
    merge: true,
    deleteBranch: true,
    footer: true,
    dryRun: false,
    interval: 10,
    timeoutMinutes: 60,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined) die(`missing value for ${a}`);
      i += 1;
      return v;
    };
    switch (a) {
      case "-h":
      case "--help": opts.help = true; break;
      case "-m":
      case "--message": opts.message = next(); break;
      case "--base": opts.base = next(); break;
      case "--add": opts.adds.push(next()); break;
      case "--all": opts.all = true; break;
      case "--no-stage": opts.stage = false; break;
      case "--merge": opts.method = "merge"; break;
      case "--squash": opts.method = "squash"; break;
      case "--rebase": opts.method = "rebase"; break;
      case "--no-merge": opts.merge = false; break;
      case "--no-delete-branch": opts.deleteBranch = false; break;
      case "--no-footer": opts.footer = false; break;
      case "--dry-run": opts.dryRun = true; break;
      case "--interval": opts.interval = Number(next()); break;
      case "--timeout": opts.timeoutMinutes = Number(next()); break;
      default: die(`unknown argument: ${a} (try --help)`);
    }
  }
  if (!opts.help && !opts.message.trim()) die("a commit message is required (-m/--message)");
  return opts;
}

const HELP = `land — commit, push, watch required checks, merge (single step)

Usage: npm run land -- -m "<message>" [options]

Options:
  -m, --message <text>   Commit subject (+ optional body). Required.
      --all              Also stage untracked files (sync-fork copies excluded).
      --add <path>       Stage an extra path (repeatable).
      --no-stage         Do not stage anything; commit only what is already staged.
      --base <branch>    Target branch (default: main).
      --merge            Merge with a merge commit (default).
      --squash           Merge with a squash commit.
      --rebase           Merge with a rebase.
      --no-merge         Stop once the required checks pass; leave the PR open.
      --no-delete-branch Keep the remote/local branch after merge.
      --no-footer        Omit the "Generated with Codebuff" co-author footer.
      --interval <sec>   Poll interval for checks (default: 10).
      --timeout <min>    Overall check-wait timeout (default: 60).
      --dry-run          Print the plan and change nothing.
  -h, --help             Show this help.

It reads the required status checks from the live branch ruleset, so renaming
or adding a required check cannot silently weaken the wait.
`;

function requiredChecks(ownerRepo, base) {
  // Rulesets first (this repo uses one); fall back to classic protection.
  const names = new Set();
  const rules = api(`repos/${ownerRepo}/rules/branches/${base}`, { allowFailure: true });
  try {
    for (const rule of JSON.parse(rules.stdout || "[]")) {
      if (rule?.type !== "required_status_checks") continue;
      for (const check of rule?.parameters?.required_status_checks ?? []) {
        if (check?.context) names.add(check.context);
      }
    }
  } catch { /* not JSON / no rulesets */ }
  if (names.size === 0) {
    const prot = api(`repos/${ownerRepo}/branches/${base}/protection`, { allowFailure: true });
    try {
      for (const c of JSON.parse(prot.stdout || "{}")?.required_status_checks?.contexts ?? []) {
        names.add(c);
      }
    } catch { /* classic protection not enabled */ }
  }
  return [...names];
}

function ghJson(args, { allowFailure = true } = {}) {
  const r = run("gh", args, { capture: true, allowFailure });
  try {
    return JSON.parse(r.stdout || "null");
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const lines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);

/**
 * Read-only: which paths would be committed. Tracked modifications always,
 * untracked additions only with --all (sync-fork copies excluded), plus any
 * explicit --add paths. Never touches the index, so --dry-run is safe.
 */
function stagingPlan(opts) {
  const plan = new Set(lines(git(["diff", "--cached", "--name-only"], { capture: true }).stdout));
  if (opts.stage) {
    for (const f of lines(git(["diff", "--name-only"], { capture: true }).stdout)) plan.add(f);
    for (const p of opts.adds) plan.add(p);
  }
  let forks = [];
  if (opts.all) {
    const others = lines(git(["ls-files", "--others", "--exclude-standard"], { capture: true }).stdout);
    forks = others.filter((p) => SYNC_FORK.test(p));
    for (const p of others.filter((p) => !SYNC_FORK.test(p))) plan.add(p);
  }
  return { files: [...plan].sort(), forks };
}

async function waitForChecks(prNumber, required, opts) {
  const deadline = Date.now() + opts.timeoutMinutes * 60_000;
  const requiredSet = new Set(required);
  let announced = false;
  while (Date.now() < deadline) {
    const checks = ghJson(["pr", "checks", String(prNumber), "--json", "name,state,bucket"]) ?? [];
    const relevant = requiredSet.size > 0
      ? checks.filter((c) => requiredSet.has(c.name))
      : checks;
    if (relevant.length > 0) {
      if (!announced) {
        console.log(`\nWatching ${relevant.length}${requiredSet.size ? " required" : ""} check(s): ${relevant.map((c) => c.name).join(", ")}`);
        announced = true;
      }
      const terminal = (b) => ["pass", "fail", "skipping", "cancel"].includes(b);
      const pending = relevant.filter((c) => !terminal(c.bucket));
      const failed = relevant.filter((c) => c.bucket === "fail" || c.bucket === "cancel");
      const summary = relevant.map((c) => `${c.name}=${c.bucket}`).join("  ");
      process.stdout.write(`\r  ${summary}                    `);
      if (failed.length > 0) {
        console.log();
        console.error(`\nland: required check(s) failed: ${failed.map((c) => c.name).join(", ")}`);
        return { ok: false, checks: relevant };
      }
      if (pending.length === 0) {
        console.log();
        console.log(`\nAll ${relevant.length} required check(s) passed.`);
        return { ok: true, checks: relevant };
      }
    } else {
      process.stdout.write(`\r  waiting for checks to register...        `);
    }
    await sleep(opts.interval * 1000);
  }
  console.log();
  console.error(`\nland: timed out after ${opts.timeoutMinutes} minute(s) waiting for checks.`);
  return { ok: false, checks: [] };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(HELP);
    return;
  }
  if (!Number.isFinite(opts.interval) || opts.interval <= 0) die("--interval must be a positive number of seconds");
  if (!Number.isFinite(opts.timeoutMinutes) || opts.timeoutMinutes <= 0) die("--timeout must be a positive number of minutes");

  const inRepo = git(["rev-parse", "--is-inside-work-tree"], { capture: true, allowFailure: true });
  if (inRepo.status !== 0) die("not inside a git working tree");

  const branch = git(["branch", "--show-current"], { capture: true }).stdout.trim();
  if (!branch) die("detached HEAD; land from a named branch");
  if (branch === opts.base) die(`refusing to land from the base branch '${opts.base}' (it is PR-only)`);

  if (run("gh", ["auth", "status"], { capture: true, allowFailure: true }).status !== 0) {
    die("gh is not authenticated (run: gh auth login)");
  }
  const ownerRepo = (ghJson(["repo", "view", "--json", "nameWithOwner"]) ?? {}).nameWithOwner;
  if (!ownerRepo) die("could not resolve the GitHub repository");

  const required = requiredChecks(ownerRepo, opts.base);
  console.log(`land: branch '${branch}' -> '${opts.base}' on ${ownerRepo}`);
  console.log(`land: required checks from ruleset: ${required.length ? required.join(", ") : "(none declared — will watch all)"}`);

  const message = opts.footer ? `${opts.message.trim()}\n\n${FOOTER}` : opts.message.trim();
  const subject = message.split("\n")[0];
  const body = message.split("\n").slice(1).join("\n").trim();

  // Compute the staging plan without mutating the index.
  const plan = stagingPlan(opts);
  if (plan.files.length === 0) {
    const dirty = git(["status", "--short"], { capture: true }).stdout.trim();
    die(dirty
      ? "nothing staged to commit; pass --all to include untracked files or --add <path>"
      : "working tree is clean; nothing to commit");
  }

  if (opts.dryRun) {
    console.log("\n--- dry run (index and remote untouched) ---");
    console.log(`would stage ${plan.files.length} file(s):\n  ${plan.files.join("\n  ")}`);
    if (plan.forks.length) console.log(`skipped ${plan.forks.length} sync-fork untracked path(s), e.g. ${plan.forks[0]}`);
    console.log(`\ncommit subject: ${subject}`);
    console.log(`push: git push -u origin ${branch}`);
    console.log(`pr:   gh pr create --base ${opts.base} --head ${branch}`);
    console.log(`wait: ${required.join(", ") || "all checks"} (interval ${opts.interval}s, timeout ${opts.timeoutMinutes}m)`);
    console.log(`merge: ${opts.merge ? `gh pr merge --${opts.method}${opts.deleteBranch ? " --delete-branch" : ""}` : "(disabled: --no-merge)"}`);
    return;
  }

  // 1. Stage.
  if (opts.stage) {
    git(["add", "-u"]);
    for (const p of opts.adds) git(["add", "--", p]);
    if (opts.all) {
      const others = lines(git(["ls-files", "--others", "--exclude-standard"], { capture: true }).stdout);
      for (const p of others.filter((p) => !SYNC_FORK.test(p))) git(["add", "--", p]);
      if (plan.forks.length) console.log(`land: skipped ${plan.forks.length} sync-fork untracked path(s) (e.g. ${plan.forks[0]})`);
    }
  }
  const staged = lines(git(["diff", "--cached", "--name-only"], { capture: true }).stdout);
  if (staged.length === 0) die("nothing staged to commit after staging");

  // 2. Commit.
  console.log(`\nland: committing ${staged.length} file(s)...`);
  run("git", ["commit", "-m", message]);

  // 3. Push.
  console.log(`\nland: pushing '${branch}'...`);
  git(["push", "-u", "origin", "HEAD"]);

  // 4. Reuse or open the PR.
  let pr = ghJson(["pr", "view", branch, "--json", "number,url,state"]);
  if (!pr || !pr.number) {
    console.log("\nland: opening pull request...");
    const created = run(
      "gh",
      ["pr", "create", "--base", opts.base, "--head", branch, "--title", subject, "--body", body || subject],
      { capture: true },
    );
    const url = created.stdout.trim().split("\n").pop();
    pr = ghJson(["pr", "view", branch, "--json", "number,url,state"]);
    if (!pr?.number) { console.error(created.stdout); die("pull request was created but could not be resolved"); }
    console.log(`land: PR #${pr.number} ${url}`);
  } else {
    console.log(`\nland: reusing PR #${pr.number} ${pr.url}`);
  }

  // 5. Watch required checks.
  const watched = await waitForChecks(pr.number, required, opts);
  if (!watched.ok) {
    console.error(`\nland: not merging. Inspect: gh pr checks ${pr.number}  (PR ${pr.url})`);
    process.exit(1);
  }

  if (!opts.merge) {
    console.log(`\nland: checks green; --no-merge set, leaving PR #${pr.number} open: ${pr.url}`);
    return;
  }

  // 6. Merge.
  console.log(`\nland: merging PR #${pr.number} (--${opts.method})...`);
  const mergeArgs = ["pr", "merge", String(pr.number), `--${opts.method}`];
  if (opts.deleteBranch) mergeArgs.push("--delete-branch");
  const merged = run("gh", mergeArgs, { allowFailure: true });
  if (merged.status !== 0) {
    die(`merge failed (PR left open): ${pr.url}`, merged.status ?? 1);
  }

  // 7. Return to the base branch and sync.
  console.log(`\nland: syncing '${opts.base}'...`);
  git(["checkout", opts.base], { allowFailure: true });
  git(["pull", "--ff-only"], { allowFailure: true });

  console.log(`\nland: done — PR #${pr.number} merged into '${opts.base}'.`);
}

main().catch((error) => die(error instanceof Error ? error.message : String(error)));
