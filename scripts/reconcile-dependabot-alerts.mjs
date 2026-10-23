#!/usr/bin/env node
/**
 * Reconcile open GitHub Dependabot alerts with the dependency disposition
 * register and, when asked, dismiss the ones that no longer describe the tree.
 *
 * `docs/dependency-advisory-disposition.json` remains the enforced risk record
 * and `npm run audit:disposition` remains its gate. This command has one job:
 * explain each open Dependabot alert against the installed lockfile and the
 * register, so a stale or withdrawn alert does not sit beside live debt and
 * make the dashboard unreadable.
 *
 * Usage:
 *   GH_TOKEN=$(gh auth token) node scripts/reconcile-dependabot-alerts.mjs
 *   GH_TOKEN=$(gh auth token) node scripts/reconcile-dependabot-alerts.mjs --dismiss-resolved
 *   node scripts/reconcile-dependabot-alerts.mjs --alerts=tmp/alerts.json
 *   node scripts/reconcile-dependabot-alerts.mjs --json --report=tmp/reconciliation.json
 *
 * Exit 0 means every open alert is either live and registered, withdrawn and
 * recorded, or no longer affecting an installed version. Exit 1 means an alert
 * affects the installed tree without a register entry, the register claims a
 * live advisory that the installed version is outside, or an alert could not be
 * evaluated. `--dismiss-resolved` only acts when there are no failures.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  classifyDependabotAlerts,
  countByClassification,
  dismissalComment,
} from "./lib/dependabot-alert-reconciliation.mjs";

const REGISTER_PATH = "docs/dependency-advisory-disposition.json";
const LOCKFILE_PATH = "package-lock.json";
const API_ROOT = "https://api.github.com";

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const dismissResolved = argv.includes("--dismiss-resolved");
const alertsArgument = argv.find((argument) => argument.startsWith("--alerts="));
const reportArgument = argv.find((argument) => argument.startsWith("--report="));
const repoArgument = argv.find((argument) => argument.startsWith("--repo="));
const alertsPath = alertsArgument ? alertsArgument.slice("--alerts=".length) : null;
const reportPath = reportArgument ? reportArgument.slice("--report=".length) : null;
const repoArgumentValue = repoArgument ? repoArgument.slice("--repo=".length) : null;

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8"));
}

function resolveRepo() {
  if (repoArgumentValue) return repoArgumentValue;
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  try {
    const remote = execFileSync("git", ["remote", "get-url", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const match = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/.exec(remote);
    if (match) return `${match[1]}/${match[2]}`;
  } catch {
    // Fall through to the gh lookup so the error names the missing input.
  }
  try {
    return execFileSync("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new Error(
      "could not resolve the repository; pass --repo=owner/repo or set GITHUB_REPOSITORY",
    );
  }
}

function token() {
  const value = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (!value) {
    throw new Error(
      "GITHUB_TOKEN or GH_TOKEN is required to read Dependabot alerts; " +
        "for a local gh login run `GH_TOKEN=$(gh auth token) npm run audit:dependabot`",
    );
  }
  return value;
}

async function request(pathname, { method = "GET", body } = {}) {
  return fetch(`${API_ROOT}${pathname}`, {
    method,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token()}`,
      "x-github-api-version": "2022-11-28",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function failure(response, method, pathname) {
  const detail = await response.text().catch(() => "");
  return new Error(
    `GitHub ${method} ${pathname} responded ${response.status} ${response.statusText}` +
      (detail ? `: ${detail.slice(0, 300)}` : ""),
  );
}

async function github(pathname, options = {}) {
  const response = await request(pathname, options);
  if (!response.ok) throw await failure(response, options.method ?? "GET", pathname);
  return response.json();
}

async function fetchOpenAlerts(repo) {
  const alerts = [];
  // The Dependabot alerts endpoint does not accept `page`; it paginates with
  // cursor links. Follow its own `rel="next"` rather than assuming one page.
  let next = `/repos/${repo}/dependabot/alerts?state=open&per_page=100`;
  while (next) {
    const response = await request(next);
    if (!response.ok) throw await failure(response, "GET", next);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error("Dependabot alerts response was not an array");
    alerts.push(...batch);
    const link = response.headers.get("link") ?? "";
    const match = /<([^>]+)>;\s*rel="next"/.exec(link);
    next = match ? match[1].replace(API_ROOT, "") : null;
  }
  return alerts;
}

async function dismissAlert(repo, row) {
  const comment = dismissalComment(row);
  return github(`/repos/${repo}/dependabot/alerts/${row.number}`, {
    method: "PATCH",
    body: {
      // The update schema requires `state`; a reason alone is a 422, even
      // though `dismissed_reason` is the field that carries the decision.
      state: "dismissed",
      dismissed_reason: "inaccurate",
      dismissed_comment: comment.length > 280 ? `${comment.slice(0, 277)}...` : comment,
    },
  });
}

async function main() {
  const register = readJson(REGISTER_PATH);
  const lockfile = readJson(LOCKFILE_PATH);
  const repo = alertsPath ? repoArgumentValue : resolveRepo();
  if (dismissResolved && !repo) {
    throw new Error("--dismiss-resolved needs --repo when --alerts is used");
  }
  const alerts = alertsPath ? readJson(alertsPath) : await fetchOpenAlerts(repo);
  const { rows, failures, dismissible } = classifyDependabotAlerts({
    alerts,
    register,
    lockfile,
    registerPath: REGISTER_PATH,
  });
  const counts = countByClassification(rows);

  const result = {
    register: REGISTER_PATH,
    lockfile: LOCKFILE_PATH,
    repository: repo,
    alerts: rows,
    failures,
    dismissible: dismissible.map((row) => row.number),
    dismissed: [],
    counts,
  };

  if (!asJson) {
    process.stdout.write(
      `Dependabot alert reconciliation against ${REGISTER_PATH}\n` +
        `  ${rows.length} open alert(s); ${failures.length} problem(s)\n\n`,
    );
    for (const row of rows) {
      process.stdout.write(
        `  #${row.number ?? "?"} ${row.advisory ?? "(no advisory)"} ${row.package ?? "(no package)"} ` +
          `[${row.severity ?? "unknown"}] installed ${row.installedLabel} — ` +
          `${row.classification}${row.registerDisposition ? ` (register: ${row.registerDisposition})` : ""}\n`,
      );
    }
    process.stdout.write("\n");
  }

  if (failures.length > 0) {
    if (!asJson) {
      for (const failure of failures) {
        process.stderr.write(`  [${failure.code}] ${failure.detail}\n`);
      }
      process.stderr.write(
        "\nNo alert was dismissed: a live, unregistered or unreadable alert must be\n" +
          `classified in ${REGISTER_PATH} or fixed first.\n`,
      );
    }
    result.dismissed = [];
  } else if (dismissResolved && dismissible.length > 0) {
    for (const row of dismissible) {
      try {
        await dismissAlert(repo, row);
        result.dismissed.push(row.number);
        if (!asJson) {
          process.stdout.write(`  dismissed #${row.number} as inaccurate: ${row.classification}\n`);
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        failures.push({ code: "dismissal-failed", detail: `#${row.number}: ${detail}` });
        if (!asJson) process.stderr.write(`  dismissal of #${row.number} failed: ${detail}\n`);
      }
    }
  } else if (!asJson && dismissible.length > 0) {
    process.stdout.write(
      `  ${dismissible.length} alert(s) are not live against the installed tree; ` +
        "re-run with --dismiss-resolved to close them (no failure is hidden).\n",
    );
  }

  if (reportPath) {
    fs.writeFileSync(path.resolve(process.cwd(), reportPath), `${JSON.stringify(result, null, 2)}\n`);
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }

  process.exitCode = failures.length === 0 ? 0 : 1;
}

try {
  await main();
} catch (error) {
  process.stderr.write(
    `Dependabot alert reconciliation: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
