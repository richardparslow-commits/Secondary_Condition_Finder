/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { auditAction, validateRin } = require("./lib/regulatory-intelligence");

const root = process.cwd();
const directory = path.join(root, "data", "regulatory-actions");
const asOfArg = process.argv.find(arg => arg.startsWith("--as-of="));
const asOf = asOfArg ? asOfArg.slice("--as-of=".length) : new Date().toISOString().slice(0, 10);
const files = fs.existsSync(directory) ? fs.readdirSync(directory).filter(file => file.endsWith(".json") && !file.startsWith("_")).sort() : [];
const errors = [];
const warnings = [];
const actions = [];
const seenRins = new Set();
const seenDocs = new Set();

for (const file of files) {
  let action;
  try { action = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")); }
  catch (error) { errors.push(`${file}: invalid JSON: ${error.message}`); continue; }
  actions.push({ file, action });
  const expected = path.basename(file, ".json").toUpperCase();
  if (!validateRin(expected)) errors.push(`${file}: filename must be a RIN such as 2900-AQ73.json`);
  if (action.rin !== expected) errors.push(`${file}: action RIN '${action.rin}' does not match filename '${expected}'`);
  if (seenRins.has(action.rin)) errors.push(`${file}: duplicate RIN '${action.rin}'`);
  seenRins.add(action.rin);
  for (const doc of action.federalRegisterDocuments || []) {
    if (seenDocs.has(doc.documentNumber)) errors.push(`${file}: duplicate Federal Register document '${doc.documentNumber}' across registry`);
    seenDocs.add(doc.documentNumber);
  }
  for (const finding of auditAction(action, asOf)) {
    const text = `${file}:${finding.path || "$"}: [${finding.code}] ${finding.message}`;
    if (finding.severity === "error") errors.push(text); else warnings.push(text);
  }
}

for (const { file, action } of actions) {
  for (const related of action.relatedRins || []) if (!seenRins.has(related)) warnings.push(`${file}: related RIN '${related}' is not yet present in the registry`);
  for (const doc of action.federalRegisterDocuments || []) {
    for (const target of [...(doc.correctsDocumentNumbers || []), ...(doc.supersedesDocumentNumbers || [])]) {
      if (!seenDocs.has(target)) warnings.push(`${file}: document '${doc.documentNumber}' references Federal Register document '${target}' not yet present in the registry`);
    }
  }
}

const report = { asOf, regulatoryActionFiles: files.length, errors, warnings };
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
