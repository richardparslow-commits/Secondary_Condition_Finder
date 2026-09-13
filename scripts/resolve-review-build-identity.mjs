#!/usr/bin/env node
/**
 * Resolve the exact production build identity for a manual Section 508 review
 * session (issue #195).
 *
 * WHY THIS EXISTS
 * `docs/section508-manual-review-workbook.md` records the build a human tester
 * reviewed. Hardcoded build identifiers go stale as soon as `main` advances, and
 * a stale identifier silently points the tester at a superseded build. Issue #195
 * requires that evidence from different builds never be merged without being
 * identified separately, so this script resolves the identifiers live at the
 * moment the session starts instead of relying on a committed constant.
 *
 * SCOPE LIMIT — READ THIS
 * This script emits **build identity and reachability only**: commit SHA, Vercel
 * deployment id, CI run, Production Runtime Readiness run, and an HTTP status
 * probe. It emits **no accessibility result of any kind**. Per issue #195,
 * automated checks, route reachability, and exact-deployment verification are
 * supporting evidence only and are never a substitute for human keyboard,
 * assistive-technology, zoom/reflow, contrast, or forced-colors testing.
 * A HTTP 200 from this script is not an accessibility PASS.
 *
 * Usage:
 *   node scripts/resolve-review-build-identity.mjs [--sha=<sha>] [--json]
 *                                                  [--url=<production-url>]
 *
 * Requires the `gh` CLI (authenticated) for commit status and workflow runs.
 * Prints no secret value, header value, cookie, or response body.
 */

import { execFileSync } from "node:child_process";

const DEFAULT_PRODUCTION_URL = "https://secondary-condition-finder.vercel.app";

export function parseArgs(argv) {
  const args = { sha: null, json: false, url: DEFAULT_PRODUCTION_URL };
  for (const arg of argv) {
    if (arg.startsWith("--sha=")) args.sha = arg.slice("--sha=".length).trim() || null;
    else if (arg.startsWith("--url=")) args.url = arg.slice("--url=".length).trim() || DEFAULT_PRODUCTION_URL;
    else if (arg === "--json") args.json = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

/** Run a command and return trimmed stdout, or null when it fails. */
function tryRun(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 60_000,
    }).trim();
  } catch {
    return null;
  }
}

function gh(args) {
  return tryRun("gh", args);
}

function resolveRepo() {
  const out = gh(["repo", "view", "--json", "owner,name"]);
  if (!out) return null;
  try {
    const parsed = JSON.parse(out);
    const owner = parsed?.owner?.login;
    const name = parsed?.name;
    return owner && name ? `${owner}/${name}` : null;
  } catch {
    return null;
  }
}

function resolveSha(explicitSha) {
  if (explicitSha) return explicitSha;
  // Prefer the pushed main over the local checkout: the review targets the
  // deployed production build, not uncommitted local work.
  return (
    tryRun("git", ["rev-parse", "origin/main"]) ??
    tryRun("git", ["rev-parse", "HEAD"])
  );
}

/**
 * Derive the Vercel deployment id from a commit-status target URL.
 * Mirrors `.github/workflows/production-runtime-readiness.yml` so the workbook
 * and the readiness workflow always name the same deployment.
 */
export function deploymentIdFromTargetUrl(targetUrl) {
  if (typeof targetUrl !== "string") return null;
  const trimmed = targetUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  const slug = trimmed.split("/").filter(Boolean).pop();
  if (!slug) return null;
  return slug.startsWith("dpl_") ? slug : `dpl_${slug}`;
}

/** Pick the newest run for a workflow, or null. */
function newestRun(repo, sha, workflowFile) {
  const out = gh([
    "api",
    `repos/${repo}/actions/workflows/${workflowFile}/runs?head_sha=${sha}&per_page=5`,
  ]);
  if (!out) return null;
  try {
    const runs = JSON.parse(out)?.workflow_runs;
    if (!Array.isArray(runs) || runs.length === 0) return null;
    const run = runs[0];
    return {
      id: String(run.id ?? ""),
      number: run.run_number ?? null,
      conclusion: run.conclusion ?? run.status ?? "unknown",
      url: run.html_url ?? "",
    };
  } catch {
    return null;
  }
}

function resolveVercelDeployment(repo, sha) {
  const out = gh(["api", `repos/${repo}/commits/${sha}/status`]);
  if (!out) return { deploymentId: null, state: "unavailable" };
  try {
    const statuses = JSON.parse(out)?.statuses ?? [];
    const vercel = statuses.find((entry) => entry?.context === "Vercel");
    if (!vercel) return { deploymentId: null, state: "missing" };
    return {
      deploymentId: deploymentIdFromTargetUrl(vercel.target_url),
      state: vercel.state ?? "unknown",
    };
  } catch {
    return { deploymentId: null, state: "unavailable" };
  }
}

/** HEAD probe recording only the HTTP status code — never body or headers. */
async function probeReachability(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    const response = await fetch(url, { method: "HEAD", signal: controller.signal });
    clearTimeout(timer);
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: null };
  }
}

const UNKNOWN = "UNRESOLVED";

/** Render the workbook session-identity rows. Identity only — no results. */
export function formatWorkbookRows(identity) {
  const row = (label, value) => `| ${label} | ${value ?? UNKNOWN} |`;
  return [
    row("Deployed `main` commit SHA", identity.sha ? `\`${identity.sha}\`` : UNKNOWN),
    row("Vercel production deployment ID", identity.deploymentId ? `\`${identity.deploymentId}\`` : UNKNOWN),
    row("Vercel commit status", identity.vercelState ?? UNKNOWN),
    row("Main CI run", identity.ciRun ? `${identity.ciRun} (${identity.ciConclusion})` : UNKNOWN),
    row("Production Runtime Readiness run", identity.readinessRun ? `${identity.readinessRun} (${identity.readinessConclusion})` : UNKNOWN),
    row("Production URL", `\`${identity.url}\``),
    row("Production URL reachability (HTTP status only)", identity.httpStatus ?? UNKNOWN),
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(
      [
        "Usage: node scripts/resolve-review-build-identity.mjs [--sha=<sha>] [--url=<url>] [--json]",
        "",
        "Resolves production build identity for a manual Section 508 review session.",
        "Emits build identity and HTTP reachability only — never an accessibility result.",
      ].join("\n"),
    );
    return 0;
  }

  const repo = resolveRepo();
  const sha = resolveSha(args.sha);

  if (!repo || !sha) {
    console.error("Could not resolve the repository or commit SHA. Run from the repository with gh authenticated.");
    return 1;
  }

  const vercel = resolveVercelDeployment(repo, sha);
  const ci = newestRun(repo, sha, "ci.yml");
  const readiness = newestRun(repo, sha, "production-runtime-readiness.yml");
  const probe = await probeReachability(args.url);

  const identity = {
    sha,
    url: args.url,
    deploymentId: vercel.deploymentId,
    vercelState: vercel.state,
    ciRun: ci?.id ?? null,
    ciConclusion: ci?.conclusion ?? null,
    readinessRun: readiness?.id ?? null,
    readinessConclusion: readiness?.conclusion ?? null,
    httpStatus: probe.status === null ? "unreachable" : String(probe.status),
  };

  if (args.json) {
    console.log(JSON.stringify(identity, null, 2));
    return 0;
  }

  console.log("# Section 508 review — resolved production build identity");
  console.log("");
  console.log(`Resolved at ${new Date().toISOString()} for repository ${repo}.`);
  console.log("");
  console.log("| Field | Recorded value |");
  console.log("|---|---|");
  console.log(formatWorkbookRows(identity));
  console.log("");
  console.log("## Scope of this output");
  console.log("");
  console.log(
    "These values identify the build under review. They are **supporting evidence only**. " +
    "They are not keyboard, assistive-technology, zoom/reflow, contrast, or forced-colors " +
    "results, and an HTTP 200 is not an accessibility PASS. Record human results separately " +
    "in the workbook evidence tables per issue #195.",
  );
  console.log("");
  if (!vercel.deploymentId || vercel.state !== "success") {
    console.log(
      `WARNING: the Vercel commit status for this SHA is '${vercel.state}' and the deployment ` +
      "id could not be confirmed. Do not begin a review session until the production alias " +
      "provably serves this exact commit.",
    );
  }

  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "");

if (invokedDirectly) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    },
  );
}
