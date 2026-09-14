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

/* ------------------------------------------------------------------ *
 * Architecture rules (CRG, track separation, and security boundaries)
 * ------------------------------------------------------------------ */
function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return /\.(?:[cm]?[jt]sx?)$/.test(entry.name) ? [absolute] : [];
  });
}

const SERVER_ACTION_DIR = path.join(sourceRoot, "lib", "actions");
const CLIENT_BOUNDARY_FORBIDDEN = [
  "@/lib/kb",
  "@/lib/workflow-session-crypto",
  "@/lib/secondary-workflow/session",
  "@/lib/presumptive/session",
  "@/lib/store",
];
const EVIDENCE_PARSER_MODULES = [
  "@/lib/evidence/extract",
  "@/lib/evidence/document-extract",
];

const architecture = [];
let architectureClean = true;

function violation(rule, message) {
  architecture.push({ rule, status: "VIOLATION", message });
  architectureClean = false;
}

for (const file of sourceFiles(sourceRoot)) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(repositoryRoot, file).split(path.sep).join("/");
  const insideActionsDir = file.startsWith(`${SERVER_ACTION_DIR}${path.sep}`);

  if (source.includes('"use server"') && !insideActionsDir) {
    violation(
      "SERVER-ACTION-PLACEMENT",
      `${relative}: files with "use server" must live under src/lib/actions/`,
    );
  }

  if (source.includes('"use client"')) {
    for (const specifier of importedSpecifiers(file, source)) {
      const forbidden = CLIENT_BOUNDARY_FORBIDDEN.find((moduleId) =>
        specifier.startsWith(moduleId),
      );
      if (forbidden) {
        violation(
          "CLIENT-BOUNDARY",
          `${relative}: "use client" file imports server-only module ${specifier}`,
        );
      }
    }
  }

  const secondaryFile = relative.startsWith("src/lib/secondary-workflow/");
  const presumptiveFile = relative.startsWith("src/lib/presumptive/");
  for (const specifier of importedSpecifiers(file, source)) {
    if (
      secondaryFile &&
      specifier.startsWith("@/lib/presumptive") &&
      !specifier.includes("/types")
    ) {
      violation(
        "TRACK-SEPARATION",
        `${relative}: secondary-workflow may not import presumptive logic ${specifier}`,
      );
    }
    if (
      presumptiveFile &&
      (specifier.startsWith("@/lib/secondary-workflow") ||
        specifier.startsWith("@/lib/kb") ||
        specifier.startsWith("@/lib/engine")) &&
      !specifier.includes("/types")
    ) {
      violation(
        "TRACK-SEPARATION",
        `${relative}: presumptive may not import secondary/KB/engine logic ${specifier}`,
      );
    }
    if (
      relative.startsWith("src/app/") &&
      EVIDENCE_PARSER_MODULES.some((moduleId) => specifier.startsWith(moduleId))
    ) {
      violation(
        "EVIDENCE-PARSER-BOUNDARY",
        `${relative}: evidence parsers may only be imported from "use client" components or lib, never from app pages/actions (see docs/evidence-parser-boundary.md)`,
      );
    }
  }
}

if (architecture.length === 0) {
  architecture.push({ rule: "architecture", status: "PASS", message: "All architecture boundary checks passed." });
}

const report = {
  testFiles: testFiles.length,
  criticalModules: REQUIRED_EXECUTABLE_IMPORTS.length,
  executableImportsCovered: covered,
  executableImportCoveragePercent: percent,
  requiredPercent: REQUIRED_PERCENT,
  missing,
  architectureRules: architecture.length - (architectureClean ? 1 : 0),
  architectureClean,
  architecture,
};

console.log(JSON.stringify(report, null, 2));

if (percent < REQUIRED_PERCENT) {
  console.error(
    `Critical-module executable import coverage is ${percent}%; required ${REQUIRED_PERCENT}%. Add executable test coverage for every missing audited module.`,
  );
  process.exitCode = 1;
}
if (!architectureClean) {
  console.error(
    "Architecture boundary violations detected. See architecture entries above.",
  );
  process.exitCode = 1;
}
