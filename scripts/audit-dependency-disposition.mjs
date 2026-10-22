#!/usr/bin/env node
/**
 * Dependency advisory disposition gate (audit A10, item 25).
 *
 * `npm run audit:high` enforces severities for the *production* tree and passes
 * today. The full tree cannot pass while an advisory has no published fix:
 * `braces` is affected in every release (`introduced: 0` … `last_affected:
 * 3.0.3`, and 3.0.3 is the newest release) and `sprintf-js` likewise
 * (`… last_affected: 1.1.3`, the newest release). npm's own "fix" for both is
 * `npm audit fix --force`, which downgrades `eslint-config-next` two major lines
 * back to 14.2.35 — a larger, untested supply-chain change than the advisory it
 * removes, and exactly what SECURITY.md forbids. So the honest posture is not a
 * green audit: it is an explicit, dated, machine-checked record of every
 * reported advisory, why it is tolerable, what would have to change for it to be
 * reached, and what fails the build when that record stops being true.
 *
 * That record is `docs/dependency-advisory-disposition.json`, and this script is
 * what holds it to the tree. It fails on:
 *
 *   - a reported advisory the register does not classify (new debt, which used
 *     to be a line in a non-blocking log step);
 *   - a registered advisory the audit no longer reports, a changed severity, a
 *     changed set of affected packages, a moved installed version, a `ships`
 *     class that disagrees with the lockfile's dev flags, or an expired review
 *     window (the record drifted away from the tree);
 *   - a repaired release that now exists, and any entry marked
 *     `upgrade-required` (the upgrade is owed, not a tracking note);
 *   - an advisory marked `withdrawn-upstream` that the audit reports again (the
 *     withdrawal did not hold), which is the inverse of the staleness check.
 *
 * Severity enforcement for production dependencies deliberately stays with
 * `npm run audit:high`; this gate governs inventory completeness, classification
 * and freshness, and never weakens or replaces that threshold.
 *
 * Usage:
 *   node scripts/audit-dependency-disposition.mjs
 *   node scripts/audit-dependency-disposition.mjs --check-registry   # asks OSV
 *   node scripts/audit-dependency-disposition.mjs --report=tmp/audit.json
 *   node scripts/audit-dependency-disposition.mjs --json
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_REVIEW_WINDOW_DAYS,
  advisoriesFromAuditReport,
  evaluateDependencyDisposition,
  patchedVersionFromOsv,
  resolveRegistryPatches,
} from "./lib/dependency-advisory-disposition.mjs";

const repositoryRoot = process.cwd();
const REGISTER_PATH = "docs/dependency-advisory-disposition.json";
const LOCKFILE_PATH = "package-lock.json";
const OSV_ENDPOINT = "https://api.osv.dev/v1/vulns";

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const checkRegistry = argv.includes("--check-registry");
const reportArgument = argv.find((argument) => argument.startsWith("--report="));
const reportPath = reportArgument ? reportArgument.slice("--report=".length) : null;

/** Reads a repository-relative or absolute path; `--report` may be either. */
function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(repositoryRoot, relativePath), "utf8"));
}

/**
 * `npm audit` exits non-zero whenever it reports anything, so its status is not
 * the signal here: the JSON report is. A run that produced no parsable report at
 * all is a hard failure rather than an empty (and therefore passing) result.
 */
function runAuditJson() {
  try {
    return execFileSync("npm", ["audit", "--json"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    if (typeof error?.stdout === "string" && error.stdout.includes("{")) return error.stdout;
    throw error;
  }
}

function parseAuditReport(raw) {
  const start = raw.indexOf("{");
  if (start === -1) throw new Error("npm audit produced no JSON report");
  return JSON.parse(raw.slice(start));
}

/** Ask OSV for the repair version of one advisory. Network use is opt-in. */
async function lookupOsv(advisoryId) {
  const response = await fetch(`${OSV_ENDPOINT}/${advisoryId}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`OSV responded ${response.status} ${response.statusText}`);
  }
  return { patchedVersion: patchedVersionFromOsv(await response.json()) };
}

async function main() {
  const register = readJson(REGISTER_PATH);
  const lockfile = readJson(LOCKFILE_PATH);

  let report;
  try {
    report = reportPath ? readJson(reportPath) : parseAuditReport(runAuditJson());
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `Dependency advisory disposition: FAIL — the audit report could not be read (${detail}).\n` +
        "Run `npm ci` first, or pass --report=<path> with a captured `npm audit --json` output.\n",
    );
    process.exitCode = 1;
    return;
  }

  let registry = null;
  const registryFailures = [];
  if (checkRegistry) {
    // A withdrawn advisory no longer exists in the database, so asking OSV for
    // its repair version would fail closed on a 404 for a record that is
    // correct. Only live classifications are re-checked.
    const ids = (register.entries ?? [])
      .filter((entry) => entry?.disposition !== "withdrawn-upstream")
      .map((entry) => entry.advisory)
      .filter(Boolean);
    const resolved = await resolveRegistryPatches(ids, lookupOsv);
    registry = resolved.patches;
    registryFailures.push(...resolved.failures);
  }

  const { failures, notes } = evaluateDependencyDisposition({
    report,
    register,
    lockfile,
    registry,
  });
  const allFailures = [...failures, ...registryFailures];
  const advisories = advisoriesFromAuditReport(report);
  const windowDays = register.reviewWindowDays ?? DEFAULT_REVIEW_WINDOW_DAYS;

  if (asJson) {
    process.stdout.write(
      `${JSON.stringify(
        {
          register: REGISTER_PATH,
          reviewWindowDays: windowDays,
          registryChecked: checkRegistry,
          reported: advisories.map((advisory) => ({
            id: advisory.id,
            severity: advisory.severity,
            advisoryRange: advisory.advisoryRange,
            packages: advisory.packages,
          })),
          notes,
          failures: allFailures,
        },
        null,
        2,
      )}\n`,
    );
    process.exitCode = allFailures.length === 0 ? 0 : 1;
    return;
  }

  const summary =
    `  ${advisories.length} advisory chain(s) reported by the full-tree audit; ` +
    `${(register.entries ?? []).length} classified in ${REGISTER_PATH} (review window ${windowDays} days)` +
    `${checkRegistry ? "; repair versions re-checked against the advisory database" : ""}.\n`;
  for (const advisory of advisories) {
    process.stdout.write(
      `    ${advisory.id} [${advisory.severity}] ${advisory.packages.join(", ")} — ${advisory.advisoryRange}\n`,
    );
  }

  if (allFailures.length === 0) {
    process.stdout.write(`Dependency advisory disposition: PASS\n${summary}`);
    for (const note of notes) process.stdout.write(`    ${note}\n`);
    process.exitCode = 0;
    return;
  }

  process.stderr.write(
    `Dependency advisory disposition: FAIL — ${allFailures.length} problem(s).\n${summary}\n`,
  );
  for (const failure of allFailures) {
    process.stderr.write(`  [${failure.code}] ${failure.detail}\n`);
  }
  process.stderr.write(
    "\nEach problem above is either new advisory debt or a record that no longer matches\n" +
      "the tree. Classify the advisory in the register, land the upgrade, or refresh the\n" +
      "entry — do not lower a diagnostic level or add a type/lint escape to pass this gate.\n" +
      "\n" +
      "Severity enforcement for production dependencies stays with `npm run audit:high`\n" +
      "(`--omit=dev --audit-level=high`); this gate governs inventory completeness,\n" +
      "classification and freshness. Do not apply `npm audit fix --force`: for the\n" +
      "advisories currently recorded it downgrades `eslint-config-next` two major lines.\n" +
      "\n" +
      "Re-check repairs and review windows with:\n" +
      "  node scripts/audit-dependency-disposition.mjs --check-registry\n",
  );
  process.exitCode = 1;
}

await main();
