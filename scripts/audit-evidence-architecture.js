/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const {
  auditSource,
  classifySource,
  recommendedRole,
  validateSuggestionMetadata,
} = require("./lib/evidence-architecture");

const args = new Set(process.argv.slice(2));
const write = args.has("--write");
const markdown = args.has("--markdown");
const repoRoot = process.cwd();
const kbDir = path.join(repoRoot, "data", "knowledge-base");

const files = fs.readdirSync(kbDir).filter(file => file.endsWith(".json")).sort();
const categoryCounts = new Map();
const confidenceCounts = new Map();
const issueCounts = new Map();
const findings = [];
const suggestionFindings = [];
let references = 0;
let changedFiles = 0;
let changedReferences = 0;

const increment = (map, key) => map.set(key, (map.get(key) || 0) + 1);
const canSafelyAuthor = (source, classification) => {
  if (!classification.authorityCategory || !["high", "explicit"].includes(classification.confidence)) return false;
  if (classification.authorityCategory === "medical-scientific-evidence" && !source.sourceUrl) return false;

  const legacyRole =
    source.verificationScope === "clinical-evidence" ? "clinical-evidence" :
    source.verificationScope === "procedural-guidance" ? "procedural-guidance" :
    source.verificationScope === "legal-framework" ? "legal-framework" :
    undefined;
  const nextRole = source.propositionRole || recommendedRole(classification.authorityCategory);

  // Never turn a legacy disagreement into a hard v2 contradiction automatically.
  if (legacyRole && nextRole && legacyRole !== nextRole) return false;
  return true;
};

const writeAtomicJson = (filePath, data) => {
  const temp = `${filePath}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  fs.renameSync(temp, filePath);
};

for (const file of files) {
  const filePath = path.join(kbDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  let changed = false;

  for (let suggestionIndex = 0; suggestionIndex < (data.suggestions || []).length; suggestionIndex += 1) {
    const suggestion = data.suggestions[suggestionIndex];
    for (const metadataError of validateSuggestionMetadata(suggestion)) {
      increment(issueCounts, "error:INVALID_SUGGESTION_METADATA");
      suggestionFindings.push({
        file,
        mappingId: data.id,
        conditionId: suggestion.conditionId,
        suggestionIndex,
        severity: "error",
        code: "INVALID_SUGGESTION_METADATA",
        message: metadataError,
      });
    }
    for (let sourceIndex = 0; sourceIndex < (suggestion.sourceReferences || []).length; sourceIndex += 1) {
      const source = suggestion.sourceReferences[sourceIndex];
      references += 1;
      const classification = classifySource(source);
      increment(confidenceCounts, classification.confidence);
      increment(categoryCounts, classification.authorityCategory || "unknown");

      const issues = auditSource(source, {
        claimTheories: suggestion.claimTheories,
        nexusRequirement: suggestion.nexusRequirement,
      });
      for (const issue of issues) increment(issueCounts, `${issue.severity}:${issue.code}`);

      if (issues.length > 0 || classification.confidence === "unknown") {
        findings.push({
          file,
          mappingId: data.id,
          conditionId: suggestion.conditionId,
          suggestionIndex,
          sourceIndex,
          citation: source.citation,
          inferredAuthorityCategory: classification.authorityCategory || null,
          confidence: classification.confidence,
          reason: classification.reason,
          issues,
        });
      }

      if (write && canSafelyAuthor(source, classification)) {
        let sourceChanged = false;
        if (!source.authorityCategory) {
          source.authorityCategory = classification.authorityCategory;
          sourceChanged = true;
        }
        if (!source.propositionRole) {
          source.propositionRole = recommendedRole(classification.authorityCategory);
          sourceChanged = true;
        }
        if (sourceChanged) {
          changed = true;
          changedReferences += 1;
        }
      }
    }
  }

  if (write && changed) {
    writeAtomicJson(filePath, data);
    changedFiles += 1;
  }
}

const toObject = map => Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
const report = {
  mode: write ? "write" : "dry-run",
  policy: {
    legacyCompatibility: "Existing source metadata remains valid; unknown/inferred mismatches are audit findings unless explicit v2 metadata contradicts the architecture.",
    writeBehavior: "--write only adds high-confidence authorityCategory/propositionRole metadata and never changes citation text, rationale, ranks, evidence gaps, or substantive claim mapping.",
  },
  knowledgeBaseFiles: files.length,
  references,
  categoryCounts: toObject(categoryCounts),
  confidenceCounts: toObject(confidenceCounts),
  issueCounts: toObject(issueCounts),
  findings,
  suggestionFindings,
  changedFiles,
  changedReferences,
};

if (markdown) {
  console.log(`# Evidence architecture audit\n`);
  console.log(`- Mode: **${report.mode}**`);
  console.log(`- KB files: **${report.knowledgeBaseFiles}**`);
  console.log(`- Source references: **${report.references}**`);
  console.log(`- Files changed: **${report.changedFiles}**`);
  console.log(`- References changed: **${report.changedReferences}**\n`);
  console.log(`## Authority categories`);
  for (const [category, count] of Object.entries(report.categoryCounts)) console.log(`- ${category}: ${count}`);
  console.log(`\n## Findings`);
  if (suggestionFindings.length === 0 && findings.length === 0) console.log(`- None`);
  for (const finding of suggestionFindings) {
    console.log(`- \`${finding.file}\` → ${finding.conditionId}: ${finding.severity}:${finding.code} — ${finding.message}`);
  }
  for (const finding of findings) {
    const codes = finding.issues.map(issue => `${issue.severity}:${issue.code}`).join(", ") || "classification review";
    console.log(`- \`${finding.file}\` → ${finding.conditionId} → source ${finding.sourceIndex + 1}: ${codes}`);
  }
} else {
  console.log(JSON.stringify(report, null, 2));
}

if (suggestionFindings.length > 0 || findings.some(finding => finding.issues.some(issue => issue.severity === "error"))) process.exitCode = 1;
