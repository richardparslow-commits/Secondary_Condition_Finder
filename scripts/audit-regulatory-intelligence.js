/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { auditAction, deriveLifecycleState } = require("./lib/regulatory-intelligence");

const args = new Set(process.argv.slice(2));
const markdown = args.has("--markdown");
const asOfArg = process.argv.find(arg => arg.startsWith("--as-of="));
const asOf = asOfArg ? asOfArg.slice("--as-of=".length) : new Date().toISOString().slice(0, 10);
const root = process.cwd();
const regulatoryDir = path.join(root, "data", "regulatory-actions");
const kbDir = path.join(root, "data", "knowledge-base");
const conditionDir = path.join(root, "data", "conditions");

const regulatoryFiles = fs.existsSync(regulatoryDir) ? fs.readdirSync(regulatoryDir).filter(file => file.endsWith(".json") && !file.startsWith("_")).sort() : [];
const actions = regulatoryFiles.map(file => ({ file, data: JSON.parse(fs.readFileSync(path.join(regulatoryDir, file), "utf8")) }));
const actionByRin = new Map(actions.map(({ data }) => [data.rin, data]));
const findings = [];
const lifecycleCounts = {};

const increment = key => { lifecycleCounts[key] = (lifecycleCounts[key] || 0) + 1; };
for (const { file, data } of actions) {
  const state = deriveLifecycleState(data, asOf);
  increment(state);
  for (const finding of auditAction(data, asOf)) findings.push({ file, rin: data.rin, ...finding });
}

const catalogIds = new Set();
if (fs.existsSync(conditionDir)) {
  for (const file of fs.readdirSync(conditionDir).filter(file => file.endsWith(".json"))) {
    const data = JSON.parse(fs.readFileSync(path.join(conditionDir, file), "utf8"));
    for (const condition of data.conditions || []) if (condition.id) catalogIds.add(condition.id);
  }
}

for (const { file, data } of actions) {
  for (const id of data.impact?.affectedConditionIds || []) {
    if (!catalogIds.has(id)) findings.push({ file, rin: data.rin, severity: "error", code: "IMPACT_UNKNOWN_CONDITION", path: "impact.affectedConditionIds", message: `Regulatory impact references unknown condition '${id}'.` });
  }
}

let kbReferenceCount = 0;
if (fs.existsSync(kbDir)) {
  for (const file of fs.readdirSync(kbDir).filter(file => file.endsWith(".json"))) {
    const mapping = JSON.parse(fs.readFileSync(path.join(kbDir, file), "utf8"));
    for (const suggestion of mapping.suggestions || []) {
      for (const ref of suggestion.regulatoryActionRefs || []) {
        kbReferenceCount += 1;
        if (!actionByRin.has(ref.rin)) findings.push({ file, rin: ref.rin, severity: "error", code: "KB_REGULATORY_RIN_MISSING", path: `${mapping.id}->${suggestion.conditionId}`, message: `KB mapping references regulatory RIN '${ref.rin}' that is not present in data/regulatory-actions.` });
      }
    }
  }
}

const report = {
  asOf,
  regulatoryActions: actions.length,
  kbRegulatoryReferences: kbReferenceCount,
  lifecycleCounts,
  findings,
  errors: findings.filter(f => f.severity === "error").length,
  warnings: findings.filter(f => f.severity === "warning").length,
};

if (markdown) {
  console.log("# Regulatory intelligence audit\n");
  console.log(`- As of: **${asOf}**`);
  console.log(`- Regulatory actions: **${report.regulatoryActions}**`);
  console.log(`- KB regulatory references: **${report.kbRegulatoryReferences}**`);
  console.log(`- Errors: **${report.errors}**`);
  console.log(`- Warnings: **${report.warnings}**\n`);
  console.log("## Lifecycle states");
  for (const [state, count] of Object.entries(lifecycleCounts).sort()) console.log(`- ${state}: ${count}`);
  console.log("\n## Findings");
  if (!findings.length) console.log("- None");
  for (const finding of findings) console.log(`- ${finding.severity}:${finding.code} — ${finding.file} — ${finding.message}`);
} else console.log(JSON.stringify(report, null, 2));

if (report.errors) process.exitCode = 1;
