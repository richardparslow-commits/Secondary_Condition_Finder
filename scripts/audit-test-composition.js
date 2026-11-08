/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const ts = require("typescript");
const path = require("path");

const repositoryRoot = process.cwd();
const sourceRoot = path.join(repositoryRoot, "src");
const testsRoot = path.join(repositoryRoot, "tests");
const REQUIRED_EXECUTABLE_IMPORTS = [
  "@/lib/engine/recommend",
  "@/lib/engine/export",
  "@/lib/kb/schema",
  "@/lib/presumptive/match",
  "@/lib/presumptive/browser-history",
  "@/lib/workflow-session-crypto",
  "@/lib/secondary-workflow/browser-context",
  "@/lib/evidence/extract",
  "@/lib/evidence/document-extract",
  "@/lib/evidence/ocr-session",
  "@/lib/va/sandbox",
  "@/lib/va/reference-cache",
  "@/lib/va/forms-finder",
  // The outbound retry/429 policy and the sandbox demo-fixture seam. Both decide
  // whether a VA request is made and what a caller sees when it is not, and the
  // fixture seam additionally decides whether synthetic veteran data may be
  // served at all — so its gate must not be able to lose its coverage quietly.
  "@/lib/va/api",
  "@/lib/va/account/demo-fixtures",
  "@/lib/va/account/transport",
  "@/lib/observability/logger",
];
const REQUIRED_PERCENT = 100;

function listTests(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listTests(absolute);
    return /\.test\.tsx?$/.test(entry.name) ? [absolute] : [];
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

function importIsTypeOnly(importClause) {
  if (!importClause) return false;
  if (importClause.isTypeOnly) return true;

  const bindings = importClause.namedBindings;
  return (
    !importClause.name &&
    bindings &&
    ts.isNamedImports(bindings) &&
    bindings.elements.length > 0 &&
    bindings.elements.every((element) => element.isTypeOnly)
  );
}

function exportIsTypeOnly(exportDeclaration) {
  if (exportDeclaration.isTypeOnly) return true;

  const clause = exportDeclaration.exportClause;
  return (
    clause &&
    ts.isNamedExports(clause) &&
    clause.elements.length > 0 &&
    clause.elements.every((element) => element.isTypeOnly)
  );
}

function hasDirective(file, source, directive) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  for (const statement of sourceFile.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isStringLiteral(statement.expression)
    ) {
      break;
    }
    if (statement.expression.text === directive) return true;
  }
  return false;
}

function importedSpecifiers(file, source) {
  const specifiers = new Set();
  const add = (node) => {
    if (
      node &&
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ) {
      specifiers.add(canonicalModuleId(file, node.text));
    }
  };

  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      if (!importIsTypeOnly(node.importClause)) add(node.moduleSpecifier);
    } else if (ts.isExportDeclaration(node)) {
      if (!exportIsTypeOnly(node)) add(node.moduleSpecifier);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      add(node.arguments[0]);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      !node.isTypeOnly &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node.moduleReference.expression);
    }
    ts.forEachChild(node, visit);
  }

  visit(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true));
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
  // Retired 2026-10-08 with the presumptive Server Action; kept as a guard so a
  // server-side session module cannot reappear at this path unnoticed.
  "@/lib/presumptive/session",
  "@/lib/store",
];
const EVIDENCE_PARSER_MODULES = [
  "@/lib/evidence/extract",
  "@/lib/evidence/document-extract",
  "@/lib/evidence/ocr-session",
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

  if (hasDirective(file, source, "use server") && !insideActionsDir) {
    violation(
      "SERVER-ACTION-PLACEMENT",
      `${relative}: files with "use server" must live under src/lib/actions/`,
    );
  }

  if (hasDirective(file, source, "use client")) {
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
