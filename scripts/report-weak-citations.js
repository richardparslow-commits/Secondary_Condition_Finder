/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const kbDir = path.join(process.cwd(), "data", "knowledge-base");
const weakCitationPattern =
  /\b(relevant|placeholder|journal study|regulation link|link|example|todo|tbd|unknown)\b/i;

const findings = [];
for (const file of fs.readdirSync(kbDir).filter((entry) => entry.endsWith(".json")).sort()) {
  const mapping = JSON.parse(fs.readFileSync(path.join(kbDir, file), "utf8"));
  if (mapping.draft) continue;
  (mapping.suggestions || []).forEach((suggestion, suggestionIndex) => {
    (suggestion.sourceReferences || []).forEach((reference, referenceIndex) => {
      if (weakCitationPattern.test(reference.citation)) {
        findings.push({
          file,
          suggestionIndex,
          referenceIndex,
          citation: reference.citation,
        });
      }
    });
  });
}

if (findings.length === 0) {
  console.log("✅ No weak citation text found in published knowledge-base mappings.");
  process.exit(0);
}

console.log("⚠️ Weak citation text found in published mappings:");
findings.forEach((finding) => {
  console.log(
    `- ${finding.file} suggestion[${finding.suggestionIndex}] sourceReferences[${finding.referenceIndex}]: "${finding.citation}"`,
  );
});
process.exit(1);
