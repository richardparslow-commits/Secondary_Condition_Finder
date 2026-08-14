/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const testsRoot = path.join(process.cwd(), "tests");
const REQUIRED_EXECUTABLE_IMPORTS = [
  "@/lib/engine/recommend",
  "@/lib/engine/export",
  "@/lib/kb/schema",
  "@/lib/presumptive/match",
  "@/lib/presumptive/session",
  "@/lib/workflow-session-crypto",
  "@/lib/secondary-workflow/session",
  "@/lib/evidence/extract",
  "@/lib/evidence/document-extract",
  "@/lib/va/sandbox",
  "@/lib/va/reference-cache",
  "@/lib/va/forms-finder",
];
const REQUIRED_PERCENT = 100;

function listTests(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listTests(absolute);
    return entry.name.endsWith(".test.ts") ? [absolute] : [];
  });
}

const testFiles = listTests(testsRoot);
const testSources = testFiles.map((file) => ({
  file,
  source: fs.readFileSync(file, "utf8"),
}));

function moduleIsImported(moduleId) {
  const escaped = moduleId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const importPattern = new RegExp(
    `(?:from\\s+|import\\s*\\()(["'])${escaped}\\1`,
  );
  return testSources.some(({ source }) => importPattern.test(source));
}

const missing = REQUIRED_EXECUTABLE_IMPORTS.filter((moduleId) => !moduleIsImported(moduleId));
const covered = REQUIRED_EXECUTABLE_IMPORTS.length - missing.length;
const percent = Math.floor((covered / REQUIRED_EXECUTABLE_IMPORTS.length) * 100);

const report = {
  testFiles: testFiles.length,
  criticalModules: REQUIRED_EXECUTABLE_IMPORTS.length,
  executableImportsCovered: covered,
  executableImportCoveragePercent: percent,
  requiredPercent: REQUIRED_PERCENT,
  missing,
};

console.log(JSON.stringify(report, null, 2));

if (percent < REQUIRED_PERCENT) {
  console.error(
    `Critical-module executable import coverage is ${percent}%; required ${REQUIRED_PERCENT}%. Add behavioral test coverage rather than a source-string-only assertion.`,
  );
  process.exitCode = 1;
}
