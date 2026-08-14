/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const repositoryRoot = process.cwd();
const sourceRoot = path.join(repositoryRoot, "src");
const testsRoot = path.join(repositoryRoot, "tests");
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

function withoutSourceExtension(value) {
  return value.replace(/\.(?:[cm]?[jt]sx?)$/, "");
}

function canonicalModuleId(testFile, specifier) {
  if (specifier.startsWith("@/")) return withoutSourceExtension(specifier);
  if (!specifier.startsWith(".")) return specifier;

  const absolute = withoutSourceExtension(
    path.resolve(path.dirname(testFile), specifier),
  );
  const sourcePrefix = `${sourceRoot}${path.sep}`;
  if (!absolute.startsWith(sourcePrefix)) return absolute;

  const relative = path.relative(sourceRoot, absolute).split(path.sep).join("/");
  return `@/${relative}`;
}

function importedSpecifiers(file, source) {
  const specifiers = new Set();
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specifiers.add(canonicalModuleId(file, match[1]));
    }
  }
  return specifiers;
}

const testFiles = listTests(testsRoot);
const executableImports = new Set();
for (const file of testFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const specifier of importedSpecifiers(file, source)) {
    executableImports.add(specifier);
  }
}

const missing = REQUIRED_EXECUTABLE_IMPORTS.filter(
  (moduleId) => !executableImports.has(moduleId),
);
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
    `Critical-module executable import coverage is ${percent}%; required ${REQUIRED_PERCENT}%. Add executable test coverage for every missing audited module.`,
  );
  process.exitCode = 1;
}
