const fs = require("fs");
const path = require("path");

const kbDir = path.join(process.cwd(), "data/knowledge-base");
const files = fs.readdirSync(kbDir).filter((file) => file.endsWith(".json")).sort();

const findings = [];
let references = 0;
let verified = 0;
let clinical = 0;
let clinicalWithUrls = 0;

for (const file of files) {
  const mapping = JSON.parse(fs.readFileSync(path.join(kbDir, file), "utf8"));
  for (const [suggestionIndex, suggestion] of (mapping.suggestions || []).entries()) {
    for (const [referenceIndex, reference] of (suggestion.sourceReferences || []).entries()) {
      references += 1;
      if (reference.verified) verified += 1;
      if (reference.verificationScope === "clinical-evidence") {
        clinical += 1;
        if (reference.sourceUrl) clinicalWithUrls += 1;
      }

      const prefix = `${file}: suggestions[${suggestionIndex}].sourceReferences[${referenceIndex}]`;
      if (reference.verified) {
        for (const field of ["sourceUrl", "sourceCheckedOn", "sourceLocator"]) {
          if (!reference[field]) findings.push(`${prefix}: verified reference is missing ${field}`);
        }
      }

      if (reference.citation === "38 CFR 3.310" && /cause|caused|aggravat|medication/i.test(reference.note)) {
        findings.push(`${prefix}: 38 CFR 3.310 is legal authority and should not be treated as clinical evidence for the medical proposition in its note`);
      }

      if (mapping.draft === false && reference.verified === false) {
        findings.push(`${prefix}: published mapping still contains an unverified source`);
      }
    }
  }
}

const report = {
  knowledgeBaseFiles: files.length,
  references,
  verified,
  unverified: references - verified,
  clinicalEvidenceReferences: clinical,
  clinicalEvidenceReferencesWithUrls: clinicalWithUrls,
  findings,
};

console.log(JSON.stringify(report, null, 2));

// This is an audit/reporting command. It intentionally exits successfully so
// incomplete verification is visible and reviewable rather than being silently
// converted into a false "verified" state.
