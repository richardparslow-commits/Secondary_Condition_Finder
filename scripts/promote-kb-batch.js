/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const kbDir = path.join(process.cwd(), "data/knowledge-base");
const targetId = process.argv[2];

if (!targetId) {
  console.error("Usage: node scripts/promote-kb-batch.js <condition-id>");
  process.exit(1);
}

const filePath = path.join(kbDir, `${targetId}.json`);
if (!fs.existsSync(filePath)) {
  console.error(`Error: Knowledge base file for '${targetId}' not found at ${filePath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

let errors = [];
if (!data.suggestions || data.suggestions.length === 0) {
  errors.push("Missing or empty 'suggestions' array.");
}
if (data.todo && data.todo.length > 0) {
  errors.push("Unresolved items remain in the 'todo' checklist.");
}
if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
  const missingRefs = data.suggestions
    .map((suggestion, idx) => ({ suggestion, idx }))
    .filter(({ suggestion }) => !Array.isArray(suggestion.sourceReferences) || suggestion.sourceReferences.length === 0)
    .map(({ idx }) => idx);

  if (missingRefs.length > 0) {
    errors.push(
      `Each suggestion must include at least one source reference citation. Missing on suggestion index(es): ${missingRefs.join(", ")}.`,
    );
  }

  data.suggestions.forEach((suggestion, suggestionIdx) => {
    if (!Array.isArray(suggestion.sourceReferences)) return;

    suggestion.sourceReferences.forEach((ref, refIdx) => {
      if (ref.verified !== false) {
        errors.push(
          `Suggestion [${suggestionIdx}] source reference [${refIdx}] must have 'verified: false'.`,
        );
      }
    });
  });
}

if (errors.length > 0) {
  console.error(`❌ Validation failed for '${targetId}':`);
  errors.forEach(e => console.error(`   - ${e}`));
  process.exit(1);
}

data.draft = false;
data.todo = [];
fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
console.log(`✅ Successfully promoted '${targetId}' from draft to published (draft: false)!`);
