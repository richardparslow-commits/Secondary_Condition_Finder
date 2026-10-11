#!/usr/bin/env node
/**
 * Pre-commit gate: PHI-boundary logging audit.
 *
 * Scans source files for `console.*` call sites that would let the runtime
 * serialize whatever it holds into the platform log sink, and for any direct
 * `console` call inside a `"use server"` module (request-derived by
 * construction). Exits non-zero on the first violation class found, so it can
 * guard a commit or run in CI.
 *
 * Scope matches the ESLint rule in `eslint.config.mjs`: the shipped application
 * surface under `src/` is the only code that runs inside the process serving a
 * veteran's request, so it is the only place a `console` argument can become a
 * platform log line. Build/audit/CI tooling under `scripts/` executes on a
 * workstation or a CI runner and is deliberately out of scope — scanning it here
 * while the rule excludes it would make the two gates disagree.
 *
 * Usage:
 *   node scripts/audit-phi-logging.mjs              # scan src/
 *   node scripts/audit-phi-logging.mjs --staged      # scan git-staged files (hook mode)
 *   node scripts/audit-phi-logging.mjs --all         # scan src/, tests/, eslint-rules/
 *   node scripts/audit-phi-logging.mjs --json        # machine-readable report
 *
 * This is the same invariant the ESLint rule enforces
 * (eslint-rules/no-unsafe-logging.mjs), implemented lexically so it can run
 * before lint. `tests/phi-logging-boundary.test.ts` runs both against the real
 * tree so neither implementation can drift into weakness unnoticed.
 *
 * Wiring it as a hook: this repository intentionally has no hook runner
 * installed (no husky/lint-staged, `core.hooksPath` unset), so the durable
 * enforcement point is `npm run lint` (the ESLint rule) plus CI. To use it as a
 * pre-commit hook locally:
 *   echo '#!/bin/sh' > .git/hooks/pre-commit
 *   echo 'node scripts/audit-phi-logging.mjs --staged' >> .git/hooks/pre-commit
 *   chmod +x .git/hooks/pre-commit
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { SANCTIONED_SINKS, scanSource } from "./lib/phi-logging-scan.mjs";

const repositoryRoot = process.cwd();
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs"];

const argv = process.argv.slice(2);
const useStaged = argv.includes("--staged");
const scanAll = argv.includes("--all");
const asJson = argv.includes("--json");

const DEFAULT_ROOTS = ["src"];
const ALL_ROOTS = ["src", "tests", "eslint-rules"];

function listSourceFiles(root) {
  const absolute = path.join(repositoryRoot, root);
  if (!fs.existsSync(absolute)) return [];
  const entries = fs.readdirSync(absolute, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const relative = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
      return listSourceFiles(relative);
    }
    return SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))
      ? [relative]
      : [];
  });
}

function stagedFiles() {
  const output = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        SOURCE_EXTENSIONS.some((extension) => line.endsWith(extension)) &&
        fs.existsSync(path.join(repositoryRoot, line)),
    );
}

const sanctionedSinks = new Set(SANCTIONED_SINKS);
const files = (useStaged
  ? stagedFiles()
  : (scanAll ? ALL_ROOTS : DEFAULT_ROOTS).flatMap(listSourceFiles)
).filter((file) => !sanctionedSinks.has(file.split(path.sep).join("/")));

const findings = [];
for (const file of files) {
  const source = fs.readFileSync(path.join(repositoryRoot, file), "utf8");
  const isServerAction = /^\s*["']use server["']/m.test(source);
  for (const finding of scanSource(source, { isServerAction })) {
    findings.push({ file, ...finding });
  }
}

if (asJson) {
  process.stdout.write(
    `${JSON.stringify({ scanned: files.length, findings }, null, 2)}\n`,
  );
} else if (findings.length === 0) {
  process.stdout.write(
    `PHI logging audit: ${files.length} file(s) scanned, no violations.\n`,
  );
} else {
  process.stderr.write(
    `PHI logging audit: ${findings.length} violation(s) across ${files.length} scanned file(s).\n\n`,
  );
  for (const finding of findings) {
    process.stderr.write(
      `  ${finding.file}:${finding.line}  console.${finding.method}  [${finding.code}] ${finding.detail}\n`,
    );
  }
  process.stderr.write(
    "\nEvery console argument is serialized by the runtime into the platform log sink.\n" +
      "Emit a single bounded string, or route through @/lib/observability/logger.\n",
  );
}

process.exitCode = findings.length === 0 ? 0 : 1;
