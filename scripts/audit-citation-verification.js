const fs = require("fs");
const path = require("path");

const kbDir = path.join(process.cwd(), "data/knowledge-base");
const files = fs.readdirSync(kbDir).filter((file) => file.endsWith(".json")).sort();

const hardFindings = [];
const reviewFindings = [];
let references = 0;
let verified = 0;
let clinical = 0;
let clinicalWithUrls = 0;

function addHard(message) {
  hardFindings.push(message);
}

function addReview(message) {
  reviewFindings.push(message);
}

for (const file of files) {
  const mapping = JSON.parse(fs.readFileSync(path.join(kbDir, file), "utf8"));
  for (const [suggestionIndex, suggestion] of (mapping.suggestions || []).entries()) {
    for (const [referenceIndex, reference] of (suggestion.sourceReferences || []).entries()) {
      references += 1;
      if (reference.verified === true) verified += 1;
      if (reference.verificationScope === "clinical-evidence") {
        clinical += 1;
        if (reference.sourceUrl) clinicalWithUrls += 1;
        if (!reference.sourceUrl) {
          addHard(`${file}: suggestions[${suggestionIndex}].sourceReferences[${referenceIndex}]: clinical-evidence reference is missing sourceUrl`);
        }
      }

      const prefix = `${file}: suggestions[${suggestionIndex}].sourceReferences[${referenceIndex}]`;
      if (reference.verified === true) {
        for (const field of ["sourceUrl", "sourceCheckedOn", "sourceLocator", "verificationScope"]) {
          if (!reference[field]) addHard(`${prefix}: verified reference is missing ${field}`);
        }
      }

      if (reference.citation === "38 CFR 3.310" && /cause|caused|aggravat|medication/i.test(reference.note || "")) {
        addHard(`${prefix}: 38 CFR 3.310 is legal authority and must not be used as clinical evidence for the medical proposition in its note`);
      }

      if (mapping.draft === false && reference.verified !== true) {
        addReview(`${prefix}: published mapping still contains an unverified source`);
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
  hardFindingCount: hardFindings.length,
  reviewFindingCount: reviewFindings.length,
  hardFindings,
  reviewFindings,
};

console.log(JSON.stringify(report, null, 2));

// P3-C policy: incomplete verification remains a review item until the claim
// is actually checked. Unsafe provenance and legal/clinical category errors are
// hard CI failures; they must be corrected before the P3-C branch can merge.
process.exitCode = hardFindings.length > 0 ? 1 : 0;
